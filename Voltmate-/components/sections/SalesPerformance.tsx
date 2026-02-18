 'use client'

import React, { useEffect, useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { TrendingUp, Award, Target } from 'lucide-react'
import Link from 'next/link'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8081';

function getToken() {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('auth_token') || localStorage.getItem('token') || '';
}

export default function SalesPerformance() {
  const [visits, setVisits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const token = getToken();
        const res = await fetch(`${API_BASE}/api/v1/visits`, {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined
        });
        if (!res.ok) {
          const txt = await res.text().catch(() => '');
          throw new Error(`API ${res.status} ${txt}`);
        }
        const j = await res.json();
        setVisits(j.visits || []);
      } catch (e: any) {
        console.error('fetch visits error', e);
        setError(e?.message || 'failed');
        setVisits([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // aggregate visits by salesperson for the chart
  const salesData = useMemo(() => {
    const map = new Map<string, { name: string; sales: number; target: number }>();
    for (const v of visits) {
      const name = v.salesperson_name || 'Unknown';
      const entry = map.get(name) || { name, sales: 0, target: 10 };
      // count visits as a proxy for "sales" here
      entry.sales += 1;
      map.set(name, entry);
    }
    return Array.from(map.values()).map(e => ({ ...e, commission: Math.round(e.sales * 1000 * 0.1) }));
  }, [visits]);

  return (
    <div className="space-y-6">
      {/* Quick actions */}
      <div className="flex gap-3">
        <Link href="/sales/lead-report" className="px-4 py-2 rounded-lg bg-primary text-primary-foreground font-medium">View Lead Report</Link>
        <Link href="/sales/visit-report" className="px-4 py-2 rounded-lg bg-secondary text-white font-medium">View Visit Report</Link>
        <Link href="/sales/create-lead-report" className="px-4 py-2 rounded-lg border border-border text-foreground font-medium">Create New Lead Report</Link>
        <Link href="/sales/create-visit-report" className="px-4 py-2 rounded-lg border border-border text-foreground font-medium">Create New Visit Report</Link>
      </div>
      <div>
        <h1 className="text-3xl font-bold text-foreground">Sales Performance</h1>
        <p className="text-muted-foreground">Track individual and team sales metrics</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-card border border-border rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-foreground">Total Sales</h3>
            <TrendingUp className="w-5 h-5 text-primary" />
          </div>
          <p className="text-3xl font-bold text-foreground mb-2">{salesData.length ? `$${salesData.reduce((s:any, e:any)=>s+ (e.sales||0),0).toLocaleString()}` : '-'}</p>
          <p className="text-sm text-green-400">{salesData.length ? '+18% vs last month' : ''}</p>
        </div>

        <div className="bg-card border border-border rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-foreground">Top Performer</h3>
            <Award className="w-5 h-5 text-secondary" />
          </div>
          <p className="text-3xl font-bold text-foreground mb-2">Sarah Smith</p>
          <p className="text-sm text-secondary">$15,200 in sales</p>
        </div>

        <div className="bg-card border border-border rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-foreground">Target Progress</h3>
            <Target className="w-5 h-5 text-primary" />
          </div>
          <p className="text-3xl font-bold text-foreground mb-2">114%</p>
          <p className="text-sm text-green-400">Team target met</p>
        </div>
      </div>

      {/* Chart */}
      <div className="bg-card border border-border rounded-xl p-6">
        <h2 className="text-lg font-bold text-foreground mb-6">Sales by Employee</h2>
          {salesData.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground">No sales data available</div>
          ) : (
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={salesData} margin={{ top: 20, right: 30, left: 0, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" />
                <YAxis stroke="hsl(var(--muted-foreground))" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                  labelStyle={{ color: 'hsl(var(--foreground))' }}
                />
                <Legend />
                <Bar dataKey="sales" fill="hsl(var(--primary))" name="Sales" />
                <Bar dataKey="target" fill="hsl(var(--secondary))" name="Target" opacity={0.5} />
              </BarChart>
            </ResponsiveContainer>
          )}
      </div>

      {/* Commission Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="p-6 border-b border-border">
          <h2 className="text-lg font-bold text-foreground">Commission Breakdown</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-secondary border-b border-border">
              <tr>
                <th className="text-left px-6 py-4 font-semibold text-foreground">Employee</th>
                <th className="text-left px-6 py-4 font-semibold text-foreground">Sales</th>
                <th className="text-left px-6 py-4 font-semibold text-foreground">Commission (10%)</th>
                <th className="text-left px-6 py-4 font-semibold text-foreground">Status</th>
              </tr>
            </thead>
            <tbody>
              {salesData.map((employee, index) => (
                <tr key={index} className={index !== salesData.length - 1 ? 'border-b border-border' : ''}>
                  <td className="px-6 py-4 font-medium text-foreground">{employee.name}</td>
                  <td className="px-6 py-4 text-foreground">${employee.sales.toLocaleString()}</td>
                  <td className="px-6 py-4 text-primary font-semibold">${employee.commission.toLocaleString()}</td>
                  <td className="px-6 py-4">
                    <span className="px-3 py-1 rounded-full text-xs font-semibold bg-green-500/20 text-green-400">
                      {employee.sales >= employee.target ? 'On Target' : 'Below Target'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
