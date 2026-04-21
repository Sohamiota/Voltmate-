import { useEffect, useState } from 'react';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8081';

export default function AttendancePage() {
  const [current, setCurrent] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const [network, setNetwork] = useState<{ allowed: boolean; label: string | null; checked: boolean }>({ allowed: false, label: null, checked: false });

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;

  useEffect(() => {
    fetchCurrent();
    fetchHistory();
    fetchNetworkStatus();
    // eslint-disable-next-line
  }, []);

  async function fetchNetworkStatus() {
    if (!token) return;
    try {
      const res = await fetch(`${API}/api/v1/networks/status`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const j = await res.json();
        setNetwork({ allowed: !!j.allowed, label: j.label || null, checked: true });
      } else {
        setNetwork({ allowed: false, label: null, checked: true });
      }
    } catch {
      setNetwork({ allowed: false, label: null, checked: true });
    }
  }

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
    if (!network.allowed && network.checked) {
      alert('You must be connected to the office network to clock in.');
      return;
    }
    setBusy(true);
    const res = await fetch(`${API}/api/v1/attendance/clockin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ note: 'Clock in via UI' }),
    });
    if (res.ok) {
      await fetchCurrent();
      await fetchHistory();
    } else {
      let msg = 'Clock in failed';
      try {
        const j = await res.json();
        if (j.error === 'not_on_office_network') {
          msg = 'Not on office network — connect to the office WiFi and try again.';
          setNetwork(prev => ({ ...prev, allowed: false }));
        } else {
          msg = j.message || j.error || msg;
        }
      } catch { msg = await res.text() || msg; }
      alert(msg);
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

  const netColor = network.allowed ? '#22c55e' : '#ef4444';

  return (
    <div style={{ padding: 24 }}>
      <h1>Attendance</h1>

      {/* Network status badge */}
      {network.checked && (
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '5px 12px', borderRadius: 20, fontSize: 13, fontWeight: 500,
          border: `1px solid ${netColor}`, color: netColor,
          background: network.allowed ? 'rgba(34,197,94,.08)' : 'rgba(239,68,68,.08)',
          marginBottom: 16,
        }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: netColor, display: 'inline-block' }} />
          {network.allowed
            ? `On office network${network.label ? ` · ${network.label}` : ''} — ready to clock in`
            : 'Not on office network — connect to office WiFi to clock in'}
        </div>
      )}

      {loading ? <div>Loading...</div> : (
        <>
          <div style={{ marginBottom: 16 }}>
            {current ? (
              <div>
                <div>Clocked in at: {new Date(current.clock_in_at).toLocaleString()}</div>
                <button onClick={clockOut} disabled={busy}>Clock Out</button>
              </div>
            ) : (
              <button
                onClick={clockIn}
                disabled={busy || (network.checked && !network.allowed)}
                title={network.checked && !network.allowed ? 'Connect to the office network first' : undefined}
              >
                Clock In
              </button>
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

