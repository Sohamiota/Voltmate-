'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import PageHeader from '@/components/PageHeader';
import { getBackNavigation, getBreadcrumbsForPath } from '@/lib/navigation';
import { AnalyticsData, fetchAnalytics, fmtDate } from '@/lib/serviceManagerApi';
import DatePickerField from '@/components/DatePickerField';
import { monthsAgoIso, todayIso } from '@/lib/dates';

export default function ServiceAnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [from, setFrom] = useState(() => monthsAgoIso(3));
  const [to, setTo] = useState(() => todayIso());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await fetchAnalytics(from, to));
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="min-h-screen bg-[#0a0c12] text-[#e8edf5] font-sans">
      <div className="px-7 py-8 max-w-[1200px] mx-auto">
        <PageHeader
          variant="dark"
          title="Service Analytics"
          description="Completion throughput, costs, and fleet health"
          backHref={getBackNavigation('/service-manager/analytics')?.href ?? '/service-manager'}
          backLabel="Back to Service Manager"
          breadcrumbs={getBreadcrumbsForPath('/service-manager/analytics')}
        />

        <div className="flex flex-wrap gap-2 mb-6 items-end">
          <div className="min-w-[160px]">
            <label className="text-[10px] uppercase text-[#545968] font-bold">From</label>
            <DatePickerField
              value={from}
              onChange={setFrom}
              max={to}
              className="mt-1 bg-[#0f1117] border-[#1e2236] rounded-lg text-sm"
            />
          </div>
          <div className="min-w-[160px]">
            <label className="text-[10px] uppercase text-[#545968] font-bold">To</label>
            <DatePickerField
              value={to}
              onChange={setTo}
              min={from}
              className="mt-1 bg-[#0f1117] border-[#1e2236] rounded-lg text-sm"
            />
          </div>
          <button type="button" onClick={load} className="text-xs font-semibold px-3 py-2 rounded-lg bg-cyan-400 text-[#0a0c12]">Apply</button>
          <Link href="/service-manager/vehicles" className="text-xs font-semibold px-3 py-2 rounded-lg border border-[#1e2236] text-[#8e97ad]">Vehicles</Link>
        </div>

        {loading ? (
          <div className="text-center py-12 text-[#8e97ad]">Loading analytics…</div>
        ) : data ? (
          <>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-3 mb-8">
              <StatCard label="Completions" value={String(data.completions.count)} />
              <StatCard label="Total cost" value={`₹${Math.round(data.completions.total_cost).toLocaleString('en-IN')}`} />
              <StatCard label="Avg cost" value={`₹${Math.round(data.completions.avg_cost).toLocaleString('en-IN')}`} />
              <StatCard label="Fleet overdue" value={`${data.fleet_health.overdue_pct}%`} />
              <StatCard label="Open alerts" value={String(data.alerts_workload.open)} />
            </div>

            <Section title="Monthly completions">
              {data.by_month.length === 0 ? (
                <EmptyRow />
              ) : (
                <table className="w-full text-sm">
                  <thead><tr><th className={thCls}>Month</th><th className={thCls}>Completions</th><th className={thCls}>Cost</th></tr></thead>
                  <tbody>
                    {data.by_month.map(r => (
                      <tr key={r.month} className="border-b border-[#1e2236]/60">
                        <td className={tdCls}>{r.month}</td>
                        <td className={tdCls}>{r.completions}</td>
                        <td className={tdCls}>₹{Math.round(parseFloat(String(r.total_cost))).toLocaleString('en-IN')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Section>

            <div className="grid md:grid-cols-2 gap-6 mt-6">
              <Section title="By location">
                {data.by_location.slice(0, 8).map(r => (
                  <div key={r.location || 'unknown'} className="flex justify-between py-2 border-b border-[#1e2236]/40 text-sm">
                    <span>{r.location || 'Unknown'}</span>
                    <span className="font-mono text-[#8e97ad]">{r.completions} · ₹{Math.round(parseFloat(String(r.total_cost))).toLocaleString('en-IN')}</span>
                  </div>
                ))}
              </Section>
              <Section title="By vehicle type">
                {data.by_vehicle_type.slice(0, 8).map(r => (
                  <div key={r.vehicle_type || 'unknown'} className="flex justify-between py-2 border-b border-[#1e2236]/40 text-sm">
                    <span>{r.vehicle_type || 'Unknown'}</span>
                    <span className="font-mono text-[#8e97ad]">{r.completions} · ₹{Math.round(parseFloat(String(r.total_cost))).toLocaleString('en-IN')}</span>
                  </div>
                ))}
              </Section>
            </div>

            <Section title="Fleet health" className="mt-6">
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>Total vehicles: <strong>{data.fleet_health.total_vehicles}</strong></div>
                <div>Overdue: <strong className="text-[#f43f5e]">{data.fleet_health.overdue_vehicles}</strong></div>
                <div>No pending service: <strong>{data.fleet_health.no_pending_service}</strong></div>
              </div>
              <div className="text-xs text-[#8e97ad] mt-2">Range {fmtDate(data.range.from)} – {fmtDate(data.range.to)}</div>
            </Section>
          </>
        ) : (
          <div className="text-[#f43f5e]">Failed to load analytics</div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-[#0f1117] border border-[#1e2236] rounded-xl p-4">
      <div className="text-[10px] font-bold uppercase text-[#545968] mb-1">{label}</div>
      <div className="text-xl font-extrabold font-mono text-cyan-400">{value}</div>
    </div>
  );
}

function Section({ title, children, className = '' }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-[#0f1117] border border-[#1e2236] rounded-xl p-5 ${className}`}>
      <div className="text-sm font-bold mb-4">{title}</div>
      {children}
    </div>
  );
}

function EmptyRow() {
  return <div className="text-sm text-[#545968]">No data in selected range</div>;
}

const thCls = 'text-left py-2 text-[10px] uppercase text-[#545968] font-bold';
const tdCls = 'py-2';
