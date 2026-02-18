'use client'

import { useEffect, useState } from 'react';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8081';

export default function AdminAttendancePage() {
  const [list, setList] = useState<any[]>([]);
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') || localStorage.getItem('auth_token') : null;

  useEffect(() => {
    fetchList();
  }, []);

  async function fetchList() {
    const res = await fetch(`${API}/api/v1/attendance?limit=100`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const j = await res.json();
    setList(j.attendance || []);
  }

  async function approve(id: number, approve: boolean) {
    const res = await fetch(`${API}/api/v1/attendance/admin/${id}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ approve }),
    });
    if (res.ok) fetchList();
    else alert('approve failed: ' + await res.text());
  }

  return (
    <div style={{ padding: 24 }}>
      <h1>Admin Attendance</h1>
      <table style={{ width: '100%' }}>
        <thead>
          <tr><th>ID</th><th>User</th><th>In</th><th>Out</th><th>Duration</th><th>Status</th><th>Actions</th></tr>
        </thead>
        <tbody>
          {list.map(a => (
            <tr key={a.id}>
              <td>{a.id}</td>
              <td>{a.user_id}</td>
              <td>{a.clock_in_at}</td>
              <td>{a.clock_out_at}</td>
              <td>{a.duration_seconds}</td>
              <td>{a.status}</td>
              <td>
                <button onClick={() => approve(a.id, true)}>Approve</button>
                <button onClick={() => approve(a.id, false)} style={{ marginLeft: 8 }}>Reject</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

