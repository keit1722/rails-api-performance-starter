# Rails API Performance Starter

最小構成のRails APIアプリケーションとk6による負荷テスト環境のスターターキットです。

## 概要

このプロジェクトは、Rails APIモードで構築された最小限のWebAPIと、k6を使用した負荷テストを実行できる環境を提供します。Docker ComposeでRailsアプリケーションとPostgreSQLデータベースを起動し、k6で性能測定を行うことができます。

### API仕様

- `GET /health` - ヘルスチェックエンドポイント
- `GET /articles/:id` - 記事を1件取得
- `POST /articles` - 新規記事を作成

## 技術スタック

- Ruby 3.3
- Rails 8 (APIモード)
- PostgreSQL 16
- Docker / Docker Compose
- k6 (負荷テストツール)

## セットアップと起動方法

### 1. リポジトリのクローン

```bash
git clone <repository-url>
cd rails-api-performance-starter
```

### 2. Dockerコンテナの起動

```bash
# Dockerイメージのビルドとコンテナ起動
docker compose up -d

# ログ確認（必要に応じて）
docker compose logs -f app
```

### 3. 動作確認

```bash
# ヘルスチェック
curl http://localhost:3000/health
# => {"ok":true,"time":"2025-09-12T23:36:27.075Z"}

# 記事取得
curl http://localhost:3000/articles/1
# => {"id":1,"title":"hello","views":0}

# 記事作成
curl -X POST http://localhost:3000/articles \
  -H "Content-Type: application/json" \
  -d '{"title":"test article"}'
# => {"id":2,"title":"test article","views":0}
```

## k6負荷テスト

このプロジェクトには、k6を使用した負荷テスト環境が含まれています。

📖 **詳しい使い方は [k6負荷テストガイド](docs/k6-guide.md) を参照してください。**

### クイックスタート

```bash
# ローカルにk6がインストール済みの場合
k6 run -e BASE_URL=http://localhost:3000 load/basic.js

# Dockerで実行する場合（k6インストール不要）
cat load/basic.js | docker run -i --rm --network rails-api-performance-starter_default \
  grafana/k6 run -e BASE_URL=http://172.18.0.3:3000 -
```

テストシナリオの詳細、カスタマイズ方法、トラブルシューティングについては、[k6ガイド](docs/k6-guide.md)をご覧ください。

## 開発ツール

### Rails Consoleへのアクセス

```bash
# Rails consoleを起動
docker compose run --rm app bin/rails console

# 例: Articleモデルの操作
Article.all
Article.create(title: "test", views: 0)
Article.find(1)
```

### データベースへの直接アクセス

```bash
# PostgreSQLクライアントで接続
docker compose run --rm db psql -h db -U postgres -d perf_api_development

# または、実行中のDBコンテナに直接接続
docker compose exec db psql -U postgres -d perf_api_development

# よく使うSQLコマンド
# テーブル一覧: \dt
# テーブル構造: \d articles
# データ確認: SELECT * FROM articles;
# 終了: \q
```

## 停止方法

```bash
# コンテナの停止
docker compose down

# ボリュームも含めて完全削除
docker compose down -v
```

## トラブルシューティング

### APIに接続できない場合
- `docker compose ps`でコンテナの状態を確認
- `docker compose logs app`でエラーログを確認

### k6テストが失敗する場合
- APIが正常に起動しているか確認
- ネットワーク設定（IPアドレス）が正しいか確認
- `docker network ls`でネットワーク名を確認

## 次のステップ

- Pumaのワーカー数やスレッド数の調整 (`WEB_CONCURRENCY`, `RAILS_MAX_THREADS`)
- データベースインデックスの追加と性能改善
- キャッシュレイヤーの追加
- より複雑な負荷テストシナリオの作成