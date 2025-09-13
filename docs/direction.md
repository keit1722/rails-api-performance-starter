最小 Rails API + k6 学習用プロジェクト — 実装ブリーフ（md）

このドキュメントは、別の生成AI/エンジニアがそのまま実装できるように書かれています。
目的は「最新安定版の Rails + Ruby を使い、Docker + PostgreSQL でローカル起動し、k6 で負荷をかけるところまで」を最短で完了することです。

⸻

0. 目的と要件
	•	目的
	•	最小限の Rails API を Docker 上で構築し、k6 で基本的な負荷テストを実行できる状態にする。
	•	技術要件
	•	Ruby / Rails：最新の安定版（例：Ruby 3.3系、Rails 8系）
	•	DB：PostgreSQL 16系
	•	実行：Docker / Docker Compose v2
	•	負荷試験：k6（ローカル or Docker で実行）
	•	OS 前提
	•	macOS または Linux

⸻

1. API 仕様（最小）

エンドポイント
	•	GET /health
	•	動作確認用。常に 200 を返す JSON（{ ok: true, time: <UTC> }）。
	•	GET /articles/:id
	•	Article テーブルから 1 件取得し JSON を返す。
	•	POST /articles
	•	JSON {"title":"..."} を受け取り、views: 0 で新規作成。作成したレコードを JSON で返す（201 Created）。

モデル
	•	Article(id: bigint, title: string, views: integer)

⸻

2. ディレクトリ構成（完成形）

perf-api/
  Dockerfile
  docker-compose.yml
  .dockerignore
  load/
    basic.js            # k6 スクリプト
  app/                  # rails new 後に生成
  bin/
  config/
  db/
  ...（Rails標準構成）

以降のコマンドはプロジェクトルート perf-api/ で実行。

⸻

3. Rails プロジェクト新規作成（Docker コンテナで実行）

ローカルへ Ruby を入れず、一時的な Docker コンテナで rails new を実行します。

mkdir perf-api && cd perf-api

# APIモード + PostgreSQL。Ruby/rails の最新安定版を slim イメージで使用
docker run --rm -v "$PWD":/app -w /app ruby:3.3-slim bash -lc \
  "apt-get update && apt-get install -y --no-install-recommends build-essential libpq-dev \
   && gem install bundler rails -N \
   && rails new . --api -d postgresql --force"


⸻

4. コンテナ定義

4.1 Dockerfile

FROM ruby:3.3-slim

RUN apt-get update -y \
 && apt-get install -y --no-install-recommends build-essential libpq-dev \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 依存インストールをレイヤー分離
COPY Gemfile Gemfile.lock /app/
RUN bundle install

# アプリ本体
COPY . /app

# Puma を 0.0.0.0:3000 で起動（Docker 外からアクセス可能に）
EXPOSE 3000
CMD ["bash", "-lc", "bundle exec rails db:prepare && bundle exec puma -b tcp://0.0.0.0:3000"]

4.2 .dockerignore

.git
log/*
tmp/*
node_modules
.bundle
vendor/bundle

4.3 docker-compose.yml

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      RAILS_ENV: development
      RAILS_LOG_TO_STDOUT: "1"
      DATABASE_URL: "postgresql://postgres:postgres@db:5432/perf_api_development"
    depends_on:
      db:
        condition: service_healthy
    volumes:
      - .:/app:cached

  db:
    image: postgres:16
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: perf_api_development
    ports:
      - "5432:5432"
    volumes:
      - db-data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 5s
      retries: 10

volumes:
  db-data:

補足：Rails の config/database.yml は既定で DATABASE_URL を優先使用します（最新Rails想定）。

⸻

5. Rails 実装（最小）

5.1 ルーティング config/routes.rb

Rails.application.routes.draw do
  get  "/health",        to: "health#show"
  get  "/articles/:id",  to: "articles#show"
  post "/articles",      to: "articles#create"
end

5.2 コントローラ

app/controllers/health_controller.rb

class HealthController < ApplicationController
  def show
    render json: { ok: true, time: Time.now.utc }
  end
end

app/controllers/articles_controller.rb

class ArticlesController < ApplicationController
  def show
    article = Article.find(params[:id])
    render json: { id: article.id, title: article.title, views: article.views }
  end

  def create
    title = params[:title].presence || "untitled"
    article = Article.create!(title: title, views: 0)
    render json: { id: article.id, title: article.title, views: article.views }, status: :created
  end
end

5.3 モデルとマイグレーション

docker compose run --rm app bin/rails g model Article title:string views:integer
docker compose run --rm app bin/rails db:migrate

5.4 開発用シード（任意）

db/seeds.rb

Article.find_or_create_by!(title: "hello") { |a| a.views = 0 }

docker compose run --rm app bin/rails db:seed


⸻

6. ローカル起動・動作確認

docker compose build
docker compose up -d

# 動作確認
curl http://localhost:3000/health
# => {"ok":true,"time":"...Z"}

curl http://localhost:3000/articles/1
# => {"id":1,"title":"hello","views":0}

curl -X POST http://localhost:3000/articles \
  -H "Content-Type: application/json" \
  -d '{"title":"from_curl"}'
# => {"id":2,"title":"from_curl","views":0}


⸻

7. k6 スクリプトと実行

7.1 スクリプト load/basic.js

import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  scenarios: {
    health: {
      executor: 'constant-arrival-rate',
      exec: 'health',
      rate: 50, timeUnit: '1s', duration: '60s',
      preAllocatedVUs: 20, maxVUs: 100,
    },
    read: {
      executor: 'constant-arrival-rate',
      exec: 'read',
      rate: 30, timeUnit: '1s', duration: '60s',
      preAllocatedVUs: 20, maxVUs: 100,
    },
    write: {
      executor: 'constant-arrival-rate',
      exec: 'write',
      rate: 10, timeUnit: '1s', duration: '60s',
      preAllocatedVUs: 20, maxVUs: 100,
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    'http_req_duration{scenario:health}': ['p(95)<150'],
    'http_req_duration{scenario:read}':   ['p(95)<300'],
    'http_req_duration{scenario:write}':  ['p(95)<500'],
  },
};

const BASE = __ENV.BASE_URL || 'http://localhost:3000';

export function health() {
  const r = http.get(`${BASE}/health`);
  check(r, { '200': (res) => res.status === 200 });
  sleep(1);
}

export function read() {
  const r = http.get(`${BASE}/articles/1`);
  check(r, { '200': (res) => res.status === 200 });
  sleep(1);
}

export function write() {
  const payload = JSON.stringify({ title: 'k6' });
  const r = http.post(`${BASE}/articles`, payload, {
    headers: { 'Content-Type': 'application/json' },
  });
  check(r, { '2xx/3xx': (res) => res.status >= 200 && res.status < 400 });
  sleep(1);
}

7.2 実行方法（いずれか）
	•	ローカルに k6 をインストールして実行

k6 run -e BASE_URL=http://localhost:3000 load/basic.js


	•	Docker で k6 実行（インストール不要）

cat load/basic.js | docker run -i --rm grafana/k6 run \
  -e BASE_URL=http://host.docker.internal:3000 -

Linux では host.docker.internal が無い場合があります。その場合は http://localhost:3000 か、API コンテナの実 IP を指定してください。

⸻

8. 成功条件（学習のゴール）
	•	3シナリオ（health / read / write）が完走し、失敗率 < 1% を満たす
	•	p95 レイテンシと、constant-arrival-rate（RPS一定）の基本を理解
	•	Rails（Puma）・DB（Postgres）・負荷生成（k6）の役割分離を把握

⸻

9. 次のステップ（任意）
	•	データ件数を増やし GET /articles/:id の分布やキャッシュの効果（※最小構成では未導入）を検証
	•	Puma の WEB_CONCURRENCY / RAILS_MAX_THREADS を調整 → k6 で before/after 計測
	•	スロークエリ検出 → インデックス追加 → k6 で改善度を数値化
	•	k6 のタグやthreshold を整理し、シナリオごとの可観測性を向上

⸻

10. トラブルシュート
	•	ActiveRecord::ConnectionNotEstablished
	•	DATABASE_URL が db サービス（Postgres コンテナ）を指しているか確認。
	•	PG::ConnectionBad
	•	DB コンテナが起動済みか、ユーザ/パスワードが一致しているか確認。
	•	k6（Docker）から API へ届かない
	•	macOS は host.docker.internal が使えるが、Linux では不可の場合あり。localhost:3000 や実 IP を使う。

⸻

付録：最小コマンド一覧（コピペ用）

# 初回（ビルド〜DB準備〜起動）
docker compose build
docker compose run --rm app bin/rails db:prepare db:seed
docker compose up -d

# 動作確認
curl http://localhost:3000/health
curl http://localhost:3000/articles/1
curl -X POST http://localhost:3000/articles -H "Content-Type: application/json" -d '{"title":"from_curl"}'

# k6（ローカル）
k6 run -e BASE_URL=http://localhost:3000 load/basic.js

# k6（Docker）
cat load/basic.js | docker run -i --rm grafana/k6 run -e BASE_URL=http://host.docker.internal:3000 -


⸻

以上です。
