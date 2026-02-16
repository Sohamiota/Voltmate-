const fetch = global.fetch || require('node-fetch');
const API = 'http://localhost:8081';
(async () => {
  // login
  const loginRes = await fetch(`${API}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'localadmin@example.com', password: 'AdminPass123' }),
  });
  console.log('login status', loginRes.status);
  const loginText = await loginRes.text();
  console.log('login body', loginText);
  let token = null;
  try { token = JSON.parse(loginText).token; } catch(e) {}
  if (!token) return;

  // clockin raw
  const r = await fetch(`${API}/api/v1/attendance/clockin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ location: 'Office', note: 'debug', needs_approval: true }),
  });
  console.log('clockin status', r.status);
  console.log('clockin body text:');
  console.log(await r.text());
})();

