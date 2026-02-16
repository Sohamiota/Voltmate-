const fetch = global.fetch || require('node-fetch');
(async () => {
  try {
    const res = await fetch('http://localhost:8081/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'localadmin@example.com', password: 'AdminPass123' }),
    });
    const text = await res.text();
    console.log('status', res.status);
    console.log(text);
  } catch (e) {
    console.error('error', e);
  }
})();

