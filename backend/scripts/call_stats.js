const fetch = require('node-fetch');
(async () => {
  try {
    const res = await fetch('http://127.0.0.1:8081/api/v1/attendance/stats', {
      headers: { Authorization: 'Bearer ' + process.argv[2] },
    });
    console.log('status', res.status);
    const text = await res.text();
    console.log('body', text);
  } catch (e) {
    console.error('err', e.message);
  }
})();

