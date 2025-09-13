import http from "k6/http";
import { check, sleep, group } from "k6";

// スモークテスト: 最小限の負荷でシステムが正常に動作することを確認
export const options = {
  vus: 1, // 1人のユーザーのみ
  duration: "30s", // 30秒間実行
  thresholds: {
    http_req_failed: ["rate<0.01"], // エラー率 < 1%
    http_req_duration: ["p(95)<1000"], // 95%のリクエストが1秒以内
  },
};

const BASE_URL = __ENV.BASE_URL || "http://localhost:3000";

export default function () {
  // グループ1: ヘルスチェック
  group("Health Check", function () {
    const healthRes = http.get(`${BASE_URL}/health`);
    check(healthRes, {
      "health check status is 200": (r) => r.status === 200,
      "health check has ok field": (r) => JSON.parse(r.body).ok === true,
      "response time < 200ms": (r) => r.timings.duration < 200,
    });
  });

  sleep(1);

  // グループ2: 記事の取得
  group("Get Article", function () {
    const articleRes = http.get(`${BASE_URL}/articles/1`);
    check(articleRes, {
      "article status is 200": (r) => r.status === 200,
      "article has title": (r) => JSON.parse(r.body).title !== undefined,
      "article has id": (r) => JSON.parse(r.body).id === 1,
    });
  });

  sleep(1);

  // グループ3: 記事の作成
  group("Create Article", function () {
    const payload = JSON.stringify({
      title: `Smoke Test Article ${Date.now()}`,
    });

    const params = {
      headers: { "Content-Type": "application/json" },
    };

    const createRes = http.post(`${BASE_URL}/articles`, payload, params);
    check(createRes, {
      "create status is 201": (r) => r.status === 201,
      "created article has id": (r) => JSON.parse(r.body).id > 0,
      "created article has correct title": (r) => {
        const body = JSON.parse(r.body);
        return body.title && body.title.startsWith("Smoke Test Article");
      },
    });
  });

  sleep(2);
}

// テスト終了時のサマリーをカスタマイズ
export function handleSummary(data) {
  return {
    stdout: textSummary(data, { indent: " ", enableColors: true }),
  };
}

// サマリー表示用の関数
function textSummary(data, options) {
  const indent = options.indent || "";
  const passed = data.metrics.checks.values.passes;
  const failed = data.metrics.checks.values.fails;
  const total = passed + failed;

  let summary = "\n" + indent + "=== SMOKE TEST RESULTS ===\n";
  summary += indent + `Total Checks: ${total}\n`;
  summary +=
    indent + `Passed: ${passed} (${((passed / total) * 100).toFixed(1)}%)\n`;
  summary +=
    indent + `Failed: ${failed} (${((failed / total) * 100).toFixed(1)}%)\n`;

  if (failed === 0) {
    summary += indent + "✅ All checks passed!\n";
  } else {
    summary += indent + "❌ Some checks failed.\n";
  }

  return summary;
}
