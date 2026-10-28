'use client';
import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { StatCard } from '@/components/shared/stat-card';
import { UrgencyBadge, ConfidentialityBadge } from '@/components/shared/status-badge';
import { formatThaiDateTime, thaiMonthName } from '@/lib/utils';
import { ArrowLeft, Mail, CheckCircle2, Loader2, PenLine, Undo2, Printer, FileSpreadsheet } from 'lucide-react';
import Link from 'next/link';
import { usePermissionGuard } from '@/hooks/use-permission-guard';
import { useAuthStore } from '@/stores/auth.store';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface GroupRow { key: string; count: number; label?: string }
interface MonthlySummary { year: number; month: number; total: number; byStep: GroupRow[]; byUrgency: GroupRow[]; byDepartment: GroupRow[]; tickets: any[] }

const STEP_LABEL: Record<string, string> = {
  PENDING_PERSON: 'รอผู้รับดำเนินการ',
  PENDING_OWNER_HEAD: 'รอผู้อำนวยการกอง (เจ้าของ)', PENDING_OWNER_CLERK: 'รอธุรการกอง (เจ้าของ)',
  PENDING_RELATED_HEAD: 'รอผู้อำนวยการกอง (เกี่ยวข้อง)', PENDING_RELATED_CLERK: 'รอธุรการกอง (เกี่ยวข้อง)',
  PENDING_CLERK: 'รอปลัด', PENDING_MAYOR: 'รอนายก', COMPLETED: 'เสร็จสิ้น', RETURNED: 'ตีกลับ', CANCELLED: 'ยกเลิก',
};
const STEP_COLOR: Record<string, string> = {
  COMPLETED: 'bg-emerald-500', RETURNED: 'bg-orange-500', PENDING_CLERK: 'bg-violet-500', PENDING_MAYOR: 'bg-indigo-500',
};
const cnt = (rows: GroupRow[] | undefined, key: string) => (rows ?? []).find((r) => r.key === key)?.count ?? 0;

export default function SummaryMonthlyPage() {
  const canAccess = usePermissionGuard('correspondence:summary:Ticket');
  const { year, month } = useParams<{ year: string; month: string }>();
  const { user: me } = useAuthStore();
  const [deptId, setDeptId] = useState('');

  const { data: departments } = useQuery({
    queryKey: ['departments'],
    queryFn: async () => (await api.get(`/organizations/${me?.organizationId}/departments`)).data.data as any[],
    enabled: !!me?.organizationId,
  });
  const { data, isLoading } = useQuery({
    queryKey: ['ticket-summary-monthly', year, month, deptId],
    queryFn: async () => (await api.get(`/correspondence/tickets/summary/${year}/${month}`, { params: deptId ? { deptId } : {} })).data.data as MonthlySummary,
    enabled: !!year && !!month,
  });

  const exportExcel = async () => {
    const res = await api.get(`/correspondence/tickets/summary/${year}/${month}/excel`, { params: deptId ? { deptId } : {}, responseType: 'blob' });
    const url = URL.createObjectURL(res.data as Blob);
    const a = document.createElement('a'); a.href = url; a.download = `saraban-summary-${year}-${month}.xlsx`;
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  };

  if (!canAccess) return null;
  const monthName = thaiMonthName(Number(month));
  const completed = cnt(data?.byStep, 'COMPLETED');
  const returned = cnt(data?.byStep, 'RETURNED');
  const inProgress = (data?.total ?? 0) - completed - returned - cnt(data?.byStep, 'CANCELLED');
  const stepData = (data?.byStep ?? []).map((r) => ({ name: r.label || r.key, จำนวน: r.count }));
  const deptData = (data?.byDepartment ?? []).map((r) => ({ name: r.key, จำนวน: r.count }));
  const selCls = 'border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white';

  return (
    <div className="flex flex-col h-full">
      <Header title="รายงานสรุปสารบรรณ" />
      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        <div className="flex items-center gap-3 flex-wrap no-print">
          <Link href={`/correspondence/reports/${year}`}><Button variant="outline"><ArrowLeft className="h-4 w-4" />สรุปทั้งปี</Button></Link>
          <div className="flex-1">
            <h1 className="text-lg font-semibold text-gray-900">สรุปสารบรรณ — {monthName} {year}</h1>
            <p className="text-xs text-gray-400">แสดงเฉพาะเรื่องที่คุณมีสิทธิ์เห็น (ตามกอง/ชั้นความลับ)</p>
          </div>
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
              <StatCard title="ทั้งหมด" value={data.total} icon={Mail} iconColor="text-blue-600" />
              <StatCard title="เสร็จสิ้น" value={completed} icon={CheckCircle2} iconColor="text-emerald-600" />
              <StatCard title="กำลังดำเนินการ" value={Math.max(0, inProgress)} icon={Loader2} iconColor="text-amber-500" />
              <StatCard title="ตีกลับ" value={returned} icon={Undo2} iconColor="text-orange-500" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <ChartCard title="แยกตามสถานะ (ขั้นตอน)" data={stepData} fill="#6366f1" />
              <ChartCard title="แยกตามกองเจ้าของเรื่อง" data={deptData} fill="#8b5cf6" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <BreakdownCard title="แยกตามสถานะ" rows={data.byStep} renderKey={(r) => (
                <span className="flex items-center gap-2 text-sm text-gray-700"><span className={`h-2.5 w-2.5 rounded-full ${STEP_COLOR[r.key] || 'bg-blue-400'}`} />{r.label || r.key}</span>
              )} />
              <BreakdownCard title="แยกตามความเร่งด่วน" rows={data.byUrgency} renderKey={(r) => <UrgencyBadge level={r.key} size="sm" />} />
            </div>

            <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                <h3 className="font-semibold text-gray-900 text-sm flex items-center gap-2"><PenLine className="h-4 w-4 text-blue-500" />รายละเอียดสารบรรณ {monthName} {year}</h3>
                <span className="text-xs text-gray-400">{data.tickets.length} เรื่อง{data.tickets.length >= 300 ? ' (แสดง 300 แรก)' : ''}</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="text-left text-xs text-gray-500 border-b border-gray-100">
                    <th className="px-4 py-2.5 font-medium">เลขทะเบียนรับ</th><th className="px-4 py-2.5 font-medium">เรื่อง</th>
                    <th className="px-4 py-2.5 font-medium">กองเจ้าของ</th><th className="px-4 py-2.5 font-medium">ผู้ลงรับ</th>
                    <th className="px-4 py-2.5 font-medium">เร่งด่วน</th><th className="px-4 py-2.5 font-medium">ชั้นความลับ</th>
                    <th className="px-4 py-2.5 font-medium">สถานะ</th><th className="px-4 py-2.5 font-medium">วันที่ลงรับ</th>
                  </tr></thead>
                  <tbody className="divide-y divide-gray-50">
                    {data.tickets.length === 0 ? <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">ไม่มีเรื่องในเดือนนี้</td></tr>
                      : data.tickets.map((t: any) => (
                        <tr key={t.id} className="hover:bg-blue-50/40">
                          <td className="px-4 py-3 font-mono text-xs text-blue-700 whitespace-nowrap"><Link href={`/correspondence/tickets/${t.id}`} className="hover:underline">{t.receiveRegNumber || t.ticketNumber}</Link></td>
                          <td className="px-4 py-3 max-w-[320px]"><Link href={`/correspondence/tickets/${t.id}`} className="text-gray-900 hover:text-blue-700 line-clamp-1">{t.subject}</Link></td>
                          <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{t.ownerDept?.nameTh || '-'}</td>
                          <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{t.creator?.fullNameTh || '-'}</td>
                          <td className="px-4 py-3"><UrgencyBadge level={t.urgencyLevel} size="sm" /></td>
                          <td className="px-4 py-3"><ConfidentialityBadge level={t.confidentiality} size="sm" showNormal /></td>
                          <td className="px-4 py-3"><span className="text-xs text-gray-600 whitespace-nowrap">{STEP_LABEL[t.currentStep] || t.status}</span></td>
                          <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">{formatThaiDateTime(t.receivedRecordAt || t.createdAt)}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ChartCard({ title, data, fill }: { title: string; data: { name: string; จำนวน: number }[]; fill: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
      <h3 className="font-semibold text-gray-900 text-sm mb-4">{title}</h3>
      {data.length === 0 ? <p className="text-center text-sm text-gray-400 py-8">ไม่มีข้อมูล</p> : (
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={data} margin={{ top: 0, right: 8, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
            <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'var(--chart-tick)' }} stroke="var(--chart-grid)" interval={0} angle={-20} textAnchor="end" height={70} />
            <YAxis tick={{ fontSize: 12, fill: 'var(--chart-tick)' }} stroke="var(--chart-grid)" allowDecimals={false} />
            <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }} formatter={(v) => [`${v} เรื่อง`, 'จำนวน']} />
            <Bar dataKey="จำนวน" fill={fill} radius={[4, 4, 0, 0]} maxBarSize={40} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

function BreakdownCard({ title, rows, renderKey }: { title: string; rows: GroupRow[]; renderKey: (row: GroupRow) => React.ReactNode }) {
  const total = rows.reduce((s, r) => s + r.count, 0) || 1;
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
      <h3 className="font-semibold text-gray-900 text-sm mb-3">{title}</h3>
      {rows.length === 0 ? <p className="text-sm text-gray-400">ไม่มีข้อมูล</p> : (
        <div className="space-y-2.5">
          {rows.map((r) => (
            <div key={r.key}>
              <div className="flex items-center justify-between mb-1">{renderKey(r)}<span className="text-sm font-semibold text-gray-900">{r.count}</span></div>
              <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden"><div className="h-full rounded-full bg-blue-500/70" style={{ width: `${Math.max(4, (r.count / total) * 100)}%` }} /></div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
