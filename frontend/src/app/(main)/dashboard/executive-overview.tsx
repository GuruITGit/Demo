'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';
import { useDisabledModules } from '@/hooks/use-modules';
import type { LucideIcon } from 'lucide-react';
import { PenLine, Layers, AlarmClock, CheckCircle2, ChevronDown, ChevronRight, Users, Megaphone, Mail } from 'lucide-react';

/**
 * มุมมองผู้บริหาร (ปลัด/นายก/admin) — ตอบ 3 คำถาม: อะไรรอฉัน · งานอยู่ขั้นไหน · ใครถือเรื่องอะไรค้างกี่วัน
 * ข้อมูลจาก GET correspondence/tickets/overview + citizen-reports/overview (scope ตามสิทธิ์ที่ backend)
 */

type Item = { id: string; ticketNumber?: string; refNo?: string; subject: string; days: number };
type Holder = { key: string; kind: 'person' | 'clerk' | 'mayor' | 'dept'; name: string; position?: string; dept?: string; count: number; oldestDays: number; items: Item[] };
type TicketOverview = { total: number; stale7: number; byStep: { person: number; clerk: number; mayor: number; completedThisMonth: number }; holders: Holder[] };
type MyTask = { id: string; ticketNumber: string; subject: string; updatedAt?: string };
type QueueReport = { id: string; refNo: string; category?: string; detail?: string; createdAt: string };
type ReportOverview = { total: number; stale7: number; byStep: { new: number; clerk: number; mayor: number; doneThisMonth: number; deptHead: { dept: string; count: number }[] }; mayorQueue: Item[] };

/** สีจำนวนวันค้าง — เกิน 7 วันส้ม เกิน 14 วันแดง */
const dayTone = (d: number) => (d > 14 ? 'text-red-600' : d > 7 ? 'text-orange-600' : 'text-gray-500');
const dayText = (d: number) => (d === 0 ? 'วันนี้' : `${d} วัน`);
const daysSince = (iso?: string) => (iso ? Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)) : 0);

function Stat({ label, value, icon: Icon, tone, href, hint }: { label: string; value: number; icon: LucideIcon; tone: string; href: string; hint?: string }) {
  return (
    <Link href={href} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm hover:border-blue-300 transition flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-sm text-gray-500">{label}</p>
        <p className="text-3xl font-bold text-gray-900 tabular-nums mt-1">{value.toLocaleString()}</p>
        {hint && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
      </div>
      <span className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${tone}`}><Icon className="h-6 w-6" /></span>
    </Link>
  );
}

/** การ์ดขั้นตอนงานแนวตั้ง — แต่ละขั้นบอกจำนวนเรื่อง (ขั้นสุดท้าย = เสร็จเดือนนี้) */
function Pipeline({ title, icon: Icon, steps, href, grow }: { title: string; icon: LucideIcon; grow?: boolean; steps: { label: string; sub?: string; count: number; done?: boolean }[]; href: string }) {
  return (
    <div className={`bg-white rounded-2xl border border-gray-200 shadow-sm px-5 pt-4 pb-1 ${grow ? 'flex-1' : ''}`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-gray-900 text-sm flex items-center gap-2"><Icon className="h-4 w-4 text-blue-500" />{title}</h3>
        <Link href={href} className="text-xs text-blue-600 hover:underline">ดูทั้งหมด</Link>
      </div>
      <ol className="relative">
        {steps.map((s, i) => (
          <li key={s.label} className="flex gap-3">
            <div className="flex flex-col items-center">
              <span className={`w-3 h-3 rounded-full mt-1.5 ${s.done ? 'bg-emerald-500' : s.count > 0 ? 'bg-blue-600' : 'bg-gray-300'}`} />
              {i < steps.length - 1 && <span className="w-px flex-1 bg-gray-200 my-1" />}
            </div>
            <div className="flex-1 flex items-start justify-between gap-3 pb-3">
              <div className="min-w-0">
                <p className={`text-sm ${s.count > 0 ? 'text-gray-900 font-medium' : 'text-gray-500'}`}>{s.label}</p>
                {s.sub && <p className="text-xs text-gray-400 mt-0.5">{s.sub}</p>}
              </div>
              <span className={`text-lg font-bold tabular-nums ${s.done ? 'text-emerald-600' : s.count > 0 ? 'text-gray-900' : 'text-gray-300'}`}>{s.count}</span>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

/** ตาราง "งานอยู่ที่ใคร" — กดแถวเพื่อกางรายการเรื่อง */
function HolderTable({ holders }: { holders: Holder[] }) {
  const [open, setOpen] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const LIMIT = 8;
  const shown = showAll ? holders : holders.slice(0, LIMIT);
  return (
    <div id="holders" className="bg-white rounded-2xl border border-gray-200 shadow-sm">
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
        <h3 className="font-semibold text-gray-900 text-sm flex items-center gap-2"><Users className="h-4 w-4 text-blue-500" />งานสารบรรณอยู่ที่ใคร</h3>
        <span className="text-xs text-gray-400">เรียงตามค้างนานสุด · กดชื่อเพื่อดูเรื่อง</span>
      </div>
      {holders.length === 0 ? <p className="py-10 text-center text-sm text-gray-400">ไม่มีงานค้าง</p> : (
        <div className="divide-y divide-gray-100">
          <div className="hidden sm:grid grid-cols-[1fr_8rem_8rem] gap-3 px-5 py-2 text-xs text-gray-400">
            <span>ผู้ถือเรื่อง</span><span className="text-right">จำนวนเรื่อง</span><span className="text-right">ค้างนานสุด</span>
          </div>
          {shown.map((h) => {
            const isOpen = open === h.key;
            return (
              <div key={h.key}>
                <button onClick={() => setOpen(isOpen ? null : h.key)}
                  className="w-full grid grid-cols-[1fr_auto] sm:grid-cols-[1fr_8rem_8rem] gap-3 items-center px-5 py-3 text-left hover:bg-gray-50 transition-colors">
                  <span className="flex items-center gap-2 min-w-0">
                    {isOpen ? <ChevronDown className="h-4 w-4 text-gray-400 shrink-0" /> : <ChevronRight className="h-4 w-4 text-gray-400 shrink-0" />}
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-gray-900 truncate">{h.name}</span>
                      <span className="block text-xs text-gray-500 truncate">{[h.position, h.dept].filter(Boolean).join(' · ')}</span>
                    </span>
                  </span>
                  <span className="text-right text-sm tabular-nums text-gray-900">
                    <b>{h.count}</b> เรื่อง
                    <span className={`sm:hidden block text-xs ${dayTone(h.oldestDays)}`}>ค้าง {dayText(h.oldestDays)}</span>
                  </span>
                  <span className={`hidden sm:block text-right text-sm font-semibold tabular-nums ${dayTone(h.oldestDays)}`}>{dayText(h.oldestDays)}</span>
                </button>
                {isOpen && (
                  <div className="bg-gray-50/70 border-t border-gray-100">
                    {h.items.map((it) => (
                      <Link key={it.id} href={`/correspondence/tickets/${it.id}`}
                        className="flex items-center gap-3 pl-11 pr-5 py-2.5 hover:bg-blue-50/50 transition-colors">
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm text-gray-800 truncate">{it.subject}</span>
                          <span className="block text-xs text-gray-400 font-mono">{it.ticketNumber}</span>
                        </span>
                        <span className={`text-xs tabular-nums shrink-0 ${dayTone(it.days)}`}>รอ {dayText(it.days)}</span>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          {holders.length > LIMIT && (
            <button onClick={() => setShowAll(!showAll)} className="w-full px-5 py-3 text-sm text-blue-600 hover:bg-gray-50 transition-colors">
              {showAll ? 'แสดงน้อยลง' : `แสดงทั้งหมด ${holders.length} คน`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export function ExecutiveOverview({ myTasks }: { myTasks: MyTask[] }) {
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const disabled = useDisabledModules();
  const canReports = hasPermission('complaint:read:Report') && !disabled.includes('citizen-reports');

  const { data: tk } = useQuery({
    queryKey: ['exec-overview', 'tickets'],
    queryFn: async () => (await api.get('/correspondence/tickets/overview')).data.data as TicketOverview,
    refetchInterval: 60_000,
  });
  const { data: cr } = useQuery({
    queryKey: ['exec-overview', 'reports'],
    queryFn: async () => (await api.get('/citizen-reports/overview')).data.data as ReportOverview,
    enabled: canReports, retry: false, refetchInterval: 60_000,
  });
  const { data: crQueue } = useQuery({
    queryKey: ['citizen-reports-my-queue'],
    queryFn: async () => (await api.get('/citizen-reports/my-queue')).data.data as QueueReport[],
    enabled: canReports, retry: false, refetchInterval: 60_000,
  });

  // จำนวนวันที่รอ ของแต่ละเรื่อง (จาก overview) — ใช้กับรายการ "งานรอท่าน"
  const ticketDays = new Map<string, number>();
  tk?.holders.forEach((h) => h.items.forEach((it) => ticketDays.set(it.id, it.days)));
  const reportDays = new Map<string, number>((cr?.mayorQueue ?? []).map((it) => [it.id, it.days]));

  const waiting = [
    ...myTasks.map((t) => ({ id: t.id, kind: 'ticket' as const, no: t.ticketNumber, subject: t.subject, days: ticketDays.get(t.id) ?? daysSince(t.updatedAt) })),
    ...(crQueue ?? []).map((r) => ({ id: r.id, kind: 'report' as const, no: r.refNo, subject: r.category ? `${r.category} — ${r.detail ?? ''}` : r.detail, days: reportDays.get(r.id) ?? daysSince(r.createdAt) })),
  ].sort((a, b) => b.days - a.days);

  const openTotal = (tk?.total ?? 0) + (cr?.total ?? 0);
  const stale = (tk?.stale7 ?? 0) + (cr?.stale7 ?? 0);
  const doneMonth = (tk?.byStep.completedThisMonth ?? 0) + (cr?.byStep.doneThisMonth ?? 0);
  const deptHeadTotal = (cr?.byStep.deptHead ?? []).reduce((s, d) => s + d.count, 0);

  return (
    <div className="space-y-6">
      {/* ── ตัวเลขหลัก ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat label="รอท่านดำเนินการ" value={waiting.length} icon={PenLine} tone="bg-blue-50 text-blue-600" href="/correspondence/tickets?box=todo" />
        <Stat label="งานที่ยังไม่เสร็จ" value={openTotal} icon={Layers} tone="bg-amber-50 text-amber-600" href="/dashboard/work?view=open"
          hint={canReports ? `สารบรรณ ${tk?.total ?? 0} · ร้องเรียน ${cr?.total ?? 0}` : undefined} />
        <Stat label="ค้างเกิน 7 วัน" value={stale} icon={AlarmClock} tone={stale ? 'bg-red-50 text-red-600' : 'bg-gray-50 text-gray-400'} href="/dashboard/work?view=stale" />
        <Stat label="เสร็จเดือนนี้" value={doneMonth} icon={CheckCircle2} tone="bg-emerald-50 text-emerald-600" href="/dashboard/work?view=done" />
      </div>

      {/* ── แถว 2: งานรอท่าน | ขั้นตอนงาน (สูงเท่ากัน) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:items-stretch">
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-200 shadow-sm flex flex-col min-h-0">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900 text-sm flex items-center gap-2"><PenLine className="h-4 w-4 text-blue-500" />งานรอท่านดำเนินการ</h3>
            <span className="text-xs text-gray-400">{waiting.length} เรื่อง · เรียงตามรอนานสุด</span>
          </div>
          <div className="divide-y divide-gray-100 flex-1 overflow-y-auto max-h-[30rem] lg:max-h-none lg:h-0 lg:min-h-[24rem]">
            {waiting.length === 0 ? <p className="py-16 text-center text-sm text-gray-400">ไม่มีงานรอท่าน</p>
              : waiting.map((w) => (
                <Link key={w.kind + w.id} href={w.kind === 'ticket' ? `/correspondence/tickets/${w.id}` : `/citizen-reports?open=${w.id}`}
                  className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50 transition-colors">
                  <span className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center shrink-0">
                    {w.kind === 'ticket' ? <Mail className="h-4 w-4 text-blue-500" /> : <Megaphone className="h-4 w-4 text-blue-500" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-gray-900 truncate">{w.subject}</span>
                    <span className="block text-xs text-gray-400">{w.kind === 'ticket' ? 'สารบรรณ' : 'เรื่องร้องเรียน'} · <span className="font-mono">{w.no}</span></span>
                  </span>
                  <span className={`text-sm tabular-nums shrink-0 ${dayTone(w.days)}`}>รอ {dayText(w.days)}</span>
                </Link>
              ))}
          </div>
        </div>

        <div className="flex flex-col gap-6">
          <Pipeline title="ขั้นตอนงานสารบรรณ" icon={Mail} href="/correspondence/tickets?box=doing" grow={!(canReports && cr)} steps={[
            { label: 'อยู่ที่เจ้าหน้าที่ / กอง', count: tk?.byStep.person ?? 0 },
            { label: 'รอปลัด', count: tk?.byStep.clerk ?? 0 },
            { label: 'รอนายก', count: tk?.byStep.mayor ?? 0 },
            { label: 'เสร็จสิ้น (เดือนนี้)', count: tk?.byStep.completedThisMonth ?? 0, done: true },
          ]} />
          {canReports && cr && (
            <Pipeline title="ขั้นตอนเรื่องร้องเรียน" icon={Megaphone} href="/citizen-reports" grow steps={[
              { label: 'เรื่องใหม่ (ยังไม่ส่งกอง)', count: cr.byStep.new },
              { label: 'รอ ผอ.กอง', sub: cr.byStep.deptHead.map((d) => `${d.dept} ${d.count}`).join(' · ') || undefined, count: deptHeadTotal },
              { label: 'รอปลัด', count: cr.byStep.clerk },
              { label: 'รอนายก', count: cr.byStep.mayor },
              { label: 'เสร็จสิ้น (เดือนนี้)', count: cr.byStep.doneThisMonth, done: true },
            ]} />
          )}
        </div>
      </div>

      {/* ── แถว 3: งานอยู่ที่ใคร (เต็มความกว้าง) ── */}
      <HolderTable holders={tk?.holders ?? []} />
    </div>
  );
}
