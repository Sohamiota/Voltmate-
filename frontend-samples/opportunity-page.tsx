// Sample Next.js page: pages/opportunities/[id].tsx
// Copy this into your frontend Next.js project (adjust styling and token storage).
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';

export default function OpportunityPage() {
  const router = useRouter();
  const { id } = router.query;
  const [data, setData] = useState<any>(null);
  const [dirty, setDirty] = useState(false);
  const API = process.env.NEXT_PUBLIC_API_URL || 'https://api.voltwheelsind.com';

  useEffect(() => {
    if (!id) return;
    const token = localStorage.getItem('token') || '';
    fetch(`${API}/api/v1/opportunities/${id}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(r => r.json())
      .then(setData)
      .catch(console.error);
  }, [id]);

  if (!data) return <div>Loading...</div>;

  function handleChange(field: string, value: any) {
    setData((prev: any) => ({ ...prev, [field]: value }));
    setDirty(true);
  }

  async function save() {
    const token = localStorage.getItem('token') || '';
    const res = await fetch(`${API}/api/v1/opportunities/${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(data)
    });
    if (res.ok) {
      const updated = await res.json();
      setData(updated);
      setDirty(false);
      alert('Saved');
    } else {
      const err = await res.json();
      alert('Save failed: ' + (err.error || JSON.stringify(err)));
    }
  }

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: 20 }}>
      <h1>Opportunity #{data.sl_no || data.id}</h1>

      <label>Created Date</label>
      <div>{new Date(data.created_at).toLocaleString()}</div>

      <label>Opportunity name</label>
      <input value={data.opportunity_name || ''} onChange={e => handleChange('opportunity_name', e.target.value)} />

      <label>Phone no</label>
      <input value={data.phone_no || ''} onChange={e => handleChange('phone_no', e.target.value)} />

      <label>Stage</label>
      <input value={data.stage || ''} onChange={e => handleChange('stage', e.target.value)} />

      <label>Next Connect</label>
      <input
        type="datetime-local"
        value={data.next_connect ? new Date(data.next_connect).toISOString().slice(0, 16) : ''}
        onChange={e => handleChange('next_connect', e.target.value ? new Date(e.target.value).toISOString() : null)}
      />

      <label>Last Connect</label>
      <input
        type="datetime-local"
        value={data.last_connect ? new Date(data.last_connect).toISOString().slice(0, 16) : ''}
        onChange={e => handleChange('last_connect', e.target.value ? new Date(e.target.value).toISOString() : null)}
      />

      <label>Month of Re-Connect</label>
      <input value={data.month_of_reconnect || ''} onChange={e => handleChange('month_of_reconnect', e.target.value)} />

      <label>Stage Remark</label>
      <textarea value={data.stage_remark || ''} onChange={e => handleChange('stage_remark', e.target.value)} />

      <label>Connected person</label>
      <input value={data.connected_person || ''} onChange={e => handleChange('connected_person', e.target.value)} />

      <label>Probability</label>
      <input type="number" value={data.probability || 0} onChange={e => handleChange('probability', Number(e.target.value))} />

      <label>Business Payload (JSON)</label>
      <textarea
        value={JSON.stringify(data.business_payload || {}, null, 2)}
        onChange={e => {
          try {
            const parsed = JSON.parse(e.target.value);
            handleChange('business_payload', parsed);
          } catch (err) {
            // don't update until valid JSON
          }
        }}
      />

      <label>Use Range</label>
      <input value={data.use_range || ''} onChange={e => handleChange('use_range', e.target.value)} />

      <label>Customer own vehicle</label>
      <select value={data.customer_own_vehicle ? 'yes' : 'no'} onChange={e => handleChange('customer_own_vehicle', e.target.value === 'yes')}>
        <option value="yes">Yes</option>
        <option value="no">No</option>
      </select>

      <label>Customer location</label>
      <input value={data.customer_location || ''} onChange={e => handleChange('customer_location', e.target.value)} />

      <label>Vehicle Suggested Action</label>
      <input value={data.vehicle_suggested_action || ''} onChange={e => handleChange('vehicle_suggested_action', e.target.value)} />

      <label>Distributor / Manufacturer</label>
      <input value={data.distributor_manufacturer || ''} onChange={e => handleChange('distributor_manufacturer', e.target.value)} />

      <div style={{ marginTop: 20 }}>
        <button onClick={() => router.back()}>Close</button>
        <button onClick={save} disabled={!dirty} style={{ marginLeft: 10 }}>
          Save
        </button>
      </div>
    </div>
  );
}

