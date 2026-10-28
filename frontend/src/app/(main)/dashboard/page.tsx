'use client';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Header } from '@/components/layout/header';
import { useAuthStore } from '@/stores/auth.store';
import {
  Mail, CalendarDays, Calendar, ClipboardList, FileBarChart2, Plus,
  CheckCircle2, Loader2, Undo2, ChevronRight, Inbox, Building2,
} from 'lucide-react';
import { formatThaiDateTime, thaiMonthName } from '@/lib/utils';
import { MODULE_COLOR } from '@/lib/module-colors';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { ExecutiveOverview } from './executive-overview';

// ── ป้ายสถานะ (v4 step) ──
const STEP_LABEL: Record<string, string> = {
  PENDING_PERSON: 'รอผู้รับดำเนินการ',
  PENDING_OWNER_HEAD: 'รอผู้อำนวยการ', PENDING_OWNER_CLERK: 'รอธุรการ',
  PENDING_RELATED_HEAD: 'รอผอ.กองที่เกี่ยว', PENDING_RELATED_CLERK: 'รอธุรการกองที่เกี่ยว',
  PENDING_CLERK: 'รอปลัด', PENDING_MAYOR: 'รอนายก',
  COMPLETED: 'เสร็จสิ้น', RETURNED: 'ตีกลับ', CANCELLED: 'ยกเลิก',
};
const STEP_TONE: Record<string, string> = {
  PENDING_PERSON: 'bg-amber-50 text-amber-700',
  PENDING_OWNER_HEAD: 'bg-amber-50 text-amber-700', PENDING_OWNER_CLERK: 'bg-amber-50 text-amber-700',
  PENDING_RELATED_HEAD: 'bg-sky-50 text-sky-700', PENDING_RELATED_CLERK: 'bg-sky-50 text-sky-700',
  PENDING_CLERK: 'bg-violet-50 text-violet-700', PENDING_MAYOR: 'bg-indigo-50 text-indigo-700',
  COMPLETED: 'bg-emerald-50 text-emerald-700', RETURNED: 'bg-orange-50 text-orange-700',
  CANCELLED: 'bg-gray-100 text-gray-500',
};

function StepChip({ step, status }: { step?: string; status?: string }) {
  const label = (step && STEP_LABEL[step]) || status || '-';
  const tone = (step && STEP_TONE[step]) || 'bg-gray-100 text-gray-600';
  return <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full whitespace-nowrap ${tone}`}>{label}</span>;
}

// KPI การ์ดใหญ่ด้านบน
function Kpi({ label, value, icon: Icon, tone, ring, onClick }: {
  label: string; value: number; icon: any; tone: string; ring: string; onClick: () => void;
}) {
  return (
    <button onClick={onClick}
      className={`group text-left rounded-2xl border bg-white p-5 shadow-sm transition hover:shadow-md hover:-translate-y-0.5 ${ring}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-3xl font-bold text-gray-900 tabular-nums">{value.toLocaleString()}</p>
          <p className="text-sm text-gray-500 mt-1">{label}</p>
        </div>
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${tone}`}>
          <Icon className="h-6 w-6" />
        </div>
      </div>
    </button>
  );
}

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const router = useRouter();
  const canSummary = hasPermission('correspondence:summary:Ticket'); // ปลัด/นายก/admin = มุมมองผู้บริหาร

  const { data: stats } = useQuery({
    queryKey: ['ticket-stats'],
    queryFn: async () => (await api.get('/correspondence/tickets/stats')).data.data,
    enabled: !canSummary,
    refetchInterval: 60_000,
  });
  const { data: summary } = useQuery({
    queryKey: ['dashboard', 'summary'],
    queryFn: async () => (await api.get('/dashboard/summary')).data.data,
    refetchInterval: 60_000,
  });
  const { data: away } = useQuery({
    queryKey: ['staff-away'],
    queryFn: async () => (await api.get('/users/away/today')).data.data,
    refetchInterval: 60_000,
  });
  const { data: myTasks } = useQuery({
    queryKey: ['my-tasks'],
    queryFn: async () => (await api.get('/correspondence/tickets/my-tasks')).data.data ?? [],
    refetchInterval: 60_000,
  });
  const { data: recentTickets } = useQuery({
    queryKey: ['tickets', 'recent'],
    queryFn: async () => (await api.get('/correspondence/tickets', { params: { page: 1, limit: 6 } })).data.data ?? [],
    refetchInterval: 60_000,
  });

  // ── มุมมองผู้บริหาร: สถิติทั้งปี (แนวโน้มรายเดือน/อันดับกอง) ──
  const { data: years } = useQuery({
    queryKey: ['summary-years'],
    queryFn: async () => (await api.get('/correspondence/tickets/summary/years')).data.data as { year: number; count: number }[],
    enabled: canSummary,
  });
  const curYear = years?.length ? Math.max(...years.map((y) => y.year)) : null;
  const { data: yearSum } = useQuery({
    queryKey: ['summary-year', curYear],
    queryFn: async () => (await api.get(`/correspondence/tickets/summary/${curYear}/year`)).data.data,
    enabled: canSummary && !!curYear,
  });

  const greeting = () => {
    const h = new Date().getHours();
    return h < 12 ? 'อรุณสวัสดิ์' : h < 17 ? 'สวัสดีตอนบ่าย' : 'สวัสดีตอนเย็น';
  };

  const tasks: any[] = myTasks ?? [];

  const monthsArr: any[] = yearSum?.months ?? [];
  const monthTrend = monthsArr.map((m: any) => ({ name: thaiMonthName(m.month, true), จำนวน: m.count, month: m.month }));
  const goMonth = (m?: number) => { if (curYear && m) router.push(`/correspondence/reports/${curYear}/${m}`); };
  const deptRank: any[] = (yearSum?.byDepartment ?? []).slice(0, 6);
  const deptMax = deptRank.reduce((m, d) => Math.max(m, d.count), 0) || 1;

  // ── ส่วนย่อยที่ใช้ทั้งมุมมองผู้บริหารและเจ้าหน้าที่ ──
  const shortcuts = (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      {hasPermission('correspondence:create:Ticket') && (
        <Link href="/correspondence/tickets/new" className="group rounded-xl border border-gray-200 bg-white p-4 hover:border-blue-400 hover:shadow-sm transition flex items-center gap-3">
          <span className="w-9 h-9 rounded-lg bg-blue-50 group-hover:bg-blue-100 flex items-center justify-center"><Plus className="h-5 w-5 text-blue-600" /></span>
          <span className="text-sm font-medium text-gray-800">สร้างสารบรรณ</span>
        </Link>
      )}
      {canSummary && (
        <Link href="/correspondence/reports" className="group rounded-xl border border-gray-200 bg-white p-4 hover:border-blue-400 hover:shadow-sm transition flex items-center gap-3">
          <span className="w-9 h-9 rounded-lg bg-indigo-50 group-hover:bg-indigo-100 flex items-center justify-center"><FileBarChart2 className="h-5 w-5 text-indigo-600" /></span>
          <span className="text-sm font-medium text-gray-800">รายงานสรุป</span>
        </Link>
      )}
      {hasPermission('leave:create:LeaveRequest') && (
        <Link href="/leave/new" className="group rounded-xl border border-gray-200 bg-white p-4 hover:border-green-400 hover:shadow-sm transition flex items-center gap-3">
          <span className="w-9 h-9 rounded-lg bg-green-50 group-hover:bg-green-100 flex items-center justify-center"><CalendarDays className="h-5 w-5 text-green-600" /></span>
          <span className="text-sm font-medium text-gray-800">บันทึกการลา</span>
        </Link>
      )}
    </div>
  );

  const recentCard = (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm">
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
        <h3 className="font-semibold text-gray-900 text-sm">สารบรรณล่าสุด</h3>
        <Link href="/correspondence/tickets" className="text-xs text-blue-600 hover:underline">ดูทั้งหมด</Link>
      </div>
      <div className="divide-y divide-gray-50">
        {!recentTickets?.length ? <p className="py-8 text-center text-sm text-gray-400">ยังไม่มีสารบรรณ</p>
          : recentTickets.map((t: any) => (
            <Link key={t.id} href={`/correspondence/tickets/${t.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50 transition-colors">
              <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center shrink-0"><Mail className="h-4 w-4 text-blue-500" /></div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-900 truncate">{t.subject}</p>
                <p className="text-xs text-gray-400 font-mono">{t.ticketNumber}</p>
              </div>
              <StepChip step={t.currentStep} status={t.status} />
            </Link>
          ))}
      </div>
    </div>
  );

  const orgCards = (
    <div className="grid grid-cols-3 gap-3">
      <button onClick={() => router.push('/hr')} className="rounded-xl border border-gray-200 bg-white p-3 text-center hover:shadow-sm transition">
        <CalendarDays className={`h-5 w-5 mx-auto ${MODULE_COLOR.leave}`} />
        <p className="text-lg font-bold text-gray-900 mt-1 tabular-nums">{away?.leaveToday?.length ?? 0}</p>
        <p className="text-[11px] text-gray-500">ลาวันนี้</p>
      </button>
      <button onClick={() => router.push('/meetings')} className="rounded-xl border border-gray-200 bg-white p-3 text-center hover:shadow-sm transition">
        <Calendar className={`h-5 w-5 mx-auto ${MODULE_COLOR.meetings}`} />
        <p className="text-lg font-bold text-gray-900 mt-1 tabular-nums">{summary?.upcomingMeetings ?? 0}</p>
        <p className="text-[11px] text-gray-500">ประชุม</p>
      </button>
      <button onClick={() => router.push('/projects')} className="rounded-xl border border-gray-200 bg-white p-3 text-center hover:shadow-sm transition">
        <ClipboardList className={`h-5 w-5 mx-auto ${MODULE_COLOR.projects}`} />
        <p className="text-lg font-bold text-gray-900 mt-1 tabular-nums">{summary?.activeProjects ?? 0}</p>
        <p className="text-[11px] text-gray-500">โครงการ</p>
      </button>
    </div>
  );

  return (
    <div className="flex flex-col h-full">
      <Header title="หน้าหลัก" />
      <div className="flex-1 overflow-y-auto p-6 space-y-6">

        {/* ── Hero (บาง) ── */}
        <div className="bg-blue-700 rounded-2xl px-6 py-5 text-white flex items-center gap-4">
          <div className="w-14 h-14 rounded-xl overflow-hidden bg-white/15 ring-1 ring-white/25 shrink-0 flex items-center justify-center">
            {user?.avatarUrl
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={user.avatarUrl} alt="รูปโปรไฟล์" className="w-full h-full object-cover" />
              : <span className="text-2xl font-bold text-white/90">{user?.fullNameTh?.charAt(0)}</span>}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-blue-200 text-sm">{greeting()} · {user?.positionName || 'ผู้ใช้งาน'}</p>
            <h2 className="text-lg font-bold truncate">{user?.titleTh}{user?.fullNameTh}</h2>
          </div>
          <p className="hidden sm:block text-blue-100 text-sm shrink-0">{formatThaiDateTime(new Date())}</p>
        </div>

        {canSummary ? (
          <>
            {/* ── ผู้บริหาร: งานไปถึงไหน / อยู่ที่ใคร ── */}
            <ExecutiveOverview myTasks={tasks} />

            {/* ── สถิติ ── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:items-stretch">
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 h-full">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-semibold text-gray-900 text-sm">สารบรรณรับเข้ารายเดือน{curYear ? ` · ปี ${curYear}` : ''}</h3>
                    <p className="text-xs text-gray-400 mt-0.5">กดแท่งเดือนเพื่อดูสรุปเดือนนั้น</p>
                  </div>
                  <Link href="/correspondence/reports" className="text-xs text-blue-600 hover:underline flex items-center gap-1"><FileBarChart2 className="h-3.5 w-3.5" />รายงานสรุป</Link>
                </div>
                {monthTrend.length === 0 || monthTrend.every((m: any) => m.จำนวน === 0)
                  ? <p className="text-center text-sm text-gray-400 py-10">ยังไม่มีข้อมูล</p>
                  : (
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={monthTrend} margin={{ top: 0, right: 8, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
                        <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--chart-tick)' }} stroke="var(--chart-grid)" />
                        <YAxis tick={{ fontSize: 12, fill: 'var(--chart-tick)' }} stroke="var(--chart-grid)" allowDecimals={false} />
                        <Tooltip cursor={{ fill: 'var(--chart-hover)' }} contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }} formatter={(v) => [`${v} เรื่อง`, 'จำนวน']} />
                        <Bar dataKey="จำนวน" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={40} cursor="pointer" onClick={(d: any) => goMonth(d?.month ?? d?.payload?.month)} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
              </div>
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 h-full flex flex-col">
                <h3 className="font-semibold text-gray-900 text-sm mb-4 flex items-center gap-2"><Building2 className="h-4 w-4 text-blue-500" />กองที่รับเรื่องมากสุด{curYear ? ` · ปี ${curYear}` : ''}</h3>
                {deptRank.length === 0 ? <p className="text-center text-sm text-gray-400 py-6">ยังไม่มีข้อมูล</p> : (
                  <div className="flex-1 flex flex-col justify-around gap-3">
                    {deptRank.map((d, i) => (
                      <div key={d.key} className="flex items-center gap-3">
                        <span className="w-5 text-sm text-gray-400 tabular-nums">{i + 1}</span>
                        <span className="w-32 sm:w-48 shrink-0 text-sm text-gray-700 truncate" title={d.key}>{d.key}</span>
                        <div className="flex-1 h-2.5 rounded-full bg-gray-100 overflow-hidden">
                          <div className="h-full rounded-full bg-blue-500/70" style={{ width: `${Math.max(6, (d.count / deptMax) * 100)}%` }} />
                        </div>
                        <span className="w-10 text-right text-sm font-semibold text-gray-900 tabular-nums">{d.count}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* ── สารบรรณล่าสุด | วันนี้ในองค์กร + ทางลัด (สูงเท่ากัน) ── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:items-stretch">
              <div className="lg:col-span-2 [&>div]:h-full">{recentCard}</div>
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm flex flex-col">
                <div className="px-5 py-4 border-b border-gray-100">
                  <h3 className="font-semibold text-gray-900 text-sm">วันนี้ในองค์กร</h3>
                </div>
                <div className="divide-y divide-gray-100">
                  {[
                    { href: '/hr', icon: CalendarDays, tone: MODULE_COLOR.leave, label: 'บุคลากรลาวันนี้', value: away?.leaveToday?.length ?? 0 },
                    { href: '/meetings', icon: Calendar, tone: MODULE_COLOR.meetings, label: 'ประชุมที่กำลังจะถึง', value: summary?.upcomingMeetings ?? 0 },
                    { href: '/projects', icon: ClipboardList, tone: MODULE_COLOR.projects, label: 'โครงการที่ดำเนินการอยู่', value: summary?.activeProjects ?? 0 },
                  ].map((r) => (
                    <Link key={r.href} href={r.href} className="flex items-center gap-3 px-5 py-3.5 hover:bg-gray-50 transition-colors">
                      <r.icon className={`h-5 w-5 shrink-0 ${r.tone}`} />
                      <span className="flex-1 text-sm text-gray-700">{r.label}</span>
                      <span className="text-lg font-bold text-gray-900 tabular-nums">{r.value}</span>
                      <ChevronRight className="h-4 w-4 text-gray-300" />
                    </Link>
                  ))}
                </div>
                <div className="mt-auto border-t border-gray-100 px-5 py-4">
                  <p className="text-xs text-gray-400 mb-2">ทางลัด</p>
                  <div className="grid grid-cols-2 gap-2">
                    <Link href="/correspondence/reports" className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-gray-700 hover:border-blue-300 hover:bg-blue-50/40 transition">
                      <FileBarChart2 className="h-4 w-4 text-blue-600" />รายงานสรุป
                    </Link>
                    {hasPermission('leave:create:LeaveRequest') && (
                      <Link href="/leave/new" className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-gray-700 hover:border-blue-300 hover:bg-blue-50/40 transition">
                        <CalendarDays className="h-4 w-4 text-blue-600" />บันทึกการลา
                      </Link>
                    )}
                    {hasPermission('correspondence:create:Ticket') && (
                      <Link href="/correspondence/tickets/new" className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-gray-700 hover:border-blue-300 hover:bg-blue-50/40 transition">
                        <Plus className="h-4 w-4 text-blue-600" />สร้างสารบรรณ
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </>
        ) : (
          <>
            {/* ── KPI ── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <Kpi label="สารบรรณทั้งหมด" value={stats?.all ?? 0} icon={Mail}
                tone="bg-blue-50 text-blue-600" ring="border-gray-200 hover:border-blue-300"
                onClick={() => router.push('/correspondence/tickets')} />
              <Kpi label="กำลังดำเนินการ" value={stats?.inProgress ?? 0} icon={Loader2}
                tone="bg-amber-50 text-amber-600" ring="border-gray-200 hover:border-amber-300"
                onClick={() => router.push('/correspondence/tickets?box=doing')} />
              <Kpi label="เสร็จสิ้น" value={stats?.completed ?? 0} icon={CheckCircle2}
                tone="bg-emerald-50 text-emerald-600" ring="border-gray-200 hover:border-emerald-300"
                onClick={() => router.push('/correspondence/tickets?box=done')} />
              <Kpi label="ตีกลับ" value={stats?.returned ?? 0} icon={Undo2}
                tone="bg-orange-50 text-orange-600" ring={stats?.returned ? 'border-orange-200 hover:border-orange-300' : 'border-gray-200'}
                onClick={() => router.push('/correspondence/tickets?box=todo')} />
            </div>

            {/* ── แถวเตือน: อะไรรอฉัน ── */}
            {tasks.length > 0 && (
              <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-2xl border border-orange-200 bg-orange-50/60 px-5 py-3.5 text-sm">
                <span className="flex items-center gap-2 font-semibold text-orange-700">
                  <Inbox className="h-4 w-4" />รอฉันดำเนินการ <b className="text-base">{tasks.length}</b> งาน
                </span>
                <Link href="/correspondence/tickets" className="ml-auto text-blue-600 hover:underline flex items-center gap-1">ดูงานทั้งหมด<ChevronRight className="h-4 w-4" /></Link>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
              <div className="lg:col-span-2 space-y-6">
                {/* เจ้าหน้าที่: งานรอฉัน (เด่น) */}
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm">
                  <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                    <h3 className="font-semibold text-gray-900 text-sm flex items-center gap-2"><ClipboardList className="h-4 w-4 text-orange-500" />งานรอฉันดำเนินการ</h3>
                    <span className="text-xs text-gray-400">{tasks.length} งาน</span>
                  </div>
                  <div className="divide-y divide-gray-50 max-h-[28rem] overflow-y-auto">
                    {tasks.length === 0 ? <p className="py-12 text-center text-sm text-gray-400">ไม่มีงานที่รอคุณดำเนินการ</p>
                      : tasks.map((t) => (
                        <Link key={t.id} href={`/correspondence/tickets/${t.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-orange-50/40 transition-colors">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-gray-900 truncate">{t.subject}</p>
                            <p className="text-xs text-gray-400 font-mono">{t.ticketNumber} · {t.ownerDept?.nameTh || ''}</p>
                          </div>
                          <StepChip step={t.currentStep} status={t.status} />
                        </Link>
                      ))}
                  </div>
                </div>
                {shortcuts}
              </div>
              <div className="space-y-6">{recentCard}{orgCards}</div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
