import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '10s', target: 20 },  // Ramp-up to 20 virtual users
    { duration: '30s', target: 50 },  // Maintain 50 virtual users
    { duration: '10s', target: 0 },   // Ramp-down to 0
  ],
  thresholds: {
    http_req_duration: ['p(95)<200'], // 95% of requests must complete below 200ms
    http_req_failed: ['rate<0.01'],   // Error rate must be under 1%
  },
};

const BASE_URL = __ENV.API_URL || 'http://localhost:8080';

export default function () {
  // 1. Fetch document list
  const listRes = http.get(`${BASE_URL}/api/documents`);
  check(listRes, {
    'GET /api/documents status 200': (r) => r.status === 200,
  });

  // 2. Fetch Prometheus metrics
  const metricsRes = http.get(`${BASE_URL}/actuator/prometheus`);
  check(metricsRes, {
    'Actuator Prometheus healthy': (r) => r.status === 200,
  });

  // 3. Health check
  const healthRes = http.get(`${BASE_URL}/actuator/health`);
  check(healthRes, {
    'Health is UP': (r) => r.status === 200,
  });

  sleep(0.5);
}

