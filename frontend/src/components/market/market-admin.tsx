'use client';
import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, getErrorMessage } from '@/lib/api';
import { toast } from '@/hooks/use-toast';
import { useAuthStore } from '@/stores/auth.store';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { money } from '@/lib/payment-labels';
import { Empty, Field, Metric, Panel, PayTabs, inputCls, useOrgName } from '@/components/pay/pay-ui';
import { QrSvg, downloadQrPng, printQrSheet, stallQrUrl, type QrItem } from '@/components/pay/qr';
import { SlipQueue } from '@/components/pay/slip-queue';
import { PaySettings } from '@/components/pay/pay-settings';
import { MarketBills } from './market-bills';
import { MarketOutside } from './market-outside';
import { ReservationCheck } from './reservation-check';

type Stall = {
  id: string; stallCode: string; zone: string; status: 'available' | 'reserved' | 'occupied';
  tenantName: string | null; contactPhone: string | null; reservedAt: string | null; monthlyRate: string; reserveCardUrl?: string | null;
};
type Summary = {
  byStatus: { status: string; count: number; total: number }[];
  arrears: { stallCode: string; payerName: string; months: number; total: number }[];
  stallCounts: { status: string; count: number }[];
};
type Tab = 'overview' | 'queue' | 'plan' | 'bills' | 'dues' | 'outside' | 'qr' | 'settings';

const STALL_LABEL = { available: 'ว่าง', reserved: 'จอง', occupied: 'มีผู้เช่า' } as const;
// สีตามผังเดิม: มีผู้เช่า = ฟ้าอ่อน · จอง = เหลืองอ่อน · ว่าง = ขาว
const STALL_TONE = {
  available: 'border-gray-200 bg-white text-gray-600',
  reserved: 'border-amber-300 bg-amber-50 text-amber-800',
  occupied: 'border-sky-300 bg-sky-100 text-sky-800',
} as const;

/** ค่าแผงตลาด (เจ้าหน้าที่) — ภาพรวม · คิวรอตรวจ · ผังแผง · บิล · ค้างชำระ · แผงลอย · QR ประจำแผง · ตั้งค่า */
export function MarketAdmin() {
  const has = useAuthStore((s) => s.hasPermission);
  const canStall = has('market:manage:MarketStall');
  const canBill = has('market:manage:MarketBill');
  const orgName = useOrgName();
  const [tab, setTab] = useState<Tab>('overview');
  const [billFilter, setBillFilter] = useState<{ stall?: string; status?: string; n: number }>({ n: 0 });

  const { data: sum } = useQuery<Summary>({ queryKey: ['market', 'summary'], queryFn: async () => (await api.get('/market/summary')).data.data, refetchInterval: 60_000 });
  const pendingCount = sum?.byStatus.find((s) => s.status === 'pending')?.count ?? 0;

  const goBills = (stall?: string, status?: string) => { setBillFilter({ stall, status, n: billFilter.n + 1 }); setTab('bills'); };

  return (
    <div className="space-y-5">
      <PayTabs<Tab>
        value={tab}
        onChange={setTab}
        tabs={[
          { key: 'overview', label: 'ภาพรวม' },
          { key: 'queue', label: 'รอตรวจ', badge: pendingCount },
          { key: 'plan', label: 'ผังแผง' },
          { key: 'bills', label: 'บิล' },
          { key: 'dues', label: 'ค้างชำระ' },
          { key: 'outside', label: 'แผงลอย' },
          { key: 'qr', label: 'QR ประจำแผง' },
          { key: 'settings', label: 'ตั้งค่า' },
        ]}
      />
      {tab === 'overview' && <Overview sum={sum} onGo={setTab} />}
      {tab === 'queue' && <SlipQueue kind="market" canManage={canBill} />}
      {tab === 'plan' && <Plan canManage={canStall} onBills={(code) => goBills(code)} />}
      {tab === 'bills' && <MarketBills key={billFilter.n} canManage={canBill} orgName={orgName} initialStall={billFilter.stall} initialStatus={billFilter.status} />}
      {tab === 'dues' && <Dues sum={sum} onBills={(code) => goBills(code, 'unpaid')} />}
      {tab === 'outside' && <MarketOutside canManageStall={canStall} canManageBill={canBill} orgName={orgName} />}
      {tab === 'qr' && <StallQr orgName={orgName} />}
      {tab === 'settings' && <PaySettings kind="market" canManage={canStall} />}
    </div>
  );
}

// ───────────────────────────── ภาพรวม
function Overview({ sum, onGo }: { sum?: Summary; onGo: (t: Tab) => void }) {
  const by = (s: string) => sum?.byStatus.find((x) => x.status === s);
  const open = (sum?.byStatus ?? []).filter((x) => x.status !== 'paid');
  const openTotal = open.reduce((a, x) => a + x.total, 0);
  const stalls = (s: string) => sum?.stallCounts.find((x) => x.status === s)?.count ?? 0;
  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="ยอดค้างทั้งหมด" value={`${money(openTotal)} บาท`} sub={`${sum?.arrears.length ?? 0} แผง`} tone={openTotal ? 'bad' : 'ok'} />
        <Metric label="รอตรวจ/รับเงินสด" value={`${by('pending')?.count ?? 0} รายการ`} sub={`${money(by('pending')?.total ?? 0)} บาท`} tone="warn" />
        <Metric label="ชำระแล้ว (ทุกงวด)" value={`${money(by('paid')?.total ?? 0)} บาท`} sub={`${by('paid')?.count ?? 0} บิล`} tone="ok" />
        <Metric label="ผังแผง" value={`${stalls('available') + stalls('reserved') + stalls('occupied')} ล็อก`} sub={`เช่า ${stalls('occupied')} · จอง ${stalls('reserved')} · ว่าง ${stalls('available')}`} />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => onGo('queue')}>ไปตรวจรายการรอดำเนินการ ›</Button>
        <Button variant="outline" onClick={() => onGo('bills')}>ออกบิลประจำงวด ›</Button>
        <Button variant="outline" onClick={() => onGo('dues')}>ดูผู้ค้างชำระ ›</Button>
      </div>
    </div>
  );
}

// ───────────────────────────── ผังแผง
function Plan({ canManage, onBills }: { canManage: boolean; onBills: (code: string) => void }) {
  const qc = useQueryClient();
  const { data: stalls = [], isLoading } = useQuery<Stall[]>({ queryKey: ['market', 'stalls'], queryFn: async () => (await api.get('/market/stalls')).data.data });
  const [editing, setEditing] = useState<Stall | null>(null);
  const [mode, setMode] = useState<'none' | 'one' | 'bulk' | 'zone'>('none');
  const [delTarget, setDelTarget] = useState<Stall | null>(null);
  const [one, setOne] = useState({ stallCode: '', zone: '', monthlyRate: '' });
  const [bulk, setBulk] = useState({ zone: '', from: '1', to: '10', monthlyRate: '' });
  const [zoneRate, setZoneRate] = useState({ zone: '', monthlyRate: '' });
  const refresh = () => qc.invalidateQueries({ queryKey: ['market'] });

  const byZone = useMemo(() => {
    const m = new Map<string, Stall[]>();
    for (const s of stalls) m.set(s.zone, [...(m.get(s.zone) ?? []), s]);
    return [...m.entries()];
  }, [stalls]);
  const counts = useMemo(() => {
    const c = { available: 0, reserved: 0, occupied: 0 };
    for (const s of stalls) c[s.status] += 1;
    return c;
  }, [stalls]);
  const reservedList = stalls.filter((s) => s.status === 'reserved');

  const save = useMutation({
    mutationFn: ({ id, body }: { id: string; body: object }) => api.patch(`/market/stalls/${id}`, body),
    onSuccess: () => { toast.success('บันทึกแผงแล้ว'); setEditing(null); refresh(); },
    onError: (e) => toast.error(getErrorMessage(e)),
  });
  const createOne = useMutation({
    mutationFn: () => api.post('/market/stalls', { stallCode: one.stallCode.trim(), ...(one.zone.trim() ? { zone: one.zone.trim() } : {}), monthlyRate: Number(one.monthlyRate) || 0 }),
    onSuccess: () => { toast.success('เพิ่มแผงแล้ว'); setOne({ stallCode: '', zone: '', monthlyRate: one.monthlyRate }); refresh(); },
    onError: (e) => toast.error(getErrorMessage(e)),
  });
  const createBulk = useMutation({
    mutationFn: () => api.post('/market/stalls/bulk', { zone: bulk.zone.trim(), from: Number(bulk.from), to: Number(bulk.to), monthlyRate: Number(bulk.monthlyRate) || 0 }),
    onSuccess: (r) => {
      const d = r.data.data as { created: number; reopened: number; skipped: number };
      toast.success(`เพิ่ม ${d.created + d.reopened} ล็อก${d.skipped ? ` (ข้ามที่มีอยู่แล้ว ${d.skipped})` : ''}`);
      refresh();
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });
  const setZone = useMutation({
    mutationFn: () => api.post('/market/zones/rate', { zone: zoneRate.zone, monthlyRate: Number(zoneRate.monthlyRate) || 0 }),
    onSuccess: (r) => { toast.success(`ตั้งค่าเช่าโซน ${zoneRate.zone} แล้ว ${(r.data.data as { updated: number }).updated} ล็อก (มีผลกับบิลที่ออกต่อจากนี้)`); refresh(); },
    onError: (e) => toast.error(getErrorMessage(e)),
  });
  const del = useMutation({
    mutationFn: (id: string) => api.delete(`/market/stalls/${id}`),
    onSuccess: () => { toast.success('ลบแผงแล้ว'); setDelTarget(null); setEditing(null); refresh(); },
    onError: (e) => { toast.error(getErrorMessage(e)); setDelTarget(null); },
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        {canManage && (
          <>
            <Button size="sm" variant={mode === 'one' ? 'default' : 'outline'} onClick={() => setMode(mode === 'one' ? 'none' : 'one')}>+ เพิ่มแผง</Button>
            <Button size="sm" variant={mode === 'bulk' ? 'default' : 'outline'} onClick={() => setMode(mode === 'bulk' ? 'none' : 'bulk')}>+ เพิ่มเป็นช่วง</Button>
            <Button size="sm" variant={mode === 'zone' ? 'default' : 'outline'} onClick={() => setMode(mode === 'zone' ? 'none' : 'zone')}>ตั้งค่าเช่าทั้งโซน</Button>
          </>
        )}
        <span className="ml-auto text-sm text-gray-500">ว่าง {counts.available} · จอง {counts.reserved} · มีผู้เช่า {counts.occupied}</span>
      </div>

      {canManage && mode === 'one' && (
        <Panel title="เพิ่มแผงทีละล็อก">
          <div className="grid gap-3 p-4 sm:grid-cols-4">
            <Field label="รหัสแผง" hint="เช่น F01"><input className={inputCls} value={one.stallCode} onChange={(e) => setOne({ ...one, stallCode: e.target.value })} /></Field>
            <Field label="โซน" hint="ว่าง = ตัดจากรหัส"><input className={inputCls} value={one.zone} onChange={(e) => setOne({ ...one, zone: e.target.value })} /></Field>
            <Field label="ค่าเช่าต่อเดือน (บาท)"><input type="number" min={0} className={inputCls} value={one.monthlyRate} onChange={(e) => setOne({ ...one, monthlyRate: e.target.value })} /></Field>
            <div className="flex items-end"><Button loading={createOne.isPending} disabled={!one.stallCode.trim()} onClick={() => createOne.mutate()}>เพิ่มแผง</Button></div>
          </div>
        </Panel>
      )}
      {canManage && mode === 'bulk' && (
        <Panel title="เพิ่มแผงเป็นช่วง">
          <div className="grid gap-3 p-4 sm:grid-cols-5">
            <Field label="โซน"><input className={inputCls} value={bulk.zone} onChange={(e) => setBulk({ ...bulk, zone: e.target.value })} placeholder="เช่น F" /></Field>
            <Field label="ล็อกที่"><input type="number" min={1} className={inputCls} value={bulk.from} onChange={(e) => setBulk({ ...bulk, from: e.target.value })} /></Field>
            <Field label="ถึงล็อกที่"><input type="number" min={1} className={inputCls} value={bulk.to} onChange={(e) => setBulk({ ...bulk, to: e.target.value })} /></Field>
            <Field label="ค่าเช่าต่อเดือน (บาท)"><input type="number" min={0} className={inputCls} value={bulk.monthlyRate} onChange={(e) => setBulk({ ...bulk, monthlyRate: e.target.value })} /></Field>
            <div className="flex items-end"><Button loading={createBulk.isPending} disabled={!bulk.zone.trim()} onClick={() => createBulk.mutate()}>เพิ่ม</Button></div>
            <p className="text-xs text-gray-500 sm:col-span-5">สร้างรหัสเป็น {bulk.zone.trim().toUpperCase() || 'F'}01, {bulk.zone.trim().toUpperCase() || 'F'}02, … ข้ามรหัสที่มีอยู่แล้ว (ครั้งละไม่เกิน 200 ล็อก)</p>
          </div>
        </Panel>
      )}
      {canManage && mode === 'zone' && (
        <Panel title="ตั้งค่าเช่าทั้งโซน">
          <div className="grid gap-3 p-4 sm:grid-cols-4">
            <Field label="โซน">
              <select className={inputCls} value={zoneRate.zone} onChange={(e) => setZoneRate({ ...zoneRate, zone: e.target.value })}>
                <option value="">— เลือกโซน —</option>
                {byZone.map(([z]) => <option key={z} value={z}>{z}</option>)}
              </select>
            </Field>
            <Field label="ค่าเช่าต่อเดือน (บาท)"><input type="number" min={0} className={inputCls} value={zoneRate.monthlyRate} onChange={(e) => setZoneRate({ ...zoneRate, monthlyRate: e.target.value })} /></Field>
            <div className="flex items-end"><Button loading={setZone.isPending} disabled={!zoneRate.zone || zoneRate.monthlyRate === ''} onClick={() => setZone.mutate()}>ตั้งค่าเช่า</Button></div>
            <p className="text-xs text-gray-500 sm:col-span-4">มีผลกับบิลที่ออกต่อจากนี้ ไม่แก้บิลที่ออกไปแล้ว</p>
          </div>
        </Panel>
      )}

      <ReservationCheck canManage={canManage} />

      {reservedList.length > 0 && (
        <Panel title={<>แผงที่ประชาชนจองมา <span className="text-sm font-normal text-gray-500">({reservedList.length})</span></>}>
          <ul>
            {reservedList.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center gap-3 border-t border-gray-100 px-4 py-3 first:border-t-0">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">แผง {s.stallCode} <span className="font-normal text-gray-500">· {s.tenantName}</span></p>
                  <p className="text-sm text-gray-500">โทร {s.contactPhone || '—'}{s.reserveCardUrl ? <> · <a href={s.reserveCardUrl} target="_blank" rel="noreferrer" className="text-sky-700 underline">ดูรูปบัตรประชาชน</a></> : ' · ไม่ได้แนบบัตร'}{s.reservedAt ? ` · จองเมื่อ ${new Date(s.reservedAt).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })}` : ''}</p>
                </div>
                {canManage && (
                  <div className="flex gap-2">
                    <Button size="sm" variant="success" onClick={() => save.mutate({ id: s.id, body: { status: 'occupied' } })}>ยืนยันเป็นผู้เช่า</Button>
                    <Button size="sm" variant="outline" onClick={() => save.mutate({ id: s.id, body: { status: 'available' } })}>ปฏิเสธการจอง</Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </Panel>
      )}

      {editing && (
        <StallEditor
          key={editing.id}
          stall={editing}
          canManage={canManage}
          saving={save.isPending}
          onClose={() => setEditing(null)}
          onBills={() => onBills(editing.stallCode)}
          onDelete={() => setDelTarget(editing)}
          onSave={(body) => save.mutate({ id: editing.id, body })}
        />
      )}

      {isLoading ? <Empty>กำลังโหลด…</Empty> : byZone.length === 0 ? <Empty>ยังไม่มีแผงในผัง{canManage ? ' — กด “เพิ่มแผง” หรือ “เพิ่มเป็นช่วง”' : ''}</Empty> : byZone.map(([zone, list]) => (
        <section key={zone} className="rounded-xl border border-gray-200 bg-white p-4">
          <h2 className="mb-3 font-semibold text-gray-800">แถว {zone} <span className="text-sm font-normal text-gray-400">· {list.length} ล็อก</span></h2>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5 lg:grid-cols-10">
            {list.map((s) => (
              <button type="button" key={s.id} title={s.tenantName ?? ''} onClick={() => setEditing(s)}
                className={`rounded-lg border p-2 text-center text-xs hover:ring-2 hover:ring-blue-300 ${STALL_TONE[s.status]} ${editing?.id === s.id ? 'ring-2 ring-blue-500' : ''}`}>
                <div className="font-bold">{s.stallCode}</div>
                <div>{STALL_LABEL[s.status]}</div>
                <div className="truncate text-[11px] opacity-80">{s.tenantName ?? '—'}</div>
              </button>
            ))}
          </div>
        </section>
      ))}

      <ConfirmDialog open={!!delTarget} onOpenChange={(o) => { if (!o) setDelTarget(null); }} loading={del.isPending}
        onConfirm={() => delTarget && del.mutate(delTarget.id)} title={`ลบแผง ${delTarget?.stallCode}?`}
        description="แผงจะถูกเอาออกจากผัง (ต้องไม่มีบิลค้าง) ประวัติการชำระที่ผ่านมายังอยู่" confirmText="ลบแผง" />
    </div>
  );
}

/** แก้ไขแผง: สถานะ ชื่อผู้จอง/ผู้เช่า ค่าเช่า — ตั้งว่างแล้วชื่อจะถูกล้าง */
function StallEditor({ stall, canManage, saving, onClose, onBills, onDelete, onSave }: {
  stall: Stall; canManage: boolean; saving: boolean; onClose: () => void; onBills: () => void; onDelete: () => void;
  onSave: (body: { status: Stall['status']; tenantName: string | null; monthlyRate: number }) => void;
}) {
  const [status, setStatus] = useState<Stall['status']>(stall.status);
  const [tenant, setTenant] = useState(stall.tenantName ?? '');
  const [rate, setRate] = useState(String(Number(stall.monthlyRate)));
  const needName = status !== 'available' && !tenant.trim();
  return (
    <section className="rounded-xl border border-blue-300 bg-white p-4">
      <h2 className="mb-3 font-semibold text-gray-800">แผง {stall.stallCode} <span className="text-sm font-normal text-gray-500">· โซน {stall.zone}</span></h2>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="สถานะ">
          <select value={status} disabled={!canManage} onChange={(e) => setStatus(e.target.value as Stall['status'])} className={inputCls}>
            {Object.entries(STALL_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </Field>
        <Field label="ชื่อผู้จอง / ผู้เช่า" hint="ต้องตรงกับที่ประชาชนจะกรอกตอนจ่ายค่าแผง (ไม่สนคำนำหน้า)">
          <input value={tenant} onChange={(e) => setTenant(e.target.value)} disabled={status === 'available' || !canManage} className={inputCls} />
        </Field>
        <Field label="ค่าเช่าต่อเดือน (บาท)">
          <input type="number" min={0} value={rate} disabled={!canManage} onChange={(e) => setRate(e.target.value)} className={inputCls} />
        </Field>
      </div>
      {stall.contactPhone && <p className="mt-2 text-sm text-gray-500">เบอร์ติดต่อผู้จอง: {stall.contactPhone}</p>}
      <div className="mt-4 flex flex-wrap justify-between gap-2">
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onBills}>ดูบิลของแผงนี้</Button>
          {canManage && <Button variant="ghost" size="sm" className="text-red-600" onClick={onDelete}>ลบแผง</Button>}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onClose}>ปิด</Button>
          {canManage && (
            <Button loading={saving} disabled={needName}
              onClick={() => onSave({ status, tenantName: status === 'available' ? null : tenant.trim() || null, monthlyRate: Number(rate) || 0 })}>บันทึก</Button>
          )}
        </div>
      </div>
      {needName && <p className="mt-2 text-xs text-amber-700">กรอกชื่อผู้จอง/ผู้เช่าก่อนบันทึก</p>}
    </section>
  );
}

// ───────────────────────────── ค้างชำระ
function Dues({ sum, onBills }: { sum?: Summary; onBills: (code: string) => void }) {
  const rows = sum?.arrears ?? [];
  const total = rows.reduce((s, r) => s + r.total, 0);
  return (
    <Panel
      title={<>ผู้ค้างชำระ <span className="text-sm font-normal text-gray-500">{rows.length} แผง · รวม {money(total)} บาท</span></>}
      actions={<Button size="sm" variant="outline" onClick={() => window.print()}>พิมพ์รายงาน</Button>}
    >
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-gray-600">
            <tr><th className="px-4 py-2">แผง</th><th className="px-4 py-2">ผู้เช่า</th><th className="px-4 py-2 text-right">บิลค้าง</th><th className="px-4 py-2 text-right">ยอดค้าง (บาท)</th><th className="px-4 py-2 no-print" /></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.stallCode} className="border-t border-gray-100">
                <td className="px-4 py-2 font-medium">{r.stallCode}</td>
                <td className="px-4 py-2">{r.payerName}</td>
                <td className="px-4 py-2 text-right">{r.months} รายการ</td>
                <td className="px-4 py-2 text-right font-semibold">{money(r.total)}</td>
                <td className="px-4 py-2 no-print"><Button size="sm" variant="outline" onClick={() => onBills(r.stallCode)}>ดูบิล / รับชำระ</Button></td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={5}><Empty>ไม่มียอดค้างชำระ</Empty></td></tr>}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

// ───────────────────────────── QR ประจำแผง
function StallQr({ orgName }: { orgName: string }) {
  const { data: stalls = [] } = useQuery<Stall[]>({ queryKey: ['market', 'stalls'], queryFn: async () => (await api.get('/market/stalls')).data.data });
  const [zone, setZone] = useState('');
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const zones = [...new Set(stalls.map((s) => s.zone))];
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  // บนสติกเกอร์ไม่ใส่ชื่อผู้เช่า (ติดหน้าแผงต่อสาธารณะ) — ใส่แค่โซน
  const items: QrItem[] = stalls.filter((s) => !zone || s.zone === zone).map((s) => ({ code: s.stallCode, title: `แผง ${s.stallCode}`, sub: `โซน ${s.zone}`, text: stallQrUrl(origin, s.stallCode) }));
  const target = picked.size ? items.filter((i) => picked.has(i.code)) : items;
  const toggle = (code: string) => setPicked((p) => { const n = new Set(p); if (n.has(code)) n.delete(code); else n.add(code); return n; });

  return (
    <Panel
      title="QR ประจำแผง"
      actions={
        <>
          <select className={`${inputCls} w-auto`} value={zone} onChange={(e) => { setZone(e.target.value); setPicked(new Set()); }}>
            <option value="">ทุกโซน</option>
            {zones.map((z) => <option key={z} value={z}>โซน {z}</option>)}
          </select>
          <Button size="sm" onClick={() => { if (!printQrSheet(target, 'ค่าแผงตลาด', orgName)) toast.error('เปิดหน้าพิมพ์ไม่ได้ — อนุญาตป็อปอัปของเว็บนี้แล้วลองใหม่'); }}>
            พิมพ์ {picked.size ? `ที่เลือก ${picked.size}` : `ทั้งหมด ${items.length}`} ดวง
          </Button>
          {picked.size > 0 && <Button size="sm" variant="ghost" onClick={() => setPicked(new Set())}>ล้างที่เลือก</Button>}
        </>
      }
    >
      <p className="border-b border-gray-100 px-4 py-3 text-sm text-gray-500">
        ติดหน้าแผง — ประชาชนสแกนแล้วกรอกชื่อผู้เช่าเพื่อดูยอดและชำระ · QR มีแค่รหัสแผง ไม่มีชื่อหรือยอดเงิน · เลือกบางแผงเพื่อพิมพ์เฉพาะที่ต้องการได้
      </p>
      {items.length === 0 ? <Empty>ไม่มีแผง</Empty> : (
        <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-4 lg:grid-cols-6">
          {items.map((i) => (
            <article key={i.code} className={`rounded-xl border p-3 text-center ${picked.has(i.code) ? 'border-blue-500 ring-2 ring-blue-200' : 'border-gray-200'}`}>
              <button type="button" onClick={() => toggle(i.code)} className="block w-full" aria-pressed={picked.has(i.code)} aria-label={`เลือก QR ${i.title}`}>
                <QrSvg text={i.text} label={i.title} className="mx-auto w-full max-w-[140px]" />
              </button>
              <b className="mt-1 block">{i.title}</b>
              <small className="block text-gray-500">{i.sub}</small>
              <Button size="sm" variant="outline" className="mt-2 w-full" onClick={() => downloadQrPng(i, 'qr-market').catch((e) => toast.error(getErrorMessage(e)))}>บันทึกรูป</Button>
            </article>
          ))}
        </div>
      )}
    </Panel>
  );
}
