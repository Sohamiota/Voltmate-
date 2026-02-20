'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, PieChart, Pie, Cell,
} from 'recharts';
import { TrendingUp, Award, Target, FileText, RefreshCw, Users } from 'lucide-react';
import Link from 'next/link';

const API_BASE = (process.env.NEXT_PUBLIC_API_URL ||
  (typeof window !== 'undefined' && window.location.hostname !== 'localhost'
    ? 'https://voltmate.onrender.com'
    : 'http://localhost:8081')).replace(/\/api\/v1\/?$/, '');

function getToken() {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('auth_token') || localStorage.getItem('token') || '';
}

const CHART_COLORS = ['#00d9ff', '#7c3aed', '#22c55e', '#f59e0b', '#ef4444', '#ec4899', '#14b8a6', '#f97316'];

const STATUS_BADGE: Record<string, string> = {
  'Booking Amount Received': 'bg-green-500/15 text-green-400 border-green-500/25',
  'Negotiation':             'bg-yellow-500/15 text-yellow-400 border-yellow-500/25',
  'Quotation Shared':        'bg-blue-500/15 text-blue-400 border-blue-500/25',
  'Demo Completed':          'bg-purple-500/15 text-purple-400 border-purple-500/25',
  'New Lead':                'bg-gray-500/15 text-gray-400 border-gray-500/25',
};
function statusClass(s: string) {
  return STATUS_BADGE[s] || 'bg-gray-500/15 text-gray-400 border-gray-500/25';
}

function fmtDate(d?: string) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

const tooltipStyle = {
  contentStyle: { backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' },
  labelStyle: { color: 'hsl(var(--foreground))' },
};

export default function SalesPerformance() {
  const [leads,   setLeads]   = useState<any[]>([]);
  const [visits,  setVisits]  = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');

  const fetchAll = useCallback(async () => {
    const token = getToken();
    setLoading(true);
    setError('');
    try {
      const [leadsRes, visitsRes] = await Promise.all([
        fetch(`${API_BASE}/api/v1/leads?limit=500`,  { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_BASE}/api/v1/visits?limit=500`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      const [lj, vj] = await Promise.all([leadsRes.json(), visitsRes.json()]);
      setLeads(lj.leads   || []);
      setVisits(vj.visits || []);
    } catch (e: any) {
      setError(e?.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ── Derived data ─────────────────────────────────────────────────────────────

  // visits per salesperson → bar chart
  const visitsBySalesperson = useMemo(() => {
    const map: Record<string, number> = {};
    for (const v of visits) {
      const name = v.salesperson_name || 'Unassigned';
      map[name] = (map[name] || 0) + 1;
    }
    return Object.entries(map)
      .map(([name, count]) => ({ name, visits: count }))
      .sort((a, b) => b.visits - a.visits);
  }, [visits]);

  // leads by type → pie / bar
  const leadsByType = useMemo(() => {
    const map: Record<string, number> = {};
    for (const l of leads) {
      const t = l.lead_type || 'Unknown';
      map[t] = (map[t] || 0) + 1;
    }
    return Object.entries(map).map(([type, count], i) => ({
      type, count, color: CHART_COLORS[i % CHART_COLORS.length],
    }));
  }, [leads]);

  // top salesperson by visit count
  const topSalesperson = useMemo(() => {
    if (!visitsBySalesperson.length) return null;
    return visitsBySalesperson[0];
  }, [visitsBySalesperson]);

  // conversion: leads that have at least one visit
  const leadsWithVisits = useMemo(() => {
    const visitedCodes = new Set(visits.map(v => v.lead_cust_code).filter(Boolean));
    return leads.filter(l => visitedCodes.has(l.cust_code)).length;
  }, [leads, visits]);

  const conversionRate = leads.length > 0 ? Math.round((leadsWithVisits / leads.length) * 100) : 0;

  const recentLeads  = leads.slice(0, 10);
  const recentVisits = visits.slice(0, 10);

  return (
    <div className="space-y-6">

      {/* Quick action buttons */}
      <div className="flex flex-wrap gap-2">
        <Link href="/sales/lead-report"
          className="px-4 py-2 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:opacity-90 transition-opacity">
          View Lead Report
        </Link>
        <Link href="/sales/visit-report"
          className="px-4 py-2 rounded-lg bg-secondary text-white font-medium text-sm hover:opacity-90 transition-opacity">
          View Visit Report
        </Link>
        <Link href="/sales/create-lead-report"
          className="px-4 py-2 rounded-lg border border-border text-foreground font-medium text-sm hover:bg-secondary transition-colors">
          Create New Lead Report
        </Link>
        <Link href="/sales/create-visit-report"
          className="px-4 py-2 rounded-lg border border-border text-foreground font-medium text-sm hover:bg-secondary transition-colors">
          Create New Visit Report
        </Link>
        <button onClick={fetchAll} disabled={loading}
          className="ml-auto flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:border-foreground transition-colors text-sm">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Sales Performance</h1>
        <p className="text-muted-foreground text-sm mt-1">Live data from lead reports and visit reports</p>
      </div>

      {error && (
        <div className="bg-destructive/10 border border-destructive/30 rounded-xl p-4 text-sm text-destructive">{error}</div>
      )}

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-card border border-border rounded-xl p-3 sm:p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Total Leads</p>
            <FileText className="w-4 h-4 text-primary" />
          </div>
          <p className="text-3xl font-bold text-primary">{loading ? '…' : leads.length}</p>
          <p className="text-xs text-muted-foreground mt-1">All lead reports</p>
        </div>

        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Total Visits</p>
            <TrendingUp className="w-4 h-4 text-secondary" />
          </div>
          <p className="text-3xl font-bold text-secondary">{loading ? '…' : visits.length}</p>
          <p className="text-xs text-muted-foreground mt-1">All visit reports</p>
        </div>

        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Top Salesperson</p>
            <Award className="w-4 h-4 text-yellow-400" />
          </div>
          {loading ? (
            <p className="text-xl font-bold text-foreground">…</p>
          ) : topSalesperson ? (
            <>
              <p className="text-xl font-bold text-foreground truncate">{topSalesperson.name}</p>
              <p className="text-xs text-yellow-400 mt-1">{topSalesperson.visits} visit{topSalesperson.visits !== 1 ? 's' : ''}</p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground mt-2">No data yet</p>
          )}
        </div>

        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Lead Conversion</p>
            <Target className="w-4 h-4 text-green-400" />
          </div>
          <p className="text-3xl font-bold text-green-400">{loading ? '…' : `${conversionRate}%`}</p>
          <p className="text-xs text-muted-foreground mt-1">{leadsWithVisits} of {leads.length} leads visited</p>
        </div>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Visits by Salesperson */}
        <div className="bg-card border border-border rounded-xl p-4 sm:p-6">
          <h2 className="text-sm sm:text-base font-semibold text-foreground mb-1">Visits by Salesperson</h2>
          <p className="text-xs text-muted-foreground mb-4">From visit report data</p>
          {loading ? (
            <div className="py-12 text-center text-muted-foreground text-sm">Loading…</div>
          ) : visitsBySalesperson.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground text-sm">No visit data yet.</div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={visitsBySalesperson} margin={{ top: 5, right: 10, left: -10, bottom: 40 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))"
                  tick={{ fontSize: 10 }} angle={-30} textAnchor="end" interval={0} />
                <YAxis stroke="hsl(var(--muted-foreground))" allowDecimals={false} tick={{ fontSize: 10 }} width={28} />
                <Tooltip {...tooltipStyle} formatter={(v: any) => [v, 'Visits']} />
                <Bar dataKey="visits" fill="#00d9ff" radius={[4, 4, 0, 0]} name="Visits" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Leads by Type */}
        <div className="bg-card border border-border rounded-xl p-4 sm:p-6">
          <h2 className="text-sm sm:text-base font-semibold text-foreground mb-1">Leads by Type</h2>
          <p className="text-xs text-muted-foreground mb-4">From lead report data</p>
          {loading ? (
            <div className="py-12 text-center text-muted-foreground text-sm">Loading…</div>
          ) : leadsByType.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground text-sm">No lead data yet.</div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={210}>
                <PieChart>
                  <Pie data={leadsByType} dataKey="count" nameKey="type"
                    cx="50%" cy="50%" outerRadius="70%"
                    label={({ percent }) => `${(percent * 100).toFixed(0)}%`}
                    labelLine={false}>
                    {leadsByType.map((e, i) => <Cell key={i} fill={e.color} />)}
                  </Pie>
                  <Tooltip {...tooltipStyle} formatter={(v: any, n: any) => [v, n]} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap gap-2 mt-2">
                {leadsByType.map(d => (
                  <div key={d.type} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span className="w-2.5 h-2.5 rounded-full inline-block flex-shrink-0" style={{ background: d.color }} />
                    {d.type}: {d.count}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Recent Lead Report table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-border">
          <h2 className="text-sm sm:text-base font-semibold text-foreground">Recent Lead Reports</h2>
          <Link href="/sales/lead-report" className="text-xs text-primary hover:underline">View all →</Link>
        </div>
        <div className="overflow-x-auto">
          {loading ? (
            <div className="py-10 text-center text-muted-foreground text-sm">Loading…</div>
          ) : recentLeads.length === 0 ? (
            <div className="py-10 text-center text-muted-foreground text-sm">No lead reports found.</div>
          ) : (
            <table className="w-full" style={{ minWidth: 560 }}>
              <thead>
                <tr className="border-b border-border bg-secondary/40">
                  {['Cust Code','Customer Name','Business','Lead Type','Phone','Date'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recentLeads.map((l, i) => (
                  <tr key={l.id} className={`${i !== recentLeads.length - 1 ? 'border-b border-border/50' : ''} hover:bg-secondary/30 transition-colors`}>
                    <td className="px-4 py-3 text-xs font-mono text-muted-foreground whitespace-nowrap">{l.cust_code || '—'}</td>
                    <td className="px-4 py-3 font-medium text-foreground text-sm whitespace-nowrap">{l.cust_name || '—'}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{l.business || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2 py-0.5 rounded text-xs border whitespace-nowrap ${l.lead_type === 'Digital Lead' ? 'bg-blue-500/15 text-blue-400 border-blue-500/25' : 'bg-gray-500/15 text-gray-400 border-gray-500/25'}`}>
                        {l.lead_type || '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">{l.phone_no || '—'}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">{fmtDate(l.connect_date)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Recent Visit Report table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-border">
          <h2 className="text-sm sm:text-base font-semibold text-foreground">Recent Visit Reports</h2>
          <Link href="/sales/visit-report" className="text-xs text-primary hover:underline">View all →</Link>
        </div>
        <div className="overflow-x-auto">
          {loading ? (
            <div className="py-10 text-center text-muted-foreground text-sm">Loading…</div>
          ) : recentVisits.length === 0 ? (
            <div className="py-10 text-center text-muted-foreground text-sm">No visit reports found.</div>
          ) : (
            <table className="w-full" style={{ minWidth: 640 }}>
              <thead>
                <tr className="border-b border-border bg-secondary/40">
                  {['Customer','Cust Code','Salesperson','Vehicle','Status','Visit Date','Next Action'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recentVisits.map((v, i) => (
                  <tr key={v.id} className={`${i !== recentVisits.length - 1 ? 'border-b border-border/50' : ''} hover:bg-secondary/30 transition-colors`}>
                    <td className="px-4 py-3 font-medium text-foreground text-sm whitespace-nowrap">{v.cust_name || '—'}</td>
                    <td className="px-4 py-3 text-xs font-mono text-muted-foreground whitespace-nowrap">{v.lead_cust_code || '—'}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">{v.salesperson_name || '—'}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">{v.vehicle || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs border whitespace-nowrap ${statusClass(v.status || '')}`}>
                        {v.status || '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">{fmtDate(v.visit_date)}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground max-w-[160px] truncate" title={v.next_action || ''}>{v.next_action || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

    </div>
  );
}
