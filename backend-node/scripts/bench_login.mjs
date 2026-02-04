/**
 * Быстрый бенч для /api/auth/login.
 *
 * Пример:
 *   API_BASE_URL="http://127.0.0.1:8001/api" EMAIL="test@example.com" PASSWORD="secret" N=20 node scripts/bench_login.mjs
 */

const apiBaseUrl = process.env.API_BASE_URL || 'http://127.0.0.1:8001/api';
const email = process.env.EMAIL;
const password = process.env.PASSWORD;
const n = Number.parseInt(process.env.N || '20', 10);

if (!email || !password) {
  console.error('Set EMAIL and PASSWORD env vars.');
  process.exit(1);
}

function percentile(sorted, p) {
  if (sorted.length === 0) return 0;
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.min(Math.max(idx, 0), sorted.length - 1)];
}

const times = [];
let ok = 0;
let fail = 0;

for (let i = 0; i < n; i++) {
  const t0 = performance.now();
  const res = await fetch(`${apiBaseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const t1 = performance.now();
  times.push(t1 - t0);

  if (res.ok) ok++;
  else fail++;

  // потребляем body, чтобы не влиять на keep-alive
  await res.text();
}

times.sort((a, b) => a - b);
const avg = times.reduce((s, x) => s + x, 0) / times.length;

console.log(JSON.stringify({
  apiBaseUrl,
  n,
  ok,
  fail,
  ms: {
    min: Number(times[0]?.toFixed(1) || 0),
    p50: Number(percentile(times, 50).toFixed(1)),
    p95: Number(percentile(times, 95).toFixed(1)),
    max: Number(times[times.length - 1]?.toFixed(1) || 0),
    avg: Number(avg.toFixed(1)),
  },
}, null, 2));

