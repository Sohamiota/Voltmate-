const fetch = global.fetch || require('node-fetch');
const API = 'http://localhost:8081';

async function run() {
  try {
    // login
    let res = await fetch(`${API}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'localadmin@example.com', password: 'AdminPass123' }),
    });
    const loginBody = await res.json();
    if (!loginBody.token) {
      console.error('Login failed', res.status, loginBody);
      return process.exit(1);
    }
    const token = loginBody.token;
    console.log('Got token');

    // list opportunities
    res = await fetch(`${API}/api/v1/opportunities?limit=10`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const listBody = await res.json();
    console.log('List response:', listBody.opportunities ? listBody.opportunities.length + ' items' : listBody);

    // pick first opportunity id
    const first = listBody.opportunities && listBody.opportunities[0];
    if (!first) {
      console.log('No opportunities to test further. Insert one in DB and re-run.');
      return;
    }
    const id = first.id;
    console.log('Testing opportunity id', id);

    // get single
    res = await fetch(`${API}/api/v1/opportunities/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    console.log('GET /opportunities/:id status', res.status);
    const single = await res.json();
    console.log('Before update:', single);

    // patch update
    res = await fetch(`${API}/api/v1/opportunities/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ stage: 'UpdatedStage', stage_remark: 'Updated by smoke test' }),
    });
    console.log('PATCH status', res.status);
    const patched = await res.json();
    console.log('After update:', patched);

    console.log('Smoke tests completed');
  } catch (e) {
    console.error('Smoke test error', e);
    process.exit(1);
  }
}

run();

