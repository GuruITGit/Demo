'use client';
import { Suspense, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Inbox, Mail, Megaphone, Search } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Header } from '@/components/layout/header';
import { PageHeader } from '@/components/shared/page-header';
import { Pagination } from '@/components/shared/pagination';
import { Button } from '@/components/ui/button';
import { DayHeader, isNewDay, timeOf } from '@/components/shared/day-group';
import { usePermissionGuard } from '@/hooks/use-permission-guard';
import { useAuthStore } from '@/stores/auth.store';
import { useDisabledModules } from '@/hooks/use-modules';

/**
 * รายการงานจากการ์ดหน้าหลักผู้บริหาร — ยังไม่เสร็จ / ค้างเกิน 7 วัน / เสร็จเดือนนี้
 * รวมสารบรรณ + เรื่องร้องเรียน ใช้เทมเพลตเดียวกับทะเบียนสารบรรณ (แท็บ · ค้นหา · แบ่งตามวัน · แบ่งหน้า)
 * ข้อมูลจาก overview ตัวเดียวกับหน้าหลัก (queryKey เดียวกัน = ใช้แคชร่วม)
 */

type View = 'open' | 'stale' | 'done';
const TABS: { key: View; label: string }[] = [
  { key: 'open', label: 'งานที่ยังไม่เสร็จ' },
  { key: 'stale', label: 'ค้างเกิน 7 วัน' },
  { key: 'done', label: 'เสร็จเดือนนี้' },
];
const GRID = 'lg:grid-cols-[6rem_minmax(0,1fr)_minmax(0,16rem)_7rem]';

type Row = { key: string; kind: 'ticket' | 'report'; no: string; subject: string; sub?: string; where: string; whereSub?: string; days?: number; at: string; href: string };

const dayTone = (d: number) => (d > 14 ? 'text-red-600' : d > 7 ? 'text-orange-600' : 'text-gray-500');

export default function WorkListPage() {
  return (
    <Suspense fallback={null}>
      <WorkList />
    </Suspense>
  );
}

function WorkList() {
  const canAccess = usePermissionGuard('correspondence:summary:Ticket');
  const router = useRouter();
  const sp = useSearchParams();
  const view = (['open', 'stale', 'done'].includes(sp.get('view') || '') ? sp.get('view') : 'open') as View;
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const disabled = useDisabledModules();
  const canReports = hasPermission('complaint:read:Report') && !disabled.includes('citizen-reports');

  const [kind, setKind] = useState<'' | 'ticket' | 'report'>('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const { data: tk, isLoading } = useQuery({
    queryKey: ['exec-overview', 'tickets'],
    queryFn: async () => (await api.get('/correspondence/tickets/overview')).data.data,
    enabled: canAccess,
  });
  const { data: cr } = useQuery({
    queryKey: ['exec-overview', 'reports'],
    queryFn: async () => (await api.get('/citizen-reports/overview')).data.data,
    enabled: canAccess && canReports, retry: false,
  });

  const all: Row[] = useMemo(() => {
    const out: Row[] = [];
    if (view === 'done') {
      for (const t of tk?.done ?? []) out.push({
        key: 't' + t.id, kind: 'ticket', no: t.ticketNumber, subject: t.subject, sub: t.sourceOrg,
        where: t.closedBy ? `ลงนามโดย ${t.closedBy}` : 'เสร็จสิ้น', whereSub: t.ownerDept, at: t.doneAt, href: `/correspondence/tickets/${t.id}`,
      });
      for (const r of cr?.done ?? []) out.push({
        key: 'r' + r.id, kind: 'report', no: r.refNo, subject: r.subject || r.detail, sub: r.subject ? r.detail : undefined,
        where: 'อนุมัติครบแล้ว', whereSub: r.deptName, at: r.doneAt, href: `/citizen-reports?open=${r.id}`,
      });
      return out.sort((a, b) => +new Date(b.at) - +new Date(a.at)); // ใหม่ → เก่า
    }
    for (const h of tk?.holders ?? []) {
      const where = h.kind === 'clerk' ? 'รอปลัด' : h.kind === 'mayor' ? 'รอนายก' : h.kind === 'dept' ? `${h.name} (ยังไม่ระบุผู้รับ)` : h.name;
      const whereSub = h.kind === 'clerk' || h.kind === 'mayor' ? h.name : [h.position, h.dept].filter(Boolean).join(' · ');
      for (const it of h.items) out.push({
        key: 't' + it.id, kind: 'ticket', no: it.ticketNumber, subject: it.subject, sub: it.sourceOrg,
        where, whereSub, days: it.days, at: it.since, href: `/correspondence/tickets/${it.id}`,
      });
    }
    for (const r of cr?.items ?? []) out.push({
      key: 'r' + r.id, kind: 'report', no: r.refNo, subject: r.subject, sub: r.subject !== r.detail ? r.detail : undefined,
      where: r.stage, whereSub: r.deptName && !String(r.stage).includes(r.deptName) ? r.deptName : undefined, days: r.days, at: r.since, href: `/citizen-reports?open=${r.id}`,
    });
    const list = view === 'stale' ? out.filter((x) => (x.days ?? 0) > 7) : out;
    return list.sort((a, b) => +new Date(a.at) - +new Date(b.at)); // ค้างนานสุดขึ้นก่อน
  }, [view, tk, cr]);

  const q = search.trim().toLowerCase();
  const rowsAll = all.filter((r) => (!kind || r.kind === kind)
    && (!q || [r.subject, r.no, r.sub, r.where, r.whereSub].some((v) => v?.toLowerCase().includes(q))));
  const total = rowsAll.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const cur = Math.min(page, totalPages);
  const rows = rowsAll.slice((cur - 1) * pageSize, cur * pageSize);
  const from = total ? (cur - 1) * pageSize + 1 : 0;
  const to = Math.min(cur * pageSize, total);

  const setView = (v: View) => { router.replace(`/dashboard/work?view=${v}`); setPage(1); };

  if (!canAccess) return null;
  const selCls = 'h-9 rounded-md border border-gray-300 bg-white px-2.5 text-sm text-gray-700 focus:border-blue-500 focus:outline-none';
  const isDone = view === 'done';

  return (
    <div className="flex h-full flex-col">
      <Header title="หน้าหลัก" />
      <div className="flex-1 overflow-y-auto p-6">
        <PageHeader title={TABS.find((t) => t.key === view)!.label}
          subtitle={isDone ? 'เรื่องที่ปิดงานแล้วในเดือนนี้ ทั้งสารบรรณและเรื่องร้องเรียน' : 'เรื่องที่ยังไม่ปิดของทั้ง อบต. เรียงจากค้างนานสุด — วันที่ = วันที่เรื่องมาถึงขั้นปัจจุบัน'}
          className="mb-5">
          <Link href="/dashboard"><Button variant="outline" size="sm"><ArrowLeft className="h-4 w-4" />กลับหน้าหลัก</Button></Link>
        </PageHeader>

        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          {/* แท็บ */}
          <div className="flex gap-1 overflow-x-auto border-b border-gray-200 px-3">
            {TABS.map((tb) => (
              <button key={tb.key} onClick={() => setView(tb.key)}
                className={cn('-mb-px whitespace-nowrap border-b-2 px-3 py-3 text-sm font-medium transition-colors',
                  view === tb.key ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-800')}>
                {tb.label}
              </button>
            ))}
          </div>

          {/* ค้นหา + ประเภท */}
          <div className="flex flex-wrap items-center gap-2 border-b border-gray-100 px-4 py-3">
            <div className="relative min-w-[220px] flex-1 sm:max-w-xs">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input className={cn(selCls, 'w-full pl-8')} placeholder="ค้นหา เรื่อง / เลขที่ / ผู้ถือเรื่อง" value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
            </div>
            {canReports && (
              <select className={selCls} value={kind} onChange={(e) => { setKind(e.target.value as typeof kind); setPage(1); }}>
                <option value="">ทุกประเภท</option>
                <option value="ticket">สารบรรณ</option>
                <option value="report">เรื่องร้องเรียน</option>
              </select>
            )}
          </div>

          {/* หัวตาราง (จอใหญ่) */}
          <div className={cn('hidden gap-4 border-b border-gray-100 bg-gray-50 px-4 py-2 text-xs font-medium text-gray-500 lg:grid', GRID)}>
            <span>เวลา</span><span>เรื่อง</span><span>{isDone ? 'ผลการดำเนินการ' : 'อยู่ที่'}</span><span className="text-right">{isDone ? 'ประเภท' : 'ค้างมาแล้ว'}</span>
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
              {rows.map((r, i) => {
                const at = new Date(r.at);
                const Icon = r.kind === 'ticket' ? Mail : Megaphone;
                return (
                  <li key={r.key}>
                    {isNewDay(rows, i, (x) => x.at) && <DayHeader d={at} />}
                    <Link href={r.href}
                      className={cn('grid w-full grid-cols-1 gap-1.5 border-b border-gray-100 px-4 py-3 text-left transition-colors hover:bg-gray-50 lg:items-center lg:gap-4', GRID)}>
                      {/* เวลา */}
                      <span className="flex items-center justify-between gap-2 lg:block">
                        <span className="tabular-nums text-sm font-semibold text-gray-900">{timeOf(at)} น.</span>
                        {!isDone && <span className={cn('text-sm font-semibold tabular-nums lg:hidden', dayTone(r.days ?? 0))}>ค้าง {r.days} วัน</span>}
                      </span>
                      {/* เรื่อง */}
                      <span className="min-w-0">
                        <span className="flex items-center gap-2">
                          <Icon className="h-4 w-4 shrink-0 text-blue-500" />
                          <span className="truncate text-sm font-medium text-gray-900">{r.subject}</span>
                        </span>
                        <span className="mt-0.5 block truncate text-xs text-gray-400">
                          <span className="font-mono">{r.no}</span>{r.sub ? ` · ${r.sub}` : ''}
                        </span>
                      </span>
                      {/* อยู่ที่ / ผล */}
                      <span className="min-w-0">
                        <span className="block truncate text-sm text-gray-800">{r.where}</span>
                        {r.whereSub && <span className="block truncate text-xs text-gray-400">{r.whereSub}</span>}
                      </span>
                      {/* ค้าง / ประเภท */}
                      <span className="hidden text-right lg:block">
                        {isDone
                          ? <span className="text-xs text-gray-500">{r.kind === 'ticket' ? 'สารบรรณ' : 'เรื่องร้องเรียน'}</span>
                          : <span className={cn('text-sm font-semibold tabular-nums', dayTone(r.days ?? 0))}>{r.days === 0 ? 'วันนี้' : `${r.days} วัน`}</span>}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}

          {/* แถบท้าย — จำนวน + เปลี่ยนหน้า */}
          {!isLoading && (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-600">
              <span>{total ? <>แสดง {from}–{to} จาก <b className="font-medium text-gray-900">{total}</b> เรื่อง · {isDone ? 'เรียงจากล่าสุด' : 'เรียงจากค้างนานสุด'}</> : 'ไม่มีรายการ'}</span>
              <div className="flex items-center gap-4">
                <Pagination page={cur} totalPages={totalPages} onChange={setPage} className="flex items-center gap-2" />
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
