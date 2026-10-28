'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, getErrorMessage } from '@/lib/water-api';
import { toast } from '@/hooks/use-toast';
import { MONTH_TH } from '@/lib/baht-text';
import { ReceiptText, Check, X, ExternalLink, ShieldAlert, List, LayoutGrid, ChevronRight, ZoomIn } from 'lucide-react';
import { Pagination } from '@/components/shared/pagination';
import { PageHeader, Tabs, SearchInput, FilterPills, Sheet, type Pill } from '../ui';
import { useCanManage } from '../use-can-manage';

const money = (n: any) => Number(n || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const PAGE_SIZE = 20;

/** ผลตรวจสลิป 4 แบบ — สื่อสารด้วยสีเดียว (เขียว/เทา/แดง) ที่ขีดข้างซ้ายของแถว ไม่ต้องมีป้ายข้อความซ้ำ */
type Verdict = 'verified' | 'failed' | 'unchecked' | 'staffRejected';
type SlipRow = {
  billId: string; slipStatus?: string; slipNote?: string; slipTransRef?: string; slipUrl: string; slipUploadedAt?: string;
  fullName: string; customerCode: string; villageNo: number; totalAmount: number | string; periodMonth: number; periodYear: number; units: number;
};
function slipVerdict(r: SlipRow, tab: 'pending' | 'rejected'): { v: Verdict; label: string; detail?: string } {
  if (tab === 'rejected') return { v: 'staffRejected', label: 'เจ้าหน้าที่ปฏิเสธสลิป', detail: r.slipNote || undefined };
  if (r.slipStatus === 'verified') return { v: 'verified', label: 'ตรวจผ่านกับธนาคาร', detail: r.slipTransRef ? `อ้างอิง ${r.slipTransRef}` : undefined };
  if ((r.slipNote || '').includes('ยังไม่ได้เปิดตรวจสลิปอัตโนมัติ')) return { v: 'unchecked', label: 'ยังไม่ได้ตรวจอัตโนมัติ', detail: 'อบต. ยังไม่เปิดระบบตรวจสลิป — เจ้าหน้าที่ต้องตรวจเอง' };
  return { v: 'failed', label: 'ตรวจไม่ผ่าน', detail: r.slipNote || 'ระบบตรวจกับธนาคารแล้วไม่ผ่าน' };
}
// เขียว=ผ่าน · เทา=ยังไม่ตรวจ · แดง=ไม่ผ่าน/เจ้าหน้าที่ปฏิเสธ (3 สีตามที่ใช้จริง)
const VERDICT_STYLE: Record<Verdict, { stripe: string; chip: string }> = {
  verified: { stripe: 'border-l-emerald-400', chip: 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200' },
  failed: { stripe: 'border-l-rose-400', chip: 'bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-200' },
  unchecked: { stripe: 'border-l-slate-300', chip: 'bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-200' },
  staffRejected: { stripe: 'border-l-rose-400', chip: 'bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-200' },
};
export default function PrapaSlipsPage() {
  const qc = useQueryClient();
  const canManage = useCanManage();
  const [zoom, setZoom] = useState<string | null>(null);
  const [tab, setTab] = useState<'pending' | 'rejected'>('pending');
  const [filter, setFilter] = useState<'all' | Verdict>('all');
  const [view, setView] = useState<'list' | 'grid'>('list');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [openId, setOpenId] = useState<string | null>(null); // มือถือ: สลิปที่เปิดดูรายละเอียด

  const { data, isLoading } = useQuery({
    queryKey: ['prapa-slips', tab],
    queryFn: async () => (await api.get('/water/billing/slips/pending', { params: { status: tab } })).data.data as any,
  });
  const rows: any[] = data?.rows || [];
  // รวมบิลที่เป็นสลิปกลุ่มเดียวกัน (จ่ายรวมหลายบิล+สลิปใบเดียว) ให้เป็นการ์ดเดียว — กันงงว่ากดยืนยันใบเดียวทำไมอัปเดต 2 ใบ
  const groups: any[][] = [];
  const seen = new Set<string>();
  for (const r of rows) {
    if (seen.has(r.billId)) continue;
    const groupIds: string[] = r.slipGroupBillIds?.length > 1 ? r.slipGroupBillIds : [r.billId];
    const g = rows.filter((x) => groupIds.includes(x.billId));
    g.forEach((x) => seen.add(x.billId));
    groups.push(g);
  }
  // ค้นหาก่อน — ด้วยชื่อ/รหัสผู้ใช้น้ำ/หมู่ (ทำก่อนกรองสถานะ ให้ตัวเลขบนป้ายกรองนับเฉพาะที่ค้นเจอ)
  const q = search.trim().toLowerCase();
  const searchedGroups = !q ? groups : groups.filter((g) => {
    const r = g[0];
    return r.fullName?.toLowerCase().includes(q) || r.customerCode?.toLowerCase().includes(q) || String(r.villageNo ?? '') === q;
  });
  // นับตามสถานะไว้ทำตัวกรอง (เฉพาะแท็บ "รอตรวจ" — แท็บ "รอส่งหลักฐานใหม่" เป็นสถานะเดียวอยู่แล้ว)
  const counts = { verified: 0, failed: 0, unchecked: 0 } as Record<'verified' | 'failed' | 'unchecked', number>;
  if (tab === 'pending') for (const g of searchedGroups) counts[slipVerdict(g[0], tab).v as 'verified' | 'failed' | 'unchecked']++;
  const filteredGroups = tab === 'pending' && filter !== 'all' ? searchedGroups.filter((g) => slipVerdict(g[0], tab).v === filter) : searchedGroups;

  // แบ่งหน้า — กันหน้าโหลดหนักตอนรายการเป็นหลักร้อย
  const totalPages = Math.max(1, Math.ceil(filteredGroups.length / PAGE_SIZE));
  const pageSafe = Math.min(page, totalPages);
  const pageGroups = filteredGroups.slice((pageSafe - 1) * PAGE_SIZE, pageSafe * PAGE_SIZE);

  const changeTab = (t: 'pending' | 'rejected') => { setTab(t); setFilter('all'); setSearch(''); setPage(1); };
  const changeFilter = (f: 'all' | Verdict) => { setFilter(f); setPage(1); };
  const changeSearch = (s: string) => { setSearch(s); setPage(1); };

  const confirm = useMutation({
    mutationFn: (id: string) => api.post(`/water/billing/${id}/slip/confirm`),
    onSuccess: () => { toast.success('ยืนยันการชำระแล้ว (ออกใบเสร็จอัตโนมัติ)'); refresh(); },
    onError: (e) => toast.error(getErrorMessage(e, 'ยืนยันไม่สำเร็จ')),
  });
  const reject = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => api.post(`/water/billing/${id}/slip/reject`, { reason }),
    onSuccess: () => { toast.success('ปฏิเสธสลิปแล้ว'); refresh(); },
    onError: (e) => toast.error(getErrorMessage(e, 'ปฏิเสธไม่สำเร็จ')),
  });
  const refresh = () => { qc.invalidateQueries({ queryKey: ['prapa-slips'] }); qc.invalidateQueries({ queryKey: ['prapa-slips-count'] }); qc.invalidateQueries({ queryKey: ['prapa-routes'] }); };
  // ปุ่มยืนยัน/ปฏิเสธอยู่ใกล้กัน กดพลาดแล้วผลเสียหนัก (ต้องให้ลูกบ้านส่งสลิปใหม่) — ปฏิเสธจึงต้องกด "ยืนยันอีกที" ก่อนค่อยถามเหตุผล
  const askReject = (id: string, name: string) => {
    if (!window.confirm(`ยืนยันปฏิเสธสลิปของ "${name}" ใช่ไหม?\nลูกบ้านจะต้องแนบสลิปใหม่อีกครั้ง`)) return;
    const r = window.prompt('เหตุผลที่ปฏิเสธสลิป (แจ้งให้ประชาชนแก้):');
    if (r && r.trim()) reject.mutate({ id, reason: r.trim() });
  };
  const uploadedAt = (d: string) => d ? new Date(d).toLocaleString('th-TH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';

  // ข้อมูลที่ list/grid ใช้ร่วมกัน — คำนวณครั้งเดียวต่อกลุ่ม
  const itemInfo = (g: SlipRow[]) => {
    const r = g[0]; // ตัวแทนกลุ่ม — ข้อมูลลูกค้า/สลิปเหมือนกันทุกใบในกลุ่ม
    const total = g.reduce((s, b) => s + Number(b.totalAmount), 0);
    const { v, label, detail } = slipVerdict(r, tab);
    const st = VERDICT_STYLE[v];
    const textColor = v === 'verified' ? 'text-emerald-600' : v === 'unchecked' ? 'text-slate-500' : 'text-rose-600';
    const bgTint = v === 'verified' ? 'bg-emerald-50' : v === 'unchecked' ? 'bg-slate-50' : 'bg-rose-50';
    const billSummary = g.length > 1
      ? `${MONTH_TH[g[0].periodMonth]}–${MONTH_TH[g[g.length - 1].periodMonth]} ${g[g.length - 1].periodYear}`
      : `${MONTH_TH[r.periodMonth]} ${r.periodYear} · ${r.units} หน่วย`;
    const blocked = tab === 'pending' && data?.autoVerify && r.slipStatus !== 'verified'; // เปิดตรวจอัตโนมัติ + ยังไม่ผ่าน = กดไม่ได้
    return { r, total, v, label, detail, st, textColor, bgTint, billSummary, blocked };
  };

  // ช่องกรองสถานะ — จุดสีบอกสถานะ (เขียว/เทา/แดง ตรงกับขีดข้างแถว)
  const FILTERS: Pill<'all' | Verdict>[] = [
    { key: 'all', label: 'ทั้งหมด', count: searchedGroups.length, dot: 'bg-sky-500' },
    { key: 'verified', label: 'ตรวจผ่าน', count: counts.verified, dot: 'bg-emerald-500' },
    { key: 'unchecked', label: 'ยังไม่ได้ตรวจ', count: counts.unchecked, dot: 'bg-slate-400' },
    { key: 'failed', label: 'ตรวจไม่ผ่าน', count: counts.failed, dot: 'bg-rose-500' },
  ];
  const openGroup = openId ? filteredGroups.find((g) => g[0].billId === openId) : undefined;

  return (
    <div className="space-y-4">
      <PageHeader icon={ReceiptText} title="ตรวจสลิปโอนเงิน" desc="ยืนยันการโอนของประชาชน หรือปฏิเสธให้ส่งใหม่"
        badge={tab === 'pending' && rows.length > 0 && <span className="rounded-full bg-rose-100 px-2 py-0.5 text-sm font-bold text-rose-600">{rows.length}</span>} />

      {/* แท็บสถานะสลิป — แยกกลุ่มออกจากตัวกรอง/มุมมองด้านล่าง */}
      <Tabs items={[{ key: 'pending', label: 'รอตรวจ' }, { key: 'rejected', label: 'รอส่งหลักฐานใหม่' }]} value={tab} onChange={changeTab} />

      {tab === 'pending' && !data?.autoVerify && (
        <div className="flex items-start gap-2 rounded-2xl border border-amber-100 bg-amber-50/60 px-4 py-2.5 text-sm text-amber-700 sm:items-center">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 sm:mt-0" /> <span>ยังไม่เปิดตรวจสลิปอัตโนมัติ — เจ้าหน้าที่ต้องตรวจเอง (เสี่ยงสลิปปลอม) · เปิดได้ที่ <b>ตั้งค่า → พร้อมเพย์</b></span>
        </div>
      )}

      {/* ตัวควบคุมรายการ: ค้นหา + สลับมุมมอง (จอใหญ่) · แถวล่าง = ตัวกรองสถานะ */}
      {groups.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <SearchInput value={search} onChange={changeSearch} placeholder="ค้นหาชื่อ, รหัสผู้ใช้น้ำ หรือหมู่..." className="flex-1" />
            {/* มือถือไม่ต้องสลับมุมมอง — ใช้รายการ + แตะเปิดรายละเอียดแทน */}
            <div className="hidden shrink-0 rounded-xl border border-slate-200 bg-white p-1 sm:inline-flex">
              <button onClick={() => setView('list')} title="มุมมองลิสต์" aria-pressed={view === 'list'}
                className={`flex h-8 w-9 items-center justify-center rounded-lg transition ${view === 'list' ? 'bg-sky-600 text-white' : 'text-slate-400 hover:text-slate-600'}`}><List className="h-4 w-4" /></button>
              <button onClick={() => setView('grid')} title="มุมมองกริด" aria-pressed={view === 'grid'}
                className={`flex h-8 w-9 items-center justify-center rounded-lg transition ${view === 'grid' ? 'bg-sky-600 text-white' : 'text-slate-400 hover:text-slate-600'}`}><LayoutGrid className="h-4 w-4" /></button>
            </div>
          </div>
          {tab === 'pending' && <FilterPills items={FILTERS} value={filter} onChange={changeFilter} />}
        </div>
      )}

      {isLoading ? <p className="py-10 text-center text-sm text-slate-400">กำลังโหลด...</p>
      : filteredGroups.length === 0 ? (
        <p className="py-14 text-center text-sm text-emerald-600">
          {groups.length > 0 ? 'ไม่มีรายการตรงกับตัวกรองนี้' : tab === 'pending' ? 'ไม่มีสลิปรอตรวจ 🎉' : 'ไม่มีรายการรอส่งหลักฐานใหม่'}
        </p>
      ) : (
        <>
          {/* มือถือ: รายการกระชับ แตะแถว → เด้งหน้ารายละเอียด (มีรูปสลิป + ปุ่มยืนยัน/ปฏิเสธ) */}
          <div className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-100 bg-white sm:hidden">
            {pageGroups.map((g) => {
              const { r, total, label, st, textColor } = itemInfo(g);
              return (
                <button key={r.billId} onClick={() => setOpenId(r.billId)}
                  className={`flex w-full items-center gap-3 border-l-4 px-3 py-3 text-left active:bg-slate-50 ${st.stripe}`}>
                  <span className="h-12 w-10 shrink-0 overflow-hidden rounded-lg bg-slate-50">
                    <img src={r.slipUrl} alt="สลิป" className="h-full w-full object-cover" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-slate-900">{r.fullName}</span>
                    <span className="block truncate text-xs text-slate-400">
                      <span className="font-mono">{r.customerCode}</span> · หมู่ {r.villageNo}
                      {g.length > 1 && <span className="font-medium text-violet-600"> · รวม {g.length} บิล</span>}
                    </span>
                    <span className={`block truncate text-xs font-semibold ${textColor}`}>{label}</span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block text-sm font-bold tabular-nums text-sky-600">{money(total)}</span>
                    {r.slipUploadedAt && <span className="block text-[11px] text-slate-400">{uploadedAt(r.slipUploadedAt)}</span>}
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" />
                </button>
              );
            })}
          </div>

          {/* จอใหญ่: ลิสต์/กริด เหมือนเดิม */}
          <div className="hidden sm:block">
            {view === 'list' ? (
              <div className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-100 bg-white">
                {pageGroups.map((g) => {
                  const { r, total, label, detail, st, textColor, billSummary, blocked } = itemInfo(g);
                  return (
                    <div key={r.billId} className={`flex items-center gap-2.5 border-l-4 px-3 py-3.5 ${st.stripe}`}>
                      <button onClick={() => setZoom(r.slipUrl)} className="h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-slate-50" title="ดูรูปสลิป">
                        <img src={r.slipUrl} alt="สลิป" className="h-full w-full object-cover" />
                      </button>

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-slate-900">
                          {r.fullName} <span className="font-normal text-slate-400"><span className="font-mono">{r.customerCode}</span> · หมู่ {r.villageNo}</span>
                        </p>
                        <p className="truncate text-xs">
                          <span className={`font-semibold ${textColor}`}>{label}</span>
                          <span className="text-slate-400">
                            {' '}· {g.length > 1 && <span className="font-medium text-violet-600">รวม {g.length} บิล · </span>}
                            {billSummary}
                            {r.slipUploadedAt && <> · แนบ {uploadedAt(r.slipUploadedAt)}</>}
                            {detail && <span className={textColor}> · {detail}</span>}
                          </span>
                        </p>
                      </div>

                      <p className="shrink-0 text-base font-bold tabular-nums text-sky-600">{money(total)}</p>

                      {tab === 'rejected' ? (
                        <span className="hidden shrink-0 text-xs text-slate-400 md:inline">รอส่งใหม่</span>
                      ) : canManage ? (
                        <div className="flex shrink-0 items-center gap-3">
                          <button onClick={() => confirm.mutate(r.billId)} disabled={confirm.isPending || blocked}
                            title={blocked ? 'สลิปยังไม่ผ่านการตรวจกับธนาคาร — กดยืนยันไม่ได้' : 'ยืนยันชำระ'}
                            className={`flex h-9 w-9 items-center justify-center rounded-lg text-white ${blocked ? 'cursor-not-allowed bg-slate-200' : 'bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60'}`}>
                            <Check className="h-4 w-4" />
                          </button>
                          <span className="h-6 w-px bg-slate-200" aria-hidden="true" />
                          <button onClick={() => askReject(r.billId, r.fullName)} title="ปฏิเสธสลิป"
                            className="flex h-9 w-9 items-center justify-center rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50"><X className="h-4 w-4" /></button>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-3 lg:grid-cols-5">
                {pageGroups.map((g) => {
                  const { r, total, label, detail, st, textColor, bgTint, billSummary, blocked } = itemInfo(g);
                  return (
                    <div key={r.billId} className={`flex flex-col overflow-hidden rounded-xl border border-l-4 border-slate-100 bg-white ${st.stripe}`}>
                      <button onClick={() => setZoom(r.slipUrl)} className="h-28 w-full shrink-0 bg-slate-50" title="ดูรูปสลิป">
                        <img src={r.slipUrl} alt="สลิป" className="h-full w-full object-cover" />
                      </button>
                      <div className="flex flex-1 flex-col gap-1.5 p-3.5">
                        <p className={`text-xs font-semibold ${textColor}`}>{label}</p>
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-slate-900">{r.fullName}</p>
                            <p className="text-xs text-slate-400"><span className="font-mono">{r.customerCode}</span> · หมู่ {r.villageNo}</p>
                          </div>
                          <p className="shrink-0 text-lg font-bold text-sky-600">{money(total)}</p>
                        </div>

                        <p className="text-xs text-slate-500">
                          {g.length > 1 && <span className="mr-1 font-medium text-violet-600">รวม {g.length} บิล ·</span>}
                          {billSummary}
                          {r.slipUploadedAt && <> · แนบ {uploadedAt(r.slipUploadedAt)}</>}
                        </p>
                        {detail && (
                          <p className={`rounded-lg px-2.5 py-1.5 text-xs ${textColor} ${bgTint}`}>{detail}</p>
                        )}

                        {tab === 'rejected' ? (
                          <p className="mt-auto pt-1 text-center text-[11px] text-slate-400">รอประชาชนส่งสลิปใหม่</p>
                        ) : canManage ? (
                          <div className="mt-auto flex items-center gap-3 pt-1">
                            <button onClick={() => confirm.mutate(r.billId)} disabled={confirm.isPending || blocked}
                              title={blocked ? 'สลิปยังไม่ผ่านการตรวจกับธนาคาร — กดยืนยันไม่ได้' : 'ยืนยันชำระ'}
                              className={`flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg py-2 text-sm font-semibold text-white ${blocked ? 'cursor-not-allowed bg-slate-300' : 'bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60'}`}>
                              <Check className="h-4 w-4" /> {blocked ? 'รอตรวจ' : 'ยืนยัน'}
                            </button>
                            <button onClick={() => askReject(r.billId, r.fullName)} title="ปฏิเสธสลิป"
                              className="flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-rose-200 px-3 py-2 text-sm font-medium text-rose-600 hover:bg-rose-50"><X className="h-4 w-4" /> ปฏิเสธ</button>
                          </div>
                        ) : (
                          <p className="mt-auto pt-1 text-center text-xs text-slate-400">โหมดดูอย่างเดียว</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}

      <Pagination page={pageSafe} totalPages={totalPages} onChange={setPage} />

      {/* หน้ารายละเอียดสลิป (มือถือแตะแถวแล้วเด้งขึ้นจากล่าง) — ปิดเองเมื่อรายการหายจากลิสต์หลังยืนยัน/ปฏิเสธ */}
      {openGroup && (() => {
        const g = openGroup;
        const { r, total, label, detail, st, textColor, bgTint, blocked } = itemInfo(g);
        return (
          <Sheet title={r.fullName} subtitle={<><span className="font-mono">{r.customerCode}</span> · หมู่ {r.villageNo}</>} onClose={() => setOpenId(null)}
            footer={tab === 'rejected' ? (
              <p className="py-2 text-center text-sm text-slate-400">รอประชาชนส่งสลิปใหม่</p>
            ) : canManage ? (
              <div className="flex gap-2">
                <button onClick={() => askReject(r.billId, r.fullName)}
                  className="flex h-12 items-center justify-center gap-1.5 rounded-xl border border-rose-200 px-5 text-sm font-medium text-rose-600 active:bg-rose-50"><X className="h-4 w-4" /> ปฏิเสธ</button>
                <button onClick={() => confirm.mutate(r.billId)} disabled={confirm.isPending || blocked}
                  className={`flex h-12 flex-1 items-center justify-center gap-1.5 rounded-xl text-base font-semibold text-white ${blocked ? 'cursor-not-allowed bg-slate-300' : 'bg-emerald-600 active:bg-emerald-700 disabled:opacity-60'}`}>
                  <Check className="h-5 w-5" /> {blocked ? 'รอตรวจสลิปกับธนาคาร' : 'ยืนยันชำระ'}
                </button>
              </div>
            ) : (
              <p className="py-2 text-center text-sm text-slate-400">โหมดดูอย่างเดียว</p>
            )}>
            <div className="space-y-4">
              <div className="space-y-2">
                <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${st.chip}`}>{label}</span>
                {detail && <p className={`rounded-lg px-3 py-2 text-sm ${textColor} ${bgTint}`}>{detail}</p>}
              </div>

              <button onClick={() => setZoom(r.slipUrl)} className="relative block w-full overflow-hidden rounded-xl border border-slate-100 bg-slate-50" title="ดูรูปสลิปเต็มจอ">
                <img src={r.slipUrl} alt="สลิป" className="mx-auto max-h-[42vh] w-auto object-contain" />
                <span className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-full bg-slate-900/60 px-2.5 py-1 text-xs text-white"><ZoomIn className="h-3.5 w-3.5" /> ดูเต็มจอ</span>
              </button>

              <div className="overflow-hidden rounded-xl border border-slate-100">
                {g.map((b) => (
                  <div key={b.billId} className="flex items-center justify-between border-b border-slate-100 px-3 py-2.5 text-sm">
                    <span className="text-slate-600">{MONTH_TH[b.periodMonth]} {b.periodYear} <span className="text-slate-400">· {b.units} หน่วย</span></span>
                    <span className="tabular-nums text-slate-700">{money(b.totalAmount)}</span>
                  </div>
                ))}
                <div className="flex items-center justify-between bg-slate-50 px-3 py-2.5">
                  <span className="text-sm font-medium text-slate-600">ยอดรวม{g.length > 1 && ` (${g.length} บิล)`}</span>
                  <span className="text-lg font-bold tabular-nums text-sky-600">{money(total)}</span>
                </div>
              </div>
              {r.slipUploadedAt && <p className="text-xs text-slate-400">แนบสลิปเมื่อ {uploadedAt(r.slipUploadedAt)}</p>}
            </div>
          </Sheet>
        );
      })()}

      {zoom && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={() => setZoom(null)}>
          <img src={zoom} alt="สลิป" className="max-h-[90vh] max-w-full rounded-lg object-contain" />
          <a href={zoom} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}
            className="absolute right-4 top-4 flex items-center gap-1 rounded-full bg-white/90 px-3 py-2 text-sm text-slate-700"><ExternalLink className="h-4 w-4" /> เปิดเต็ม</a>
          <button onClick={() => setZoom(null)} aria-label="ปิด"
            className="absolute left-4 top-4 flex items-center gap-1 rounded-full bg-white/90 px-3 py-2 text-sm text-slate-700"><X className="h-4 w-4" /> ปิด</button>
        </div>
      )}
    </div>
  );
}
