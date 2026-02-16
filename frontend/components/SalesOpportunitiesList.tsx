import { useEffect, useState } from 'react';

type Opp = {
  id: number;
  sl_no?: number;
  opportunity_name?: string;
  phone_no?: string;
  stage?: string;
  created_at?: string;
};

export default function SalesOpportunitiesList() {
  const [list, setList] = useState<Opp[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all'|'salesforce'|'non-salesforce'>('all');
  const API = process.env.NEXT_PUBLIC_API_URL || 'https://api.voltwheelsind.com';

  useEffect(() => {
    async function load() {
      setLoading(true);
      const token = localStorage.getItem('token') || '';
      const params = new URLSearchParams();
      params.set('limit', '100');
      if (filter !== 'all') params.set('source', filter);
      const res = await fetch(`${API}/api/v1/opportunities?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) {
        console.error('Failed to load opportunities', await res.text());
        setList([]);
        setLoading(false);
        return;
      }
      const j = await res.json();
      setList(j.opportunities || []);
      setLoading(false);
    }
    load();
  }, [filter]);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3>Opportunities</h3>
        <div>
          <label style={{ marginRight: 8 }}>Source</label>
          <select value={filter} onChange={e => setFilter(e.target.value as any)}>
            <option value="all">All</option>
            <option value="salesforce">Salesforce</option>
            <option value="non-salesforce">Non-Salesforce</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div>Loading opportunities...</div>
      ) : list.length === 0 ? (
        <div>No opportunities</div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 12 }}>
          <thead>
            <tr>
              <th>Sl No</th>
              <th>Created</th>
              <th>Opportunity</th>
              <th>Phone</th>
              <th>Stage</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {list.map(o => (
              <tr key={o.id}>
                <td>{o.sl_no}</td>
                <td>{o.created_at ? new Date(o.created_at).toLocaleDateString() : ''}</td>
                <td>{o.opportunity_name}</td>
                <td>{o.phone_no}</td>
                <td>{o.stage}</td>
                <td>
                  <button onClick={() => window.location.href = `/opportunities/${o.id}`}>Open</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

