// Prueba de carga de RNF-04: 50 usuarios concurrentes durante 30 segundos contra la API de LOAD_TEST_URL
// La API medida debe admitir más solicitudes que su THROTTLE_LIMIT habitual, porque todas salen de una misma IP
if (!process.env.LOAD_TEST_URL) {
  throw new Error('Define LOAD_TEST_URL en .env, por ejemplo http://localhost:3000');
}
const API = `${process.env.LOAD_TEST_URL.replace(/\/$/, '')}/api`;
const USERS = 50;
const SECONDS = 30;

const login = await fetch(`${API}/auth/login`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ email: 'ignacia.perez@empresa.test', password: 'ManualVivo2026!' }),
});
if (!login.ok) {
  throw new Error(`No se pudo iniciar sesión en ${API}: ${login.status}`);
}
const { accessToken } = await login.json();
const headers = { authorization: `Bearer ${accessToken}` };
const paths = ['/search?q=retiro', '/processes', '/dashboard', '/me/onboarding'];

const samples = Object.fromEntries(paths.map((path) => [path, []]));
let errors = 0;
const end = Date.now() + SECONDS * 1000;

async function user(index) {
  let turn = index;
  while (Date.now() < end) {
    const path = paths[turn++ % paths.length];
    const start = performance.now();
    const response = await fetch(`${API}${path}`, { headers });
    await response.arrayBuffer();
    samples[path].push(performance.now() - start);
    if (!response.ok) errors++;
  }
}

await Promise.all(Array.from({ length: USERS }, (_, index) => user(index)));

const percentile = (values, p) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)];
};
const all = Object.values(samples).flat();
const rows = [...paths.map((path) => [path, samples[path]]), ['Total', all]].map(([path, values]) => ({
  ruta: path,
  solicitudes: values.length,
  p50_ms: Math.round(percentile(values, 50)),
  p95_ms: Math.round(percentile(values, 95)),
  max_ms: Math.round(values.reduce((a, b) => Math.max(a, b), 0)),
}));
console.table(rows);
console.log(`API: ${API} · Errores: ${errors} · Rendimiento: ${Math.round(all.length / SECONDS)} solicitudes por segundo`);
