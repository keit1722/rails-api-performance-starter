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