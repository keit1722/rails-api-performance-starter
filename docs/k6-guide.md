# k6 負荷テストガイド

## 目次
1. [k6とは](#k6とは)
2. [インストール方法](#インストール方法)
3. [基本的な使い方](#基本的な使い方)
4. [このプロジェクトのテストシナリオ](#このプロジェクトのテストシナリオ)
5. [実行方法](#実行方法)
6. [結果の見方](#結果の見方)
7. [カスタマイズ方法](#カスタマイズ方法)
8. [トラブルシューティング](#トラブルシューティング)

## k6とは

k6は、開発者向けに設計されたモダンな負荷テストツールです。JavaScriptでテストシナリオを記述し、APIやWebサイトのパフォーマンステストを実行できます。

### 主な特徴
- JavaScriptによるシナリオ記述
- 高パフォーマンス（Go言語で実装）
- CI/CD統合が容易
- リアルタイムメトリクス表示
- 複数の実行モード（定常負荷、段階的増加、スパイクテストなど）

## インストール方法

### macOS
```bash
# Homebrewを使用
brew install k6
```

### Linux
```bash
# APTを使用（Ubuntu/Debian）
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update
sudo apt-get install k6
```

### Docker（インストール不要）
```bash
# Dockerイメージを直接使用
docker run --rm -i grafana/k6 run -
```

### インストール確認
```bash
k6 version
```

## 基本的な使い方

### 最小限のテストスクリプト

```javascript
// simple-test.js
import http from 'k6/http';
import { check } from 'k6';

export default function() {
  let response = http.get('http://localhost:3000/health');
  check(response, {
    'status is 200': (r) => r.status === 200,
  });
}
```

### 実行
```bash
k6 run simple-test.js
```

### 負荷パラメータの設定

```javascript
export const options = {
  vus: 10,        // 仮想ユーザー数
  duration: '30s', // テスト期間
};
```

## このプロジェクトのテストシナリオ

`load/basic.js`には3つの並行シナリオが定義されています：

### 1. Healthシナリオ
- **目的**: ヘルスチェックエンドポイントの負荷テスト
- **レート**: 50リクエスト/秒
- **期間**: 60秒
- **成功基準**: p95 < 150ms

### 2. Readシナリオ
- **目的**: 記事取得エンドポイントの負荷テスト
- **レート**: 30リクエスト/秒
- **期間**: 60秒
- **成功基準**: p95 < 300ms

### 3. Writeシナリオ
- **目的**: 記事作成エンドポイントの負荷テスト
- **レート**: 10リクエスト/秒
- **期間**: 60秒
- **成功基準**: p95 < 500ms

### シナリオの詳細設定

```javascript
export const options = {
  scenarios: {
    health: {
      executor: 'constant-arrival-rate',  // 一定レートでリクエスト
      exec: 'health',                     // 実行する関数
      rate: 50,                           // 秒間リクエスト数
      timeUnit: '1s',                     // 時間単位
      duration: '60s',                    // 期間
      preAllocatedVUs: 20,               // 事前割り当てVU数
      maxVUs: 100,                       // 最大VU数
    },
    // ... 他のシナリオ
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],     // エラー率 < 1%
    'http_req_duration{scenario:health}': ['p(95)<150'],
  },
};
```

## 実行方法

### 方法1: ローカルにk6をインストールして実行

```bash
# 基本実行
k6 run load/basic.js

# 環境変数を指定して実行
k6 run -e BASE_URL=http://localhost:3000 load/basic.js

# VU数と期間を上書きして実行
k6 run --vus 10 --duration 30s load/basic.js

# 結果をJSONで出力
k6 run --out json=results.json load/basic.js

# 詳細ログを表示
k6 run --verbose load/basic.js
```

### 方法2: Dockerで実行（k6インストール不要）

```bash
# 基本実行
cat load/basic.js | docker run -i --rm grafana/k6 run -

# Dockerネットワーク経由でアクセス
# 1. アプリケーションコンテナのIPアドレスを確認
docker inspect rails-api-performance-starter-app-1 | grep IPAddress

# 2. 確認したIPアドレスを使用して実行
cat load/basic.js | docker run -i --rm \
  --network rails-api-performance-starter_default \
  grafana/k6 run -e BASE_URL=http://172.18.0.3:3000 -
```

### 方法3: docker-composeに統合

```yaml
# docker-compose.yml に追加
k6:
  image: grafana/k6
  networks:
    - default
  volumes:
    - ./load:/scripts
  command: run -e BASE_URL=http://app:3000 /scripts/basic.js
```

## 結果の見方

### 実行中の表示

```
running (0m10.0s), 090/100 VUs, 768 complete and 0 interrupted iterations
health   [  17% ] 050/051 VUs  0m10.0s/1m0s  50.00 iters/s
```

- `090/100 VUs`: 現在90個のVUが実行中、最大100個
- `768 complete`: 768回のイテレーション完了
- `[17%]`: 進捗率
- `50.00 iters/s`: 秒間イテレーション数

### 最終結果の見方

```
http_req_duration..............: avg=10.74ms min=2.07ms med=3.82ms max=184.42ms p(90)=20.15ms p(95)=22.9ms
```

- **avg**: 平均レスポンスタイム
- **min/max**: 最小/最大レスポンスタイム
- **med**: 中央値
- **p(90)/p(95)**: 90/95パーセンタイル値

### 重要な指標

1. **http_req_failed**: リクエスト失敗率
2. **http_req_duration**: レスポンスタイム
3. **http_reqs**: 総リクエスト数とレート
4. **vus**: 仮想ユーザー数の推移
5. **iteration_duration**: 1イテレーションの所要時間

## カスタマイズ方法

### 負荷パターンの変更

#### 段階的増加（Ramping）
```javascript
export const options = {
  stages: [
    { duration: '30s', target: 10 },  // 30秒で10VUまで増加
    { duration: '1m', target: 10 },   // 1分間10VUを維持
    { duration: '30s', target: 0 },   // 30秒で0まで減少
  ],
};
```

#### スパイクテスト
```javascript
export const options = {
  stages: [
    { duration: '10s', target: 100 },  // 急激に増加
    { duration: '30s', target: 100 },  // 維持
    { duration: '10s', target: 0 },    // 急激に減少
  ],
};
```

### カスタムメトリクスの追加

```javascript
import { Counter, Trend } from 'k6/metrics';

const myCounter = new Counter('my_custom_counter');
const myTrend = new Trend('my_custom_trend');

export default function() {
  myCounter.add(1);
  myTrend.add(response.timings.duration);
}
```

### 認証付きリクエスト

```javascript
export default function() {
  const params = {
    headers: {
      'Authorization': 'Bearer YOUR_TOKEN',
      'Content-Type': 'application/json',
    },
  };

  const response = http.get('http://localhost:3000/api/protected', params);
}
```

### データのパラメータ化

```javascript
import { SharedArray } from 'k6/data';

const data = new SharedArray('users', function() {
  return JSON.parse(open('./users.json'));
});

export default function() {
  const user = data[Math.floor(Math.random() * data.length)];
  const payload = JSON.stringify({
    title: `Article by ${user.name}`,
  });

  http.post('http://localhost:3000/articles', payload, {
    headers: { 'Content-Type': 'application/json' },
  });
}
```

## トラブルシューティング

### よくある問題と解決方法

#### 1. Connection refused エラー
```
ERRO[0000] Get "http://localhost:3000/health": dial tcp 127.0.0.1:3000: connect: connection refused
```

**解決方法**:
- APIサーバーが起動しているか確認: `docker compose ps`
- ポートが正しいか確認
- Dockerで実行時は`localhost`ではなくコンテナのIPを使用

#### 2. Too many open files エラー
```
WARN[0010] Request Failed error="Get \"http://localhost:3000/health\": dial tcp: lookup localhost: too many open files"
```

**解決方法**:
```bash
# macOS
ulimit -n 10000

# Linux
ulimit -n 65536
```

#### 3. Context deadline exceeded
```
WARN[0030] Request Failed error="Get \"http://localhost:3000/health\": context deadline exceeded"
```

**解決方法**:
- タイムアウト値を増やす
```javascript
export const options = {
  httpDebug: 'full',
  timeout: '60s',  // デフォルトは30s
};
```

#### 4. メモリ不足
```
ERRO[0045] JavaScript runtime has crashed
```

**解決方法**:
- VU数を減らす
- `--max-redirects 0`オプションを追加
- Dockerの場合はメモリ制限を増やす

### デバッグ方法

```bash
# HTTPデバッグを有効化
k6 run --http-debug load/basic.js

# 詳細ログ
k6 run --verbose load/basic.js

# 特定のシナリオのみ実行
k6 run --scenario health load/basic.js
```

## 参考資料

- [k6公式ドキュメント](https://k6.io/docs/)
- [k6 Examples](https://github.com/grafana/k6/tree/master/examples)
- [k6 Extensions](https://k6.io/docs/extensions/)
- [Grafana Cloud k6](https://grafana.com/products/cloud/k6/)
