import { useEffect, useState } from 'react';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8081';

export default function AttendancePage() {
  const [current, setCurrent] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;

  useEffect(() => {
    fetchCurrent();
    fetchHistory();
    // eslint-disable-next-line
  }, []);

  async function fetchCurrent() {
    if (!token) return setLoading(false);
    setLoading(true);
    const res = await fetch(`${API}/api/v1/attendance/current`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.status === 204) {
      setCurrent(null);
    } else {
      setCurrent(await res.json());
    }
    setLoading(false);
  }

  async function fetchHistory() {
    if (!token) return;
    const res = await fetch(`${API}/api/v1/attendance?limit=20`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const j = await res.json();
    setHistory(j.attendance || []);
  }

  async function clockIn() {
    setBusy(true);
    const res = await fetch(`${API}/api/v1/attendance/clockin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ location: 'Office', note: 'Clock in via UI' }),
    });
    if (res.ok) {
      await fetchCurrent();
      await fetchHistory();
    } else {
      const txt = await res.text();
      alert('Clock in failed: ' + txt);
    }
    setBusy(false);
  }

  async function clockOut() {
    setBusy(true);
    const res = await fetch(`${API}/api/v1/attendance/clockout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ note: 'Clock out via UI' }),
    });
    if (res.ok) {
      await fetchCurrent();
      await fetchHistory();
    } else {
      const txt = await res.text();
      alert('Clock out failed: ' + txt);
    }
    setBusy(false);
  }

  return (
    <div style={{ padding: 24 }}>
      <h1>Attendance</h1>
      {loading ? <div>Loading...</div> : (
        <>
          <div style={{ marginBottom: 16 }}>
            {current ? (
              <div>
                <div>Clocked in at: {new Date(current.clock_in_at).toLocaleString()}</div>
                <button onClick={clockOut} disabled={busy}>Clock Out</button>
              </div>
            ) : (
              <button onClick={clockIn} disabled={busy}>Clock In</button>
            )}
          </div>

          <h2>Recent Attendance</h2>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th>Date</th><th>In</th><th>Out</th><th>Duration (s)</th><th>Status</th>
              </tr>
            </thead>
            <tbody>
              {history.map(a => (
                <tr key={a.id}>
                  <td>{a.date}</td>
                  <td>{a.clock_in_at ? new Date(a.clock_in_at).toLocaleString() : ''}</td>
                  <td>{a.clock_out_at ? new Date(a.clock_out_at).toLocaleString() : ''}</td>
                  <td>{a.duration_seconds || ''}</td>
                  <td>{a.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}

