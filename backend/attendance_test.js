const fetch = global.fetch || require('node-fetch');
const API = 'http://localhost:8081';

async function login() {
  const res = await fetch(`${API}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'localadmin@example.com', password: 'AdminPass123' }),
  });
  return res.json();
}

async function run() {
  try {
    const loginBody = await login();
    if (!loginBody.token) {
      console.error('Login failed', loginBody);
      process.exit(1);
    }
    const token = loginBody.token;
    console.log('Logged in, token length:', token.length);

    // Clock in
    let res = await fetch(`${API}/api/v1/attendance/clockin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ location: 'Office', note: 'Attendance test', needs_approval: true }),
    });
    console.log('Clockin status', res.status);
    const clockin = await res.json();
    console.log('Clockin result', clockin);

    // Current
    res = await fetch(`${API}/api/v1/attendance/current`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    console.log('Current status', res.status);
    const current = await res.json();
    console.log('Current', current);

    // Clock out
    res = await fetch(`${API}/api/v1/attendance/clockout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ note: 'Checkout test' }),
    });
    console.log('Clockout status', res.status);
    const clockout = await res.json();
    console.log('Clockout', clockout);

    // Admin approve the record (use admin)
    const attendanceId = clockout.id;
    res = await fetch(`${API}/api/v1/attendance/admin/${attendanceId}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ approve: true, note: 'Approved by admin' }),
    });
    console.log('Approve status', res.status);
    const approved = await res.json();
    console.log('Approved', approved);

    console.log('Attendance test completed');
  } catch (e) {
    console.error('Attendance test error', e);
    process.exit(1);
  }
}

run();

