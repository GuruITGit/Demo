'use client';
import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { StatCard } from '@/components/shared/stat-card';
import { UrgencyBadge } from '@/components/shared/status-badge';
import { ArrowLeft, Mail, CheckCircle2, Loader2, Undo2, Printer, FileSpreadsheet } from 'lucide-react';
import Link from 'next/link';
import { usePermissionGuard } from '@/hooks/use-permission-guard';
import { useAuthStore } from '@/stores/auth.store';
import { thaiMonthName } from '@/lib/utils';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface GroupRow { key: string; count: number; label?: string }
interface YearSummary { year: number; total: number; byStep: GroupRow[]; byUrgency: GroupRow[]; byDepartment: GroupRow[]; months: { month: number; count: number }[] }
const STEP_COLOR: Record<string, string> = { COMPLETED: 'bg-emerald-500', RETURNED: 'bg-orange-500', PENDING_CLERK: 'bg-violet-500', PENDING_MAYOR: 'bg-indigo-500' };
const cnt = (rows: GroupRow[] | undefined, key: string) => (rows ?? []).find((r) => r.key === key)?.count ?? 0;

export default function SummaryYearPage() {
  const canAccess = usePermissionGuard('correspondence:summary:Ticket');
  const { year } = useParams<{ year: string }>();
  const { user: me } = useAuthStore();
  const [deptId, setDeptId] = useState('');

  const { data: departments } = useQuery({
    queryKey: ['departments'],
    queryFn: async () => (await api.get(`/organizations/${me?.organizationId}/departments`)).data.data as any[],
    enabled: !!me?.organizationId,
  });
  const { data, isLoading } = useQuery({
    queryKey: ['ticket-summary-year', year, deptId],
    queryFn: async () => (await api.get(`/correspondence/tickets/summary/${year}/year`, { params: deptId ? { deptId } : {} })).data.data as YearSummary,
    enabled: !!year,
  });

  const exportExcel = async () => {
    const res = await api.get(`/correspondence/tickets/summary/${year}/year/excel`, { params: deptId ? { deptId } : {}, responseType: 'blob' });
    const url = URL.createObjectURL(res.data as Blob);
    const a = document.createElement('a'); a.href = url; a.download = `saraban-summary-${year}.xlsx`;
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  };

  if (!canAccess) return null;
  const completed = cnt(data?.byStep, 'COMPLETED');
  const returned = cnt(data?.byStep, 'RETURNED');
  const inProgress = (data?.total ?? 0) - completed - returned - cnt(data?.byStep, 'CANCELLED');
  const monthTrend = (data?.months ?? []).map((m) => ({ name: thaiMonthName(m.month).slice(0, 3), จำนวน: m.count, month: m.month }));
  const selCls = 'border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white';

  return (
    <div className="flex flex-col h-full">
      <Header title="รายงานสรุปสารบรรณ" />
      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        <div className="flex items-center gap-3 flex-wrap no-print">
          <Link href="/correspondence/reports"><Button variant="outline"><ArrowLeft className="h-4 w-4" />ปีอื่น</Button></Link>
          <div className="flex-1"><h1 className="text-lg font-semibold text-gray-900">สรุปสารบรรณ ปี {year} (ภาพรวมทั้งปี)</h1>
            <p className="text-xs text-gray-400">แสดงเฉพาะเรื่องที่คุณมีสิทธิ์เห็น · คลิกเดือนด้านล่างเพื่อดูรายละเอียด</p></div>
          <select className={selCls} value={deptId} onChange={(e) => setDeptId(e.target.value)}>
            <option value="">ทุกกอง</option>
            {departments?.map((d) => <option key={d.id} value={d.id}>{d.nameTh}</option>)}
          </select>
          <Button variant="outline" onClick={exportExcel}><FileSpreadsheet className="h-4 w-4" />Excel</Button>
          <Button variant="outline" onClick={() => window.print()}><Printer className="h-4 w-4" />พิมพ์ / PDF</Button>
        </div>

        {isLoading ? <p className="text-gray-400">กำลังโหลด...</p> : !data ? <p className="text-gray-400">ไม่พบข้อมูล</p> : (
          <div className="print-area space-y-5">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard title="ทั้งหมดทั้งปี" value={data.total} icon={Mail} iconColor="text-blue-600" />
              <StatCard title="เสร็จสิ้น" value={completed} icon={CheckCircle2} iconColor="text-emerald-600" />
              <StatCard title="กำลังดำเนินการ" value={Math.max(0, inProgress)} icon={Loader2} iconColor="text-amber-500" />
              <StatCard title="ตีกลับ" value={returned} icon={Undo2} iconColor="text-orange-500" />
            </div>

            {/* แนวโน้มรายเดือน */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
              <h3 className="font-semibold text-gray-900 text-sm mb-4">แนวโน้มจำนวนเรื่องรายเดือน</h3>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={monthTrend} margin={{ top: 0, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--chart-tick)' }} stroke="var(--chart-grid)" />
                  <YAxis tick={{ fontSize: 12, fill: 'var(--chart-tick)' }} stroke="var(--chart-grid)" allowDecimals={false} />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }} formatter={(v) => [`${v} เรื่อง`, 'จำนวน']} />
                  <Bar dataKey="จำนวน" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={44} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {/* แยกตามสถานะ */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                <h3 className="font-semibold text-gray-900 text-sm mb-3">แยกตามสถานะ (ขั้นตอน)</h3>
                <Breakdown rows={data.byStep} renderKey={(r) => <span className="flex items-center gap-2 text-sm text-gray-700"><span className={`h-2.5 w-2.5 rounded-full ${STEP_COLOR[r.key] || 'bg-blue-400'}`} />{r.label || r.key}</span>} />
              </div>
              {/* อันดับกอง */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                <h3 className="font-semibold text-gray-900 text-sm mb-3">อันดับกอง (รับเรื่องมากสุด)</h3>
                {(data.byDepartment ?? []).length === 0 ? <p className="text-sm text-gray-400">ไม่มีข้อมูล</p> : (
                  <table className="w-full text-sm">
                    <tbody className="divide-y divide-gray-50">
                      {data.byDepartment.map((r, i) => (
                        <tr key={r.key}>
                          <td className="py-2 w-8 text-gray-400">{i + 1}</td>
                          <td className="py-2 text-gray-800">{r.key}</td>
                          <td className="py-2 text-right font-semibold text-gray-900">{r.count.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            {/* ลิงก์เดือน */}
            <div>
              <h3 className="font-semibold text-gray-900 text-sm mb-3 no-print">ดูรายเดือน</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => {
                  const c = data.months.find((x) => x.month === m)?.count ?? 0;
                  const empty = c === 0;
                  return (
                    <Link key={m} href={empty ? '#' : `/correspondence/reports/${year}/${m}`} onClick={(e) => { if (empty) e.preventDefault(); }}
                      className={`rounded-xl border p-3 text-center transition ${empty ? 'border-gray-100 bg-gray-50 cursor-default' : 'border-gray-200 bg-white hover:border-blue-400 hover:shadow-sm'}`}>
                      <p className={`text-sm font-medium ${empty ? 'text-gray-400' : 'text-gray-800'}`}>{thaiMonthName(m)}</p>
                      <p className={`text-lg font-bold ${empty ? 'text-gray-300' : 'text-blue-600'}`}>{c.toLocaleString()}</p>
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Breakdown({ rows, renderKey }: { rows: GroupRow[]; renderKey: (row: GroupRow) => React.ReactNode }) {
  const total = rows.reduce((s, r) => s + r.count, 0) || 1;
  return rows.length === 0 ? <p className="text-sm text-gray-400">ไม่มีข้อมูล</p> : (
    <div className="space-y-2.5">
      {rows.map((r) => (
        <div key={r.key}>
          <div className="flex items-center justify-between mb-1">{renderKey(r)}<span className="text-sm font-semibold text-gray-900">{r.count}</span></div>
          <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden"><div className="h-full rounded-full bg-blue-500/70" style={{ width: `${Math.max(4, (r.count / total) * 100)}%` }} /></div>
        </div>
      ))}
    </div>
  );
}
