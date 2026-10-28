'use client';
import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Header } from '@/components/layout/header';
import { PageHeader } from '@/components/shared/page-header';
import { Pagination } from '@/components/shared/pagination';
import { Button } from '@/components/ui/button';
import { Plus, Search, X, BarChart3, RotateCcw, Inbox, Lock } from 'lucide-react';
import { DayHeader, isNewDay, timeOf } from '@/components/shared/day-group';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { usePermissionGuard } from '@/hooks/use-permission-guard';
import { PermissionGate } from '@/components/shared/permission-gate';
import { CONFIDENTIALITY_OPTIONS, URGENCY_OPTIONS } from '@/components/shared/status-badge';
import { useAuthStore } from '@/stores/auth.store';
import { cn } from '@/lib/utils';

// สถานะ — โทนเรียบแบบหน้าเรื่องร้องเรียน: ป้ายขาวขอบเทา มีแค่จุดสีบอกขั้น (ไม่ใช้พื้นหลังหลากสี)
// ห้ามใช้ blue-* ตรงนี้ — ธีม override เป็นสีหลักของ อบต. จะชนกับ "เสร็จสิ้น"
const STEP_META: Record<string, { label: string; dot: string; dept?: 'owner' | 'related' }> = {
  PENDING_PERSON: { label: 'รอ', dot: 'bg-amber-500' },
  PENDING_OWNER_HEAD: { label: 'รอผู้อำนวยการ', dot: 'bg-amber-500', dept: 'owner' },
  PENDING_OWNER_CLERK: { label: 'รอธุรการ', dot: 'bg-amber-500', dept: 'owner' },
  PENDING_RELATED_HEAD: { label: 'รอผู้อำนวยการกองที่เกี่ยว', dot: 'bg-amber-500' },
  PENDING_RELATED_CLERK: { label: 'รอธุรการกองที่เกี่ยว', dot: 'bg-amber-500' },
  PENDING_CLERK: { label: 'รอปลัด', dot: 'bg-violet-500' },
  PENDING_MAYOR: { label: 'รอนายก', dot: 'bg-violet-500' },
  COMPLETED: { label: 'เสร็จสิ้น', dot: 'bg-green-500' },
  RETURNED: { label: 'ตีกลับ', dot: 'bg-red-500' },
  CANCELLED: { label: 'ยกเลิก', dot: 'bg-gray-400' },
};
// flow ไดนามิก — เรื่องค้างที่ขั้นเดิมถูกย้ายเป็น PENDING_PERSON แล้ว (migration 1700000069000)
const STEP_FILTER = ['PENDING_PERSON', 'PENDING_CLERK', 'PENDING_MAYOR', 'COMPLETED'];

// แท็บเรียงตามวงจรของเรื่อง: ลงรับ → ต้องดำเนินการ → กำลังดำเนินการ → เสร็จสิ้น
const TABS = [
  { key: 'created', label: 'ที่ฉันลงรับ' },
  { key: 'todo', label: 'เรื่องที่ต้องดำเนินการ' },
  { key: 'doing', label: 'กำลังดำเนินการ' },
  { key: 'done', label: 'เสร็จสิ้น' },
] as const;
type TabKey = typeof TABS[number]['key'];

// ฟิลเตอร์ที่เหมาะกับแต่ละแท็บ
const TAB_FILTERS: Record<TabKey, string[]> = {
  todo: ['urgency', 'dept', 'confidentiality'],
  doing: ['step', 'urgency', 'dept'],
  done: ['dept', 'urgency', 'date', 'fiscalYear'],
  created: ['step', 'dept', 'urgency', 'date', 'fiscalYear'],
};

const GRID = 'lg:grid-cols-[64px_minmax(0,1fr)_150px_190px_130px]';

function StepPill({ t }: { t: any }) {
  const m = STEP_META[t.currentStep];
  if (!m) return <span className="text-xs text-gray-400">{t.status || '-'}</span>;
  // รอผู้ถือเรื่อง → แสดงชื่อคน · ขั้นเดิม (ข้อมูลเก่า) → ชื่อกอง
  const name = t.currentStep === 'PENDING_PERSON' ? (t.currentHolder?.fullNameTh || 'ผู้รับ')
    : m.dept === 'owner' ? t.ownerDept?.nameTh : '';
  return (
    <span className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-gray-200 bg-white px-2 py-0.5 text-xs font-medium text-gray-700">
      <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', m.dot)} />
      <span className="truncate">{m.label}{name ? ` ${name}` : ''}</span>
    </span>
  );
}

/** ด่วน/ลับ — โชว์เฉพาะเมื่อไม่ใช่ "ปกติ" เป็นตัวหนังสือเล็ก ๆ ไม่ใช้กล่องสี */
function Flags({ t, returned }: { t: { urgencyLevel?: string; confidentiality?: string }; returned: boolean }) {
  const urgent = t.urgencyLevel && t.urgencyLevel !== 'ปกติ';
  const secret = t.confidentiality && t.confidentiality !== 'ปกติ';
  if (!urgent && !secret && !returned) return null;
  return (
    <span className="flex shrink-0 items-center gap-2 text-[11px] font-medium">
      {urgent && <span className="text-red-600">{t.urgencyLevel}</span>}
      {secret && <span className="inline-flex items-center gap-0.5 text-gray-600"><Lock className="h-3 w-3" />{t.confidentiality}</span>}
      {returned && <span className="inline-flex items-center gap-0.5 text-red-600"><RotateCcw className="h-3 w-3" />ตีกลับ</span>}
    </span>
  );
}


export default function TicketsPage() {
  const canAccess = usePermissionGuard('correspondence:read:Ticket');
  const router = useRouter();
  const { user: me } = useAuthStore();
  const [tab, setTab] = useState<TabKey>('todo');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState('');
  const [step, setStep] = useState('');
  const [deptId, setDeptId] = useState('');
  const [confidentiality, setConfidentiality] = useState('');
  const [urgencyLevel, setUrgencyLevel] = useState('');
  const [fiscalYear, setFiscalYear] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const clearFilters = () => { setStep(''); setDeptId(''); setConfidentiality(''); setUrgencyLevel(''); setFiscalYear(''); setDateFrom(''); setDateTo(''); };
  // เปลี่ยนแท็บ = ล้างฟิลเตอร์ + กลับหน้าแรก
  useEffect(() => { setPage(1); setSearch(''); clearFilters(); }, [tab]);
  // รับ ?box= จากลิงก์ (เช่นการ์ด dashboard) มาเลือกแท็บเริ่มต้น
  useEffect(() => {
    const b = new URLSearchParams(window.location.search).get('box');
    if (b && (TABS as readonly { key: string }[]).some((t) => t.key === b)) setTab(b as TabKey);
  }, []);

  const { data: departments } = useQuery({
    queryKey: ['departments'],
    queryFn: async () => (await api.get(`/organizations/${me?.organizationId}/departments`)).data.data as any[],
    enabled: !!me?.organizationId,
  });

  const shown = TAB_FILTERS[tab];
  const params: any = { box: tab, page, limit: pageSize };
  if (search) params.search = search;
  if (shown.includes('step') && step) params.step = step;
  if (shown.includes('dept') && deptId) params.deptId = deptId;
  if (shown.includes('confidentiality') && confidentiality) params.confidentiality = confidentiality;
  if (shown.includes('urgency') && urgencyLevel) params.urgencyLevel = urgencyLevel;
  if (shown.includes('fiscalYear') && fiscalYear) params.fiscalYear = fiscalYear;
  if (shown.includes('date') && dateFrom) params.dateFrom = dateFrom;
  if (shown.includes('date') && dateTo) params.dateTo = dateTo;

  const { data, isLoading } = useQuery({
    queryKey: ['inbox', params],
    // body = { data: [...], meta: { page, total, totalPages } } — meta อยู่ชั้นนอก ไม่ได้อยู่ใน data
    queryFn: async () => (await api.get('/correspondence/tickets/inbox', { params })).data,
    // เปิดเรื่องแล้วกลับมา = อ่านแล้ว → รีเฟรชสถานะอ่านตอนกลับหน้า
    refetchOnMount: 'always',
  });
  const rows: any[] = data?.data?.items ?? data?.data ?? [];
  const totalPages = data?.meta?.totalPages ?? 1;
  const total = data?.meta?.total ?? rows.length;
  const from = total ? (page - 1) * pageSize + 1 : 0;
  const to = Math.min(page * pageSize, total);

  const hasFilter = !!(step || deptId || confidentiality || urgencyLevel || fiscalYear || dateFrom || dateTo);

  if (!canAccess) return null;
  const selCls = 'h-9 rounded-md border border-gray-300 bg-white px-2.5 text-sm text-gray-700 focus:border-blue-500 focus:outline-none';

  return (
    <div className="flex h-full flex-col">
      <Header title="สารบรรณ" />
      <div className="flex-1 overflow-y-auto p-6">
        <PageHeader title="ทะเบียนสารบรรณ" subtitle="ลงรับหนังสือ ส่งต่อ และติดตามสถานะจนนายกลงนาม" className="mb-5">
          <PermissionGate permission="correspondence:summary:Ticket">
            <Link href="/correspondence/reports"><Button variant="outline" size="sm"><BarChart3 className="h-4 w-4" />รายงานสรุป</Button></Link>
          </PermissionGate>
          <PermissionGate permission="correspondence:create:Ticket">
            <Link href="/correspondence/tickets/new"><Button size="sm"><Plus className="h-4 w-4" />ลงรับหนังสือ</Button></Link>
          </PermissionGate>
        </PageHeader>

        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          {/* แท็บ */}
          <div className="flex gap-1 overflow-x-auto border-b border-gray-200 px-3">
            {TABS.map((tb) => {
              const active = tab === tb.key;
              return (
                <button key={tb.key} onClick={() => setTab(tb.key)}
                  className={cn('-mb-px whitespace-nowrap border-b-2 px-3 py-3 text-sm font-medium transition-colors',
                    active ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-800')}>
                  {tb.label}
                </button>
              );
            })}
          </div>

          {/* ค้นหา + ตัวกรอง (เฉพาะที่เหมาะกับแท็บ) */}
          <div className="flex flex-wrap items-center gap-2 border-b border-gray-100 px-4 py-3">
            <div className="relative min-w-[220px] flex-1 sm:max-w-xs">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input className={cn(selCls, 'w-full pl-8')} placeholder="ค้นหา เรื่อง / เลขทะเบียน / จาก" value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
            </div>
            {shown.includes('step') && (
              <select className={selCls} value={step} onChange={(e) => { setStep(e.target.value); setPage(1); }}>
                <option value="">ทุกสถานะ</option>
                {STEP_FILTER.map((s) => <option key={s} value={s}>{s === 'PENDING_PERSON' ? 'รอผู้รับดำเนินการ' : STEP_META[s].label}</option>)}
              </select>
            )}
            {shown.includes('dept') && (
              <select className={selCls} value={deptId} onChange={(e) => { setDeptId(e.target.value); setPage(1); }}>
                <option value="">ทุกกอง</option>
                {departments?.map((d) => <option key={d.id} value={d.id}>{d.nameTh}</option>)}
              </select>
            )}
            {shown.includes('urgency') && (
              <select className={selCls} value={urgencyLevel} onChange={(e) => { setUrgencyLevel(e.target.value); setPage(1); }}>
                <option value="">ทุกความเร่งด่วน</option>
                {URGENCY_OPTIONS.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            )}
            {shown.includes('confidentiality') && (
              <select className={selCls} value={confidentiality} onChange={(e) => { setConfidentiality(e.target.value); setPage(1); }}>
                <option value="">ทุกชั้นความลับ</option>
                {CONFIDENTIALITY_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            )}
            {shown.includes('date') && (<>
              <input type="date" className={selCls} value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }} title="ตั้งแต่วันที่" />
              <span className="text-sm text-gray-400">ถึง</span>
              <input type="date" className={selCls} value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); }} title="ถึงวันที่" />
            </>)}
            {shown.includes('fiscalYear') && (
              <input type="number" className={cn(selCls, 'w-24')} placeholder="ปีงบ" value={fiscalYear} onChange={(e) => { setFiscalYear(e.target.value); setPage(1); }} />
            )}
            {hasFilter && (
              <button onClick={() => { clearFilters(); setPage(1); }} className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800">
                <X className="h-4 w-4" />ล้างตัวกรอง
              </button>
            )}
          </div>

          {/* หัวตาราง (จอใหญ่) */}
          <div className={cn('hidden gap-4 border-b border-gray-100 bg-gray-50 px-4 py-2 text-xs font-medium text-gray-500 lg:grid', GRID)}>
            <span>เวลา</span><span>เรื่อง</span><span>จาก</span><span>สถานะ</span><span>ผู้ลงรับ</span>
          </div>

          {isLoading ? (
            <p className="py-16 text-center text-sm text-gray-400">กำลังโหลด...</p>
          ) : rows.length === 0 ? (
            <div className="py-16 text-center">
              <Inbox className="mx-auto h-9 w-9 text-gray-300" />
              <p className="mt-3 text-sm text-gray-500">ไม่มีเรื่องในหมวดนี้</p>
            </div>
          ) : (
            <ul>
              {rows.map((t, i) => {
                const created = new Date(t.createdAt);
                // แทรกหัววันที่เมื่อวันเปลี่ยน (ข้อมูลเรียงจากใหม่ → เก่าตาม created_at อยู่แล้ว)
                const showDay = isNewDay(rows, i, (r) => r.createdAt);
                const creator = t.creator ? `${t.creator.titleTh || ''}${t.creator.fullNameTh}` : '-';
                const returned = t.currentStep === 'RETURNED' || t.status === 'ตีกลับ';
                // ยังไม่อ่าน (เฉพาะแท็บต้องดำเนินการ) → จุดนำหน้า + ตัวหนา แทนการไฮไลต์ทั้งแถว
                const unread = tab === 'todo' && !t.isRead;
                return (
                  <li key={t.id}>
                    {showDay && <DayHeader d={created} />}
                    <button onClick={() => router.push(`/correspondence/tickets/${t.id}`)}
                      className={cn('grid w-full grid-cols-1 gap-1.5 border-b border-gray-100 px-4 py-3 text-left transition-colors hover:bg-gray-50 lg:items-center lg:gap-4', GRID)}>
                      {/* เวลา */}
                      <span className="flex items-center justify-between gap-2 lg:block">
                        <span className="tabular-nums text-sm font-semibold text-gray-900">{timeOf(created)} น.</span>
                        <span className="lg:hidden"><StepPill t={t} /></span>
                      </span>
                      {/* เรื่อง */}
                      <span className="min-w-0">
                        <span className="flex items-center gap-2">
                          {unread && <span className="h-2 w-2 shrink-0 rounded-full bg-blue-600" aria-label="ยังไม่ได้เปิดอ่าน" title="ยังไม่ได้เปิดอ่าน" />}
                          <span className={cn('truncate text-sm text-gray-900', unread ? 'font-semibold' : 'font-medium')}>{t.subject}</span>
                          <Flags t={t} returned={returned} />
                        </span>
                        <span className="mt-0.5 block truncate font-mono text-xs text-gray-400">
                          {t.receiveRegNumber || t.ticketNumber}{t.externalDocNumber ? ` · ${t.externalDocNumber}` : ''}
                        </span>
                      </span>
                      {/* จาก */}
                      <span className="truncate text-sm text-gray-500">{t.sourceOrg || '-'}</span>
                      {/* สถานะ */}
                      <span className="hidden min-w-0 lg:block"><StepPill t={t} /></span>
                      {/* ผู้ลงรับ */}
                      <span className="truncate text-xs text-gray-400 lg:text-sm lg:text-gray-500">{creator}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          {/* แถบท้าย — จำนวน + เปลี่ยนหน้า */}
          {!isLoading && (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-600">
              <span>{total ? <>แสดง {from}–{to} จาก <b className="font-medium text-gray-900">{total}</b> เรื่อง · เรียงจากล่าสุด</> : 'ไม่มีรายการ'}</span>
              <div className="flex items-center gap-4">
                <Pagination page={page} totalPages={totalPages} onChange={setPage} className="flex items-center gap-2" />
                <label className="flex items-center gap-2 text-gray-500">
                  ต่อหน้า
                  <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
                    className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm text-gray-700 focus:border-blue-500 focus:outline-none">
                    {[10, 20, 50].map((n) => <option key={n} value={n}>{n}</option>)}
                  </select>
                </label>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
