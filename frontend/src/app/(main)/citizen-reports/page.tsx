'use client';
import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, getErrorMessage } from '@/lib/api';
import { toast } from '@/hooks/use-toast';
import { Header } from '@/components/layout/header';
import { PageHeader } from '@/components/shared/page-header';
import { useAuthStore } from '@/stores/auth.store';
import {
  MessageSquareWarning, MapPin, Phone, User, Clock, X, ImageIcon,
  Download, ExternalLink, Trash2, Send, CheckCircle2, UserCheck, Pencil, FileText, Check, FilePen, MessageSquare, Upload,
} from 'lucide-react';
import { getForm } from '@/app/citizen/forms/form-config';
import { Pagination } from '@/components/shared/pagination';
import { listFilesByRef, uploadFiles, deleteUploadedFile } from '@/lib/upload';
import { Button, buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { DayHeader, isNewDay, timeOf } from '@/components/shared/day-group';

// สถานะ — โทนเรียบ: ป้ายขาวขอบเทา มีแค่จุดสีบอกสถานะ (ไม่ใช้พื้นหลังหลากสี)
// ห้ามใช้ blue-* ตรงนี้ — ธีม override เป็นสีหลักของ อบต. (เช่นเขียว) จะชนกับ "เสร็จสิ้น"
const STATUS: Record<string, { label: string; dot: string }> = {
  new: { label: 'ใหม่', dot: 'bg-red-500' },
  in_progress: { label: 'กำลังดำเนินการ', dot: 'bg-amber-500' },
  done: { label: 'เสร็จสิ้น', dot: 'bg-green-500' },
  rejected: { label: 'ปฏิเสธ', dot: 'bg-gray-400' },
};
// แท็บเดียวกับหน้าสารบรรณ — "ทั้งหมด" ไม่รวมเรื่องที่เสร็จแล้ว (ดูที่แท็บ "เสร็จสิ้น" ท้ายสุด)
const TABS = [
  { key: '', label: 'ทั้งหมด' },
  { key: 'new', label: 'ใหม่' },
  { key: 'in_progress', label: 'กำลังดำเนินการ' },
  { key: 'rejected', label: 'ปฏิเสธ' },
  { key: 'done', label: 'เสร็จสิ้น' },
];
// คอลัมน์ตาราง: เวลา | เรื่อง | ผู้แจ้ง | ขั้นอนุมัติ | สถานะ (วันที่อยู่ในหัวกลุ่มวัน)
const LIST_GRID = 'lg:grid-cols-[72px_minmax(0,1fr)_180px_150px_130px]';
const dt = (d: any) => new Date(d).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' });
const isImg = (s: string) => /\.(jpe?g|png|gif|webp|heic|bmp)$/i.test(s || '');
/** ลูกบ้าน "ขอใช้บริการ" (รถกู้ภัย/ดับเพลิง/รถส่งผู้ป่วย/รถแจกน้ำ) ต่างจากร้องเรียนทั่วไป — ต้องเด่นให้ admin เห็นปุ๊บรู้ปั๊บ */
const isServiceRequest = (category: string) => !!category?.startsWith('ขอใช้บริการ');

// ─────────── ขั้นตอนอนุมัติ 3 ผู้เซ็น (ผอ.กอง → ปลัด → นายก) — คนละกลไกกับสารบรรณทั้งหมด ───────────
const APPROVAL_STEPS = ['ผอ.กอง', 'ปลัด', 'นายก'];
function approvalDoneCount(r: any) { return [r.deptHeadSignedAt, r.clerkSignedAt, r.mayorSignedAt].filter(Boolean).length; }
function isAdminUser(user: any) {
  return (user?.roles || []).some((x: string) => x === 'ADMIN' || x === 'SUPER_ADMIN');
}
/** ขั้นที่ถึงตาตอนนี้ (ชื่อสั้นตาม APPROVAL_STEPS) — ครบแล้วคืน null */
function currentApprovalStep(r: any) {
  const done = approvalDoneCount(r);
  return done < APPROVAL_STEPS.length ? APPROVAL_STEPS[done] : null;
}
/** ถึงตาตัวเองจริง ๆ ตามตำแหน่ง (ไม่นับสิทธิ์ admin อนุมัติแทน) */
function isMyOwnTurn(r: any, user: any) {
  return isMyApprovalTurn(r, { ...user, roles: (user?.roles || []).filter((x: string) => x !== 'ADMIN' && x !== 'SUPER_ADMIN') });
}
function isMyApprovalTurn(r: any, user: any) {
  if (!user || !r.targetDeptId) return false;
  const roles: string[] = user.roles || [];
  const isClerk = roles.includes('CLERK') || roles.includes('DEPUTY_CLERK');
  const isMayor = roles.includes('MAYOR') || roles.includes('DEPUTY_MAYOR');
  // admin อนุมัติแทนได้ทุกขั้น (backend บันทึกผู้ลงนามเป็นเจ้าของตำแหน่งจริง)
  if (isAdminUser(user) && !r.mayorSignedAt) return true;
  if (!r.deptHeadSignedAt) return user.id === r.targetDept?.headUserId;
  if (!r.clerkSignedAt) return isClerk;
  if (!r.mayorSignedAt) return isMayor;
  return false;
}

function StatusPill({ status }: { status: string }) {
  const s = STATUS[status];
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-gray-200 bg-white px-2 py-0.5 text-xs font-medium text-gray-700">
      <span className={cn('h-1.5 w-1.5 rounded-full', s?.dot || 'bg-gray-400')} />
      {s?.label || status}
    </span>
  );
}

function ServiceTag() {
  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full border border-red-200 px-1.5 py-px text-[11px] font-medium text-red-700">
      <span className="h-1.5 w-1.5 rounded-full bg-red-500" /> ขอใช้บริการ
    </span>
  );
}

/** ความคืบหน้าอนุมัติแบบย่อ (ใช้ในตาราง/คิว): แถบ 3 ช่อง + ข้อความขั้นที่รอ */
function ApprovalProgress({ r }: { r: any }) {
  const done = approvalDoneCount(r);
  const step = currentApprovalStep(r);
  return (
    <div className="flex items-center gap-2">
      <div className="flex gap-0.5">
        {APPROVAL_STEPS.map((s, i) => (
          <span key={s} className={cn('h-1.5 w-4 rounded-full', i < done ? 'bg-blue-600' : 'bg-gray-200')} />
        ))}
      </div>
      <span className="whitespace-nowrap text-xs text-gray-600">{step ? `รอ ${step}` : 'ครบแล้ว'}</span>
    </div>
  );
}

/** ไทม์ไลน์อนุมัติแบบเต็ม (ใช้ในแผงรายละเอียด) — บอกขั้น/สถานะ/เวลาที่เซ็น */
function ApprovalTimeline({ r }: { r: any }) {
  const done = approvalDoneCount(r);
  const signedAt = [r.deptHeadSignedAt, r.clerkSignedAt, r.mayorSignedAt];
  return (
    <ol className="space-y-0">
      {APPROVAL_STEPS.map((label, i) => {
        const state = i < done ? 'done' : i === done ? 'current' : 'todo';
        return (
          <li key={label} className="relative flex gap-3 pb-4 last:pb-0">
            {i < APPROVAL_STEPS.length - 1 && (
              <span className={cn('absolute left-[9px] top-5 h-[calc(100%-12px)] w-px', i < done ? 'bg-blue-600' : 'bg-gray-200')} />
            )}
            <span className={cn(
              'relative z-10 mt-0.5 flex h-[19px] w-[19px] shrink-0 items-center justify-center rounded-full border text-[10px] font-semibold',
              state === 'done' && 'border-blue-600 bg-blue-600 text-white',
              state === 'current' && 'border-blue-600 bg-white text-blue-600',
              state === 'todo' && 'border-gray-300 bg-white text-gray-400',
            )}>
              {state === 'done' ? <Check className="h-3 w-3" /> : i + 1}
            </span>
            <div className="min-w-0 flex-1">
              <p className={cn('text-sm', state === 'todo' ? 'text-gray-400' : 'font-medium text-gray-900')}>{label}</p>
              <p className="text-xs text-gray-500">
                {state === 'done' ? `อนุมัติแล้ว · ${dt(signedAt[i])}` : state === 'current' ? 'รออนุมัติ' : 'ยังไม่ถึงขั้นนี้'}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

// origin ของ API (กัน backend ออก signed url เป็น host ผิด เช่น localhost:4000 บน prod ที่ APP_URL ไม่ได้ตั้ง)
const apiOrigin = (() => {
  const b = api.defaults.baseURL || '';
  if (b.startsWith('http')) { try { return new URL(b).origin; } catch { /* noop */ } }
  return typeof window !== 'undefined' ? window.location.origin : '';
})();
/** เปลี่ยน host ของ url ไฟล์ storage ของเราให้เป็น origin ของ API (sig ไม่ผูกกับ host จึงยังใช้ได้) */
const normUrl = (u?: string) => {
  if (!u || !u.includes('/v1/storage/files/')) return u;
  try { const p = new URL(u, apiOrigin || 'http://x'); return `${apiOrigin || p.origin}${p.pathname}${p.search}`; } catch { return u; }
};

export default function CitizenReportsPage() {
  return (
    <Suspense fallback={null}>
      <CitizenReportsPageInner />
    </Suspense>
  );
}

function CitizenReportsPageInner() {
  const canRead = useAuthStore((s) => s.hasPermission('complaint:read:Report'));
  const canManage = useAuthStore((s) => s.hasPermission('complaint:manage:Report'));
  const user = useAuthStore((s) => s.user);
  const router = useRouter();
  const searchParams = useSearchParams();
  const [tab, setTab] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sel, setSel] = useState<any | null>(null);
  const [queueOpen, setQueueOpen] = useState(false);

  // กลับจากหน้าแก้ไขเอกสาร (/citizen-reports/:id/petition) แล้วเปิดรายละเอียดเรื่องเดิมให้อัตโนมัติครั้งเดียว
  // ต้องล้าง ?open= ออกจาก URL ทันที ไม่งั้นกลับมาหน้านี้ทีหลัง (รีเฟรช/คลิกเมนูซ้ำ) จะเด้งเปิดซ้ำเองทุกครั้งโดยไม่ได้ตั้งใจ
  const openId = searchParams.get('open');
  useEffect(() => {
    if (!openId || !canRead) return;
    router.replace('/citizen-reports');
    api.get(`/citizen-reports/${openId}`).then((r) => setSel(r.data.data)).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openId, canRead]);

  const { data, isLoading } = useQuery({
    queryKey: ['citizen-reports', tab, page, pageSize],
    queryFn: async () => (await api.get('/citizen-reports', { params: { status: tab || undefined, page, limit: pageSize } })).data,
    enabled: canRead,
    placeholderData: (p) => p,
  });
  const rows: any[] = data?.data || [];
  const meta = data?.meta || { totalPages: 1, page: 1, total: 0, counts: {} };
  const from = meta.total ? (meta.page - 1) * pageSize + 1 : 0;
  const to = Math.min(meta.page * pageSize, meta.total || 0);

  const roles: string[] = user?.roles || [];
  const isClerkOrMayor = roles.some((r) => ['CLERK', 'DEPUTY_CLERK', 'MAYOR', 'DEPUTY_MAYOR'].includes(r));
  const { data: queue } = useQuery({
    queryKey: ['citizen-reports-my-queue'],
    queryFn: async () => (await api.get('/citizen-reports/my-queue')).data.data as any[],
    enabled: canRead,
  });
  const queueCount = queue?.length || 0;
  // admin กลาง (complaint:manage:Report) เห็นปุ่มนี้เสมอ — ต้องมองเห็น entry point ของฟีเจอร์ตัวเองได้
  // แม้คิวว่าง/ไม่ได้ถือบทบาทปลัด-นายกเอง ส่วนคนอื่นโผล่เฉพาะตอนมีคิวค้างหรือถือบทบาทที่เกี่ยว
  const showQueueButton = canManage || isClerkOrMayor || queueCount > 0;

  return (
    <div className="flex h-full flex-col">
      <Header title="เรื่องแจ้ง/ร้องเรียน" />
      <div className="flex-1 overflow-y-auto p-6">
        <PageHeader title="เรื่องแจ้ง/ร้องเรียนจากประชาชน" subtitle="เรื่องที่ประชาชนแจ้งผ่านพอร์ทัลบริการ — คัดกรองและติดตามสถานะ" className="mb-5">
          {canRead && (
            <>
              {showQueueButton && (
                <Button variant={queueCount ? 'default' : 'outline'} size="sm" onClick={() => setQueueOpen(true)}>
                  <UserCheck className="h-4 w-4" /> รอฉันเซ็น
                  {queueCount ? <span className="rounded-full bg-white/25 px-1.5 text-xs">{queueCount}</span> : null}
                </Button>
              )}
            </>
          )}
        </PageHeader>

        {!canRead ? (
          <div className="rounded-lg border border-gray-200 bg-white p-6 text-center text-sm text-gray-600">
            คุณไม่มีสิทธิ์เข้าถึงเรื่องแจ้ง/ร้องเรียน (ต้องมีสิทธิ์งานสารบรรณ)
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
            {/* แท็บสถานะ */}
            <div className="flex gap-1 overflow-x-auto border-b border-gray-200 px-3">
              {TABS.map((t) => {
                const active = tab === t.key;
                return (
                  <button key={t.key} onClick={() => { setTab(t.key); setPage(1); }}
                    className={cn('-mb-px flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-3 text-sm font-medium transition-colors',
                      active ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-800')}>
                    {t.label}
                  </button>
                );
              })}
            </div>

            {/* หัวตาราง (จอใหญ่) */}
            <div className={cn('hidden gap-4 border-b border-gray-100 bg-gray-50 px-4 py-2 text-xs font-medium text-gray-500 lg:grid', LIST_GRID)}>
              <span>เวลา</span><span>เรื่อง</span><span>ผู้แจ้ง</span><span>ขั้นอนุมัติ</span><span>สถานะ</span>
            </div>

            {isLoading ? (
              <p className="py-16 text-center text-sm text-gray-400">กำลังโหลด...</p>
            ) : rows.length === 0 ? (
              <div className="py-16 text-center">
                <MessageSquareWarning className="mx-auto h-9 w-9 text-gray-300" />
                <p className="mt-3 text-sm text-gray-500">ยังไม่มีเรื่องแจ้งในหมวดนี้</p>
              </div>
            ) : (
              <ul>
                {rows.map((r, i) => {
                  const hasFile = Array.isArray(r.files) ? r.files.length > 0 : !!r.photoUrl;
                  const created = new Date(r.createdAt);
                  return (
                    <li key={r.id}>
                      {/* แบ่งกลุ่มตามวันที่แจ้ง (เรียงใหม่ → เก่าอยู่แล้ว) — แบบเดียวกับหน้าสารบรรณ */}
                      {isNewDay(rows, i, (x) => x.createdAt) && <DayHeader d={created} />}
                      <button onClick={() => setSel(r)}
                        className={cn('grid w-full grid-cols-1 gap-1.5 border-b border-gray-100 px-4 py-3 text-left transition-colors hover:bg-gray-50 lg:items-center lg:gap-4', LIST_GRID)}>
                        {/* เวลา */}
                        <span className="flex items-center justify-between gap-2 lg:block">
                          <span className="tabular-nums text-sm font-semibold text-gray-900">{timeOf(created)} น.</span>
                          <span className="lg:hidden"><StatusPill status={r.status} /></span>
                        </span>
                        {/* เรื่อง */}
                        <span className="min-w-0">
                          <span className="flex items-center gap-2">
                            <span className="truncate text-sm font-medium text-gray-900">{r.subject || r.category}</span>
                            {isServiceRequest(r.category) && <ServiceTag />}
                            {hasFile && <ImageIcon className="h-3.5 w-3.5 shrink-0 text-gray-400" aria-label="มีไฟล์แนบ" />}
                          </span>
                          <span className="mt-0.5 block truncate text-xs text-gray-400">
                            <span className="font-mono">{r.refNo}</span>
                            {' · '}{r.subject && r.subject !== r.category ? `${r.category} · ` : ''}{r.detail}
                          </span>
                        </span>
                        {/* ผู้แจ้ง */}
                        <span className="min-w-0 text-sm text-gray-500">
                          <span className="block truncate">{r.reporterName || <span className="text-gray-400">ไม่ระบุชื่อ</span>}</span>
                          <span className="block text-xs text-gray-400">
                            {[r.villageNo ? `หมู่ ${r.villageNo}` : '', r.reporterPhone].filter(Boolean).join(' · ') || '—'}
                          </span>
                        </span>
                        {/* ขั้นอนุมัติ */}
                        <span>
                          {r.targetDeptId ? <ApprovalProgress r={r} /> : <span className="text-xs text-gray-400">ยังไม่ส่งกอง</span>}
                        </span>
                        {/* สถานะ */}
                        <span className="hidden lg:block"><StatusPill status={r.status} /></span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}

            {/* แถบท้ายตาราง — แสดงตลอด: ช่วงที่แสดง + จำนวนต่อหน้า + เปลี่ยนหน้า (ปุ่มโผล่เมื่อมีมากกว่า 1 หน้า) */}
            {!isLoading && (
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-600">
                <span>{meta.total ? <>แสดง {from}–{to} จาก <b className="font-medium text-gray-900">{meta.total}</b> เรื่อง · เรียงจากล่าสุด</> : 'ไม่มีรายการ'}</span>
                <div className="flex items-center gap-4">
                  <Pagination page={meta.page} totalPages={meta.totalPages} onChange={setPage} className="flex items-center gap-2" />
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
        )}
      </div>

      {sel && <ReportDetail report={sel} onClose={() => setSel(null)} />}
      {queueOpen && <QueueModal queue={queue || []} onClose={() => setQueueOpen(false)} onSelect={(r) => { setQueueOpen(false); setSel(r); }} />}
    </div>
  );
}

/** กรอบ dialog กลางจอ (คิว/ประวัติ) */
function Dialog({ title, icon, onClose, wide, children }: { title: string; icon: React.ReactNode; onClose: () => void; wide?: boolean; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className={cn('flex max-h-[85vh] w-full flex-col overflow-hidden rounded-lg bg-white shadow-lg', wide ? 'max-w-3xl' : 'max-w-2xl')} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
          <h3 className="flex items-center gap-2 text-base font-semibold text-gray-900">{icon} {title}</h3>
          <button onClick={onClose} className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600" aria-label="ปิด"><X className="h-5 w-5" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

/** คิว "รอฉันเซ็น" — เรื่องที่ถึงตาผู้ใช้คนนี้พอดี (ผอ.กองเป้าหมาย/บทบาทปลัด/บทบาทนายก) */
function QueueModal({ queue, onClose, onSelect }: { queue: any[]; onClose: () => void; onSelect: (r: any) => void }) {
  return (
    <Dialog title="รอฉันเซ็น" icon={<UserCheck className="h-5 w-5 text-blue-600" />} onClose={onClose}>
      <div className="overflow-y-auto">
        {queue.length === 0 ? (
          <p className="py-14 text-center text-sm text-gray-400">ไม่มีเรื่องรอคุณเซ็นตอนนี้</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {queue.map((r) => (
              <li key={r.id}>
                <button onClick={() => onSelect(r)} className="flex w-full items-center gap-4 px-5 py-3 text-left hover:bg-gray-50">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-gray-500">{r.refNo}</span>
                      {isServiceRequest(r.category) && <ServiceTag />}
                    </div>
                    <p className="truncate text-sm font-medium text-gray-900">{r.category}</p>
                    <p className="text-xs text-gray-500">{r.targetDeptName}</p>
                  </div>
                  <ApprovalProgress r={r} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Dialog>
  );
}

/** แสดงคำตอบทุกฟิลด์ตาม config ฟอร์ม (fallback เป็น detail สำหรับเรื่องเก่า) */
// ฟิลด์ภายในของ "คำร้องทั่วไป" (เก็บใน answers jsonb เดียวกับฟอร์มเอนจิน) — มีโชว์ในเอกสาร PDF อยู่แล้ว
// ไม่ต้องดัมพ์ซ้ำตรงนี้ กันหน้ารก + กันบังข้อความ "ความประสงค์" จริงที่ควรโชว์แทน
const PETITION_INTERNAL_KEYS = ['titlePrefix', 'houseNo', 'subDistrict', 'district', 'province', 'docDate'];

function Answers({ report }: { report: any }) {
  const def = report.formKey ? getForm(report.formKey) : undefined;
  const labelOf = (name: string) => def?.sections.flatMap((s) => s.fields).find((f) => f.name === name)?.label || name;
  const entries = report.answers && typeof report.answers === 'object'
    ? Object.entries(report.answers).filter(([k, v]) => !PETITION_INTERNAL_KEYS.includes(k) && v != null && String(v).trim() !== '')
    : [];
  if (!entries.length) return <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-800">{report.detail}</p>;
  return (
    <dl className="divide-y divide-gray-100 rounded-md border border-gray-200">
      {entries.map(([k, v]) => (
        <div key={k} className="flex flex-col gap-0.5 px-3 py-2 sm:flex-row sm:gap-3">
          <dt className="w-40 shrink-0 wrap-break-word text-xs text-gray-500">{labelOf(k)}</dt>
          <dd className="min-w-0 flex-1 whitespace-pre-wrap wrap-break-word text-sm text-gray-800">{String(v)}</dd>
        </div>
      ))}
    </dl>
  );
}

type ReportComment = { id: string; body: string; createdAt: string; userId: string; user?: { titleTh?: string; fullNameTh: string; positionName?: string } };

/** ความเห็นภายในของเจ้าหน้าที่ — เรียงตามเวลา ประชาชนไม่เห็น · ลบได้เฉพาะของตัวเอง (ผู้ดูแลลบได้ทุกอัน) */
function CommentsSection({ reportId }: { reportId: string }) {
  const qc = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const admin = isAdminUser(user);
  const [text, setText] = useState('');
  const { data: comments = [] } = useQuery({
    queryKey: ['citizen-report-comments', reportId],
    queryFn: async () => (await api.get(`/citizen-reports/${reportId}/comments`)).data.data as ReportComment[],
  });
  const add = useMutation({
    mutationFn: () => api.post(`/citizen-reports/${reportId}/comments`, { body: text.trim() }),
    onSuccess: () => { setText(''); qc.invalidateQueries({ queryKey: ['citizen-report-comments', reportId] }); },
    onError: (e) => toast.error(getErrorMessage(e, 'ส่งความเห็นไม่สำเร็จ')),
  });
  const del = useMutation({
    mutationFn: (cid: string) => api.delete(`/citizen-reports/${reportId}/comments/${cid}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['citizen-report-comments', reportId] }),
    onError: (e) => toast.error(getErrorMessage(e, 'ลบไม่สำเร็จ')),
  });
  return (
    <Section title={`ความเห็น${comments.length ? ` (${comments.length})` : ''}`} aside={<span className="text-xs text-gray-400">เห็นเฉพาะเจ้าหน้าที่</span>}>
      {comments.length === 0 ? (
        <p className="mb-3 flex items-center gap-1.5 text-sm text-gray-400"><MessageSquare className="h-4 w-4" /> ยังไม่มีความเห็น</p>
      ) : (
        <ul className="mb-3 space-y-3">
          {comments.map((c) => (
            <li key={c.id} className="group rounded-md border border-gray-200 px-3 py-2.5">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-medium text-gray-900">
                  {c.user ? `${c.user.titleTh || ''}${c.user.fullNameTh}` : 'ไม่ทราบชื่อ'}
                  {c.user?.positionName && <span className="ml-1.5 text-xs font-normal text-gray-500">{c.user.positionName}</span>}
                </p>
                {(c.userId === user?.id || admin) && (
                  <button onClick={() => { if (confirm('ลบความเห็นนี้?')) del.mutate(c.id); }} title="ลบความเห็น" aria-label="ลบความเห็น"
                    className="shrink-0 rounded p-0.5 text-gray-300 hover:bg-red-50 hover:text-red-500"><Trash2 className="h-3.5 w-3.5" /></button>
                )}
              </div>
              <p className="mt-1 whitespace-pre-wrap wrap-break-word text-sm text-gray-800">{c.body}</p>
              <p className="mt-1 text-xs text-gray-400">{dt(c.createdAt)}</p>
            </li>
          ))}
        </ul>
      )}
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} maxLength={2000}
        placeholder="พิมพ์ความเห็น เช่น ฝากกองช่างลงพื้นที่ตรวจสอบ" className={inputCls}
        onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && text.trim()) add.mutate(); }} />
      <div className="mt-2 flex items-center justify-between">
        <span className="text-xs text-gray-400">Ctrl+Enter เพื่อส่ง</span>
        <Button size="sm" onClick={() => add.mutate()} disabled={!text.trim()} loading={add.isPending}><Send className="h-3.5 w-3.5" /> ส่งความเห็น</Button>
      </div>
    </Section>
  );
}

/** เอกสารของเรื่อง — อัปโหลดได้หลายไฟล์ (PDF/รูป) · กด "เปิด / เซ็น" เพื่อลากลายเซ็นของตัวเองไปวาง */
function DocumentsSection({ reportId, summary }: { reportId: string; summary: Record<string, { ownerId: string; name: string }[]> }) {
  const qc = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const admin = isAdminUser(user);
  const [uploading, setUploading] = useState(false);
  const { data: files = [] } = useQuery({
    queryKey: ['attachments', 'citizen-report', reportId],
    queryFn: () => listFilesByRef('citizen-report', reportId),
  });
  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const list = Array.from(e.target.files || []); e.target.value = '';
    if (!list.length) return;
    setUploading(true);
    try {
      await uploadFiles(list, { refType: 'citizen-report', refId: reportId });
      await qc.invalidateQueries({ queryKey: ['attachments', 'citizen-report', reportId] });
      toast.success(`อัปโหลดแล้ว ${list.length} ไฟล์`);
    } catch (err) { toast.error(getErrorMessage(err, 'อัปโหลดไม่สำเร็จ')); }
    finally { setUploading(false); }
  };
  const remove = async (fid: string, name: string) => {
    if (!confirm(`ลบเอกสาร "${name}"? (ลายเซ็นที่วางไว้ในเอกสารนี้จะหายไปด้วย)`)) return;
    try {
      await deleteUploadedFile(fid);
      await qc.invalidateQueries({ queryKey: ['attachments', 'citizen-report', reportId] });
    } catch (err) { toast.error(getErrorMessage(err, 'ลบไม่สำเร็จ')); }
  };
  return (
    <Section title={`เอกสาร${files.length ? ` (${files.length})` : ''}`}
      aside={(
        <label className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'cursor-pointer', uploading && 'pointer-events-none opacity-50')}>
          <Upload className="h-3.5 w-3.5" /> {uploading ? 'กำลังอัปโหลด...' : 'อัปโหลดเอกสาร'}
          <input type="file" multiple accept="application/pdf,image/png,image/jpeg" className="hidden" onChange={onPick} />
        </label>
      )}>
      {files.length === 0 ? (
        <p className="flex items-start gap-1.5 text-sm text-gray-400">
          <FileText className="mt-0.5 h-4 w-4 shrink-0" /> ยังไม่มีเอกสาร — อัปโหลดเอกสาร (PDF หรือรูป) แล้วผู้อนุมัติแต่ละคนเปิดเซ็นได้
        </p>
      ) : (
        <ul className="divide-y divide-gray-100 rounded-md border border-gray-200">
          {files.map((f: any) => {
            const signers = (summary[f.id] || []).filter((x, i, a) => a.findIndex((y) => y.ownerId === x.ownerId) === i);
            const mine = signers.some((x) => x.ownerId === user?.id);
            return (
              <li key={f.id} className="flex items-center gap-3 px-3 py-2.5">
                <FileText className="h-4 w-4 shrink-0 text-gray-400" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-gray-900">{f.originalName}</p>
                  <p className="truncate text-xs text-gray-500">
                    {signers.length ? `เซ็นแล้ว: ${signers.map((x) => x.name.replace(/[()]/g, '') || 'ไม่ทราบชื่อ').join(', ')}` : 'ยังไม่มีใครเซ็น'}
                  </p>
                </div>
                {mine && <span className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-green-700"><Check className="h-3.5 w-3.5" />ฉันเซ็นแล้ว</span>}
                <Link href={`/citizen-reports/${reportId}/editor?file=${f.id}`} className={cn(buttonVariants({ size: 'sm', variant: mine ? 'outline' : 'default' }), 'shrink-0')}>
                  <FilePen className="h-3.5 w-3.5" /> {mine ? 'เปิด' : 'เปิด / เซ็น'}
                </Link>
                {(f.uploadedBy === user?.id || admin) && (
                  <button onClick={() => remove(f.id, f.originalName)} title="ลบเอกสาร" aria-label="ลบเอกสาร"
                    className="shrink-0 rounded p-1 text-gray-300 hover:bg-red-50 hover:text-red-500"><Trash2 className="h-4 w-4" /></button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Section>
  );
}

/** หัวข้อแต่ละส่วนในแผงรายละเอียด */
function Section({ title, children, aside }: { title: string; children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <section className="border-t border-gray-100 px-6 py-5 first:border-t-0">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500">{title}</h4>
        {aside}
      </div>
      {children}
    </section>
  );
}

function InfoRow({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 py-1.5 text-sm">
      <span className="mt-0.5 text-gray-400">{icon}</span>
      <span className="w-24 shrink-0 text-gray-500">{label}</span>
      <span className="min-w-0 flex-1 wrap-break-word text-gray-900">{children}</span>
    </div>
  );
}

const inputCls = 'w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100';

function ReportDetail({ report, onClose }: { report: any; onClose: () => void }) {
  const qc = useQueryClient();
  const [note, setNote] = useState(report.staffNote || '');
  const [deptPick, setDeptPick] = useState('');
  const [editOpen, setEditOpen] = useState(false);
  const [subject, setSubject] = useState(report.subject || '');
  const [edName, setEdName] = useState(report.reporterName || '');
  const [edPhone, setEdPhone] = useState(report.reporterPhone || '');
  const [edVillage, setEdVillage] = useState(report.villageNo ? String(report.villageNo) : '');
  const [edLocation, setEdLocation] = useState(report.location || '');
  const [edDetail, setEdDetail] = useState(report.detail || '');
  const canUpdate = useAuthStore((s) => s.hasPermission('complaint:manage:Report'));
  const canDelete = useAuthStore((s) => s.hasPermission('complaint:delete:Report'));
  const user = useAuthStore((s) => s.user);
  const isMayor = (user?.roles || []).some((r) => r === 'MAYOR' || r === 'DEPUTY_MAYOR');

  const { data: depts } = useQuery({
    queryKey: ['departments', user?.organizationId],
    queryFn: async () => (await api.get(`/organizations/${user?.organizationId}/departments`)).data.data as any[],
    enabled: canUpdate && !!user?.organizationId,
  });

  const route = useMutation({
    mutationFn: () => api.patch(`/citizen-reports/${report.id}/route`, { targetDeptId: deptPick }),
    onSuccess: () => { toast.success('ส่งไปกองแล้ว'); qc.invalidateQueries({ queryKey: ['citizen-report', report.id] }); qc.invalidateQueries({ queryKey: ['citizen-reports'] }); },
    onError: (e) => toast.error(getErrorMessage(e, 'ส่งไม่สำเร็จ')),
  });

  const approve = useMutation({
    mutationFn: () => api.patch(`/citizen-reports/${report.id}/approve`, {}),
    onSuccess: () => {
      toast.success('อนุมัติและส่งต่อแล้ว');
      qc.invalidateQueries({ queryKey: ['citizen-report', report.id] });
      qc.invalidateQueries({ queryKey: ['citizen-reports'] });
      qc.invalidateQueries({ queryKey: ['citizen-reports-my-queue'] });
    },
    onError: (e) => toast.error(getErrorMessage(e, 'อนุมัติไม่สำเร็จ')),
  });

  const saveEdit = useMutation({
    mutationFn: () => api.patch(`/citizen-reports/${report.id}`, {
      subject: subject.trim(), reporterName: edName, reporterPhone: edPhone,
      villageNo: edVillage, location: edLocation, detail: edDetail,
    }),
    onSuccess: () => {
      toast.success('บันทึกแก้ไขแล้ว');
      qc.invalidateQueries({ queryKey: ['citizen-report', report.id] });
      qc.invalidateQueries({ queryKey: ['citizen-reports'] });
      setEditOpen(false);
    },
    onError: (e) => toast.error(getErrorMessage(e, 'บันทึกไม่สำเร็จ')),
  });

  const del = useMutation({
    mutationFn: () => api.delete(`/citizen-reports/${report.id}`),
    onSuccess: () => { toast.success('ลบเรื่องแล้ว'); qc.invalidateQueries({ queryKey: ['citizen-reports'] }); onClose(); },
    onError: (e) => toast.error(getErrorMessage(e, 'ลบไม่สำเร็จ')),
  });

  // ดึงรายละเอียดเต็ม (url ไฟล์ sign แล้ว) — เรื่องจาก list ยังไม่ได้ sign
  // ใช้ placeholderData (ไม่ใช่ initialData) + staleTime:0 เพื่อบังคับ refetch เสมอ ไม่งั้น url ไฟล์ไม่ถูก sign
  const { data: r = report } = useQuery({
    queryKey: ['citizen-report', report.id],
    queryFn: async () => (await api.get(`/citizen-reports/${report.id}`)).data.data,
    placeholderData: report,
    staleTime: 0,
    refetchOnMount: 'always',
  });

  const save = useMutation({
    mutationFn: (status?: string) => api.patch(`/citizen-reports/${report.id}`, { status, staffNote: note }),
    onSuccess: () => { toast.success('บันทึกแล้ว'); qc.invalidateQueries({ queryKey: ['citizen-reports'] }); onClose(); },
    onError: (e) => toast.error(getErrorMessage(e, 'บันทึกไม่สำเร็จ')),
  });

  // นายก/รองนายกปิดเรื่องเป็น "เสร็จสิ้น" ตรง ๆ — endpoint แยกจาก save เพราะ MAYOR มีแค่สิทธิ์อ่าน ไม่มีสิทธิ์จัดการทั่วไป
  const closeMayor = useMutation({
    mutationFn: () => api.patch(`/citizen-reports/${report.id}/close`),
    onSuccess: () => { toast.success('ปิดเรื่องแล้ว'); qc.invalidateQueries({ queryKey: ['citizen-reports'] }); onClose(); },
    onError: (e) => toast.error(getErrorMessage(e, 'ปิดเรื่องไม่สำเร็จ')),
  });

  const hasFiles = Array.isArray(r.files) && r.files.length > 0;
  // ใครวางลายเซ็นไว้ในเอกสารไหน — ต้องวางลายเซ็นของตัวเองอย่างน้อย 1 เอกสารก่อน "อนุมัติ / ส่งต่อ" (เซิร์ฟเวอร์ตรวจซ้ำ)
  const { data: docSummary = {} } = useQuery({
    queryKey: ['citizen-report-doc-summary', report.id],
    queryFn: async () => (await api.get(`/citizen-reports/${report.id}/doc-summary`)).data.data as Record<string, { ownerId: string; name: string }[]>,
  });
  const iSigned = Object.values(docSummary).some((list) => list.some((x) => x.ownerId === user?.id));

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onClick={onClose}>
      {/* แผงรายละเอียดเลื่อนออกด้านขวา — อ่านเป็นหัวข้อจากบนลงล่าง */}
      <aside className="flex h-full w-full max-w-xl flex-col bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
        <header className="border-b border-gray-200 px-6 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs text-gray-500">{r.refNo}</span>
                <StatusPill status={r.status} />
                {isServiceRequest(r.category) && <ServiceTag />}
              </div>
              {editOpen ? (
                <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="เรื่อง (จะใช้พิมพ์ในเอกสาร)"
                  className={cn(inputCls, 'mt-2 text-base font-semibold')} />
              ) : (
                <h3 className="mt-1.5 text-lg font-semibold text-gray-900">{r.subject || r.category}</h3>
              )}
              <p className="mt-0.5 text-xs text-gray-500">
                {r.subject && r.subject !== r.category ? `${r.category} · ` : ''}แจ้งเมื่อ {dt(r.createdAt)}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              {canUpdate && (
                <button onClick={() => setEditOpen((v) => !v)} title="แก้ไขข้อมูลเอกสาร" aria-label="แก้ไขข้อมูลเอกสาร"
                  className={cn('rounded-md p-1.5', editOpen ? 'bg-blue-50 text-blue-600' : 'text-gray-400 hover:bg-gray-100 hover:text-gray-700')}>
                  <Pencil className="h-4 w-4" />
                </button>
              )}
              <button onClick={onClose} className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700" aria-label="ปิด"><X className="h-5 w-5" /></button>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto">
          {editOpen ? (
            <Section title="แก้ไขข้อมูล">
              <div className="space-y-3">
                <label className="block"><span className="mb-1 block text-xs font-medium text-gray-600">ชื่อผู้แจ้ง</span>
                  <input value={edName} onChange={(e) => setEdName(e.target.value)} className={inputCls} /></label>
                <div className="flex gap-3">
                  <label className="flex-1"><span className="mb-1 block text-xs font-medium text-gray-600">เบอร์โทร</span>
                    <input value={edPhone} onChange={(e) => setEdPhone(e.target.value)} className={inputCls} /></label>
                  <label className="w-24"><span className="mb-1 block text-xs font-medium text-gray-600">หมู่ที่</span>
                    <input value={edVillage} onChange={(e) => setEdVillage(e.target.value)} className={inputCls} /></label>
                </div>
                <label className="block"><span className="mb-1 block text-xs font-medium text-gray-600">ที่อยู่/จุดเกิดเหตุ</span>
                  <input value={edLocation} onChange={(e) => setEdLocation(e.target.value)} className={inputCls} /></label>
                <label className="block"><span className="mb-1 block text-xs font-medium text-gray-600">รายละเอียด/ความประสงค์</span>
                  <textarea value={edDetail} onChange={(e) => setEdDetail(e.target.value)} rows={4} maxLength={2000} className={inputCls} /></label>
                <div className="flex gap-2 pt-1">
                  <Button onClick={() => saveEdit.mutate()} loading={saveEdit.isPending}>บันทึกการแก้ไข</Button>
                  <Button variant="outline" onClick={() => setEditOpen(false)}>ยกเลิก</Button>
                </div>
              </div>
            </Section>
          ) : (
            <>
              <Section title="ผู้แจ้ง">
                <InfoRow icon={<User className="h-4 w-4" />} label="ชื่อ">{r.reporterName || <span className="text-gray-400">ไม่ระบุ</span>}</InfoRow>
                <InfoRow icon={<Phone className="h-4 w-4" />} label="เบอร์โทร">{r.reporterPhone || <span className="text-gray-400">—</span>}</InfoRow>
                <InfoRow icon={<MapPin className="h-4 w-4" />} label="หมู่ / ที่อยู่">
                  {[r.villageNo ? `หมู่ ${r.villageNo}` : '', r.location].filter(Boolean).join(' · ') || <span className="text-gray-400">—</span>}
                </InfoRow>
                {r.geo && (
                  <a href={`https://www.openstreetmap.org/?mlat=${r.geo.lat}&mlon=${r.geo.lng}#map=17/${r.geo.lat}/${r.geo.lng}`} target="_blank" rel="noreferrer"
                    className="mt-1 inline-flex items-center gap-1.5 text-sm text-blue-600 hover:underline">
                    <ExternalLink className="h-3.5 w-3.5" /> ดูตำแหน่งบนแผนที่
                  </a>
                )}
              </Section>

              <Section title="รายละเอียด">
                <Answers report={r} />
              </Section>

              {(hasFiles || r.photoUrl) && (
                <Section title={hasFiles ? `ไฟล์แนบ (${r.files.length})` : 'ไฟล์แนบ'}>
                  {hasFiles ? (
                    <div className="grid grid-cols-2 gap-2">
                      {r.files.map((f: any, i: number) => (isImg(f.name || f.url) ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <a key={i} href={normUrl(f.url)} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-md border border-gray-200">
                          <img src={normUrl(f.url)} alt={f.name || 'รูปแนบ'} className="h-32 w-full bg-gray-50 object-cover" />
                        </a>
                      ) : (
                        <a key={i} href={normUrl(f.url)} target="_blank" rel="noreferrer" className="col-span-2 flex items-center gap-2 rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">
                          <Download className="h-4 w-4 shrink-0 text-gray-400" /> <span className="truncate">{f.name || 'ไฟล์แนบ'}</span>
                          <ExternalLink className="ml-auto h-3.5 w-3.5 shrink-0 text-gray-300" />
                        </a>
                      )))}
                    </div>
                  ) : (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <a href={normUrl(r.photoUrl)} target="_blank" rel="noreferrer"><img src={normUrl(r.photoUrl)} alt="รูปแนบ" className="max-h-72 w-full rounded-md border border-gray-200 object-contain" /></a>
                  )}
                </Section>
              )}

              {/* เอกสาร — เจ้าหน้าที่อัปโหลดเอง (หลายไฟล์) แล้วผู้อนุมัติแต่ละคนเปิดลากลายเซ็นของตัวเองไปวาง */}
              <DocumentsSection reportId={r.id} summary={docSummary} />

              {/* ขั้นตอนอนุมัติ 3 ผู้เซ็น (ผอ.กอง → ปลัด → นายก) — คนละกลไกกับสารบรรณทั้งหมด */}
              {r.targetDeptId && (
                <Section title="การอนุมัติ" aside={<span className="text-xs text-gray-500">ส่งไป {r.targetDept?.nameTh}</span>}>
                  <ApprovalTimeline r={r} />
                  {isMyApprovalTurn(r, user) && (
                    <>
                      <Button className="mt-4 w-full" disabled={!iSigned} loading={approve.isPending}
                        onClick={() => { if (confirm('ยืนยันอนุมัติและส่งต่อขั้นถัดไป?')) approve.mutate(); }}>
                        <CheckCircle2 className="h-4 w-4" />
                        {isAdminUser(user) && !isMyOwnTurn(r, user) ? `อนุมัติแทน ${currentApprovalStep(r)} / ส่งต่อ` : 'อนุมัติ / ส่งต่อ'}
                      </Button>
                      {!iSigned && <p className="mt-2 text-center text-xs text-amber-700">เปิดเอกสารด้านบนแล้วลาก &quot;ลายเซ็นของฉัน&quot; ไปวางก่อน จึงจะส่งต่อได้</p>}
                    </>
                  )}
                </Section>
              )}
              <CommentsSection reportId={r.id} />
            </>
          )}

          {canUpdate ? (
            <Section title="การดำเนินการ">
              <div className="space-y-3">
                {/* "ส่งไปกองเพื่ออนุมัติ" — เลือกกองแล้วกดส่งได้เลย ทำให้สถานะเป็นกำลังดำเนินการทันที */}
                {!r.targetDeptId && (
                  <div>
                    <span className="mb-1 block text-xs font-medium text-gray-600">ส่งไปกองเพื่ออนุมัติ</span>
                    <div className="flex gap-2">
                      <select value={deptPick} onChange={(e) => setDeptPick(e.target.value)} className={cn(inputCls, 'flex-1')}>
                        <option value="">เลือกกอง...</option>
                        {depts?.map((d) => <option key={d.id} value={d.id}>{d.nameTh}</option>)}
                      </select>
                      <Button onClick={() => route.mutate()} disabled={!deptPick} loading={route.isPending}>
                        <Send className="h-4 w-4" /> ส่ง
                      </Button>
                    </div>
                  </div>
                )}
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-gray-600">บันทึกการดำเนินการ (ภายใน)</span>
                  <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2}
                    placeholder="เช่น แจ้งกองช่างแล้ว / ดำเนินการเสร็จ" className={inputCls} />
                </label>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={() => save.mutate(undefined)} disabled={save.isPending}>บันทึกหมายเหตุ</Button>
                  {!r.targetDeptId && (
                    <Button variant="outline" onClick={() => save.mutate('rejected')} disabled={save.isPending}>ปฏิเสธเรื่อง</Button>
                  )}
                  {/* ปิดเรื่องเป็น "เสร็จสิ้น" ได้เฉพาะนายก/รองนายก — คนอื่นต้องผ่าน "ส่งไปกองเพื่ออนุมัติ" แล้วให้ขั้นตอน 3 ผู้เซ็นปิดให้แทน */}
                  {!r.targetDeptId && isMayor && (
                    <Button variant="success" onClick={() => closeMayor.mutate()} loading={closeMayor.isPending}>เสร็จสิ้น (นายก)</Button>
                  )}
                </div>
              </div>
            </Section>
          ) : (
            <p className="border-t border-gray-100 px-6 py-4 text-center text-xs text-gray-400">ดูอย่างเดียว — ไม่มีสิทธิ์เปลี่ยนสถานะ</p>
          )}

          {canDelete && (
            <div className="border-t border-gray-100 px-6 py-4">
              <button onClick={() => { if (confirm(`ลบเรื่อง ${r.refNo}? (ลบถาวร ใช้สำหรับล้างข้อมูลทดสอบ)`)) del.mutate(); }}
                disabled={del.isPending}
                className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-red-600 disabled:opacity-60">
                <Trash2 className="h-3.5 w-3.5" /> ลบเรื่องนี้ (เฉพาะผู้ดูแลระบบ)
              </button>
            </div>
          )}

          <div className="flex items-center gap-1.5 px-6 pb-6 text-xs text-gray-400">
            <Clock className="h-3.5 w-3.5" /> แจ้งเมื่อ {dt(r.createdAt)}
          </div>
        </div>
      </aside>

    </div>
  );
}
