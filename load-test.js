import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 20 },
    { duration: '1m', target: 50 },
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000'],
    http_req_failed: ['rate<0.2'],
  },
};

const BASE = __ENV.BASE_URL || 'http://localhost:3000';
const ORCH = __ENV.ORCH_URL || 'http://localhost:8081';

export default function () {
  const health = http.get(`${BASE}/health`);
  check(health, { 'backend health 200': (r) => r.status === 200 });

  const orchHealth = http.get(`${ORCH}/health`);
  check(orchHealth, { 'orchestrator health 200': (r) => r.status === 200 });

  sleep(1);
}
