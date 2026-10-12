// Temporary end-to-end API verification script
const BASE = 'http://localhost:3100';

async function post(path, body, raw) {
  const res = await fetch(BASE + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: raw !== undefined ? raw : JSON.stringify(body),
  });
  let data;
  try { data = await res.json(); } catch { data = { nonJson: true }; }
  return { status: res.status, data };
}

(async () => {
  const results = [];
  const check = (name, cond) => results.push(`${cond ? 'PASS' : 'FAIL'}  ${name}`);

  const future = new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10);

  let r = await post('/api/reservations', { name: 'A', email: '@.com', date: future, time: '18:00', guests: 2 });
  check('rejects invalid email (@.com) -> 400', r.status === 400);

  r = await post('/api/reservations', { name: 'A', email: 'a@b.com', date: future, time: '18:00', guests: 999 });
  check('rejects guests 999 -> 400', r.status === 400);

  r = await post('/api/reservations', { name: 'A', email: 'a@b.com', date: '2020-01-01', time: '18:00', guests: 2 });
  check('rejects past date -> 400', r.status === 400);

  r = await post('/api/reservations', { name: 'A', email: 'a@b.com', date: future, time: '25:00', guests: 2 });
  check('rejects invalid time 25:00 -> 400', r.status === 400);

  r = await post('/api/reservations', { name: 'A', email: 'a@b.com', date: '2026-02-31', time: '18:00', guests: 2 });
  check('rejects nonexistent date 2026-02-31 -> 400', r.status === 400);

  r = await post('/api/reservations', { name: 'A', email: 'a@b.com', date: future, time: '18:00', guests: 'abc' });
  check('rejects non-numeric guests -> 400', r.status === 400);

  r = await post('/api/reservations', undefined, '{bad json');
  check('rejects malformed JSON -> 400 JSON response', r.status === 400 && !r.data.nonJson);

  r = await post('/api/reservations', { name: 'Jane Test', email: 'jane@example.com', date: future, time: '18:00', guests: 2, phone: '555', requests: 'window' });
  check('accepts valid reservation -> 201 + id', r.status === 201 && typeof r.data.reservationId === 'number');

  r = await post('/api/newsletter', { email: 'foo' });
  check('newsletter rejects bad email -> 400', r.status === 400);

  r = await post('/api/newsletter', { email: 'verify-e2e@example.com' });
  check('newsletter accepts valid email -> 201', r.status === 201);

  const nf = await fetch(BASE + '/api/nope');
  check('unknown /api route -> JSON 404', nf.status === 404);

  console.log(results.join('\n'));
  const failed = results.some(x => x.startsWith('FAIL'));
  process.exit(failed ? 1 : 0);
})();
