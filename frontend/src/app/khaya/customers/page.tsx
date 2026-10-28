'use client';
import { useMemo, useState } from 'react';
import { households, KTYPES, ROUTES, arrearsOf, unpaidBills, fmtMoney } from '../mock';
import { PageHead, TypeBadge, DemoNote } from '../ui';
import { Search, UserPlus, Phone, PhoneOff } from 'lucide-react';

export default function CustomersPage() {
  const [q, setQ] = useState('');
  const [moo, setMoo] = useState<number | ''>('');
  const [type, setType] = useState('');
  const [status, setStatus] = useState<'all' | 'active' | 'inactive'>('all');

  const rows = useMemo(() => {
    const s = q.trim();
    return households
      .filter((h) => (moo === '' || h.moo === moo))
      .filter((h) => (!type || h.type === type))
      .filter((h) => (status === 'all' || (status === 'active' ? h.active : !h.active)))
      .filter((h) => (!s || h.name.includes(s) || h.code.includes(s)))
      .map((h) => ({ ...h, arrears: arrearsOf(h.id), unpaid: unpaidBills(h.id).length }));
  }, [q, moo, type, status]);

  const withPhone = households.filter((h) => h.phone).length;

  return (
    <div>
      <PageHead
        title="ทะเบียนผู้ใช้บริการเก็บขยะ"
        subtitle={`ทั้งหมด ${households.length} ราย · มีเบอร์โทร ${withPhone} ราย (${Math.round((withPhone / households.length) * 100)}%)`}
        right={
          <button className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700">
            <UserPlus className="h-4 w-4" /> เพิ่มผู้ใช้บริการ
          </button>
        }
      />
      <DemoNote />

      {/* ฟิลเตอร์ */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ค้นหา ชื่อ / รหัส..."
            className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100" />
        </div>
        <select value={moo} onChange={(e) => setMoo(e.target.value ? Number(e.target.value) : '')}
          className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-emerald-400">
          <option value="">ทุกหมู่</option>
          {ROUTES.map((r) => <option key={r.moo} value={r.moo}>หมู่ {r.moo} — {r.name}</option>)}
        </select>
        <select value={type} onChange={(e) => setType(e.target.value)}
          className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-emerald-400">
          <option value="">ทุกประเภท</option>
          {KTYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value as any)}
          className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-emerald-400">
          <option value="all">ทุกสถานะ</option>
          <option value="active">ใช้บริการอยู่</option>
          <option value="inactive">ยกเลิก</option>
        </select>
      </div>

      {/* ตาราง */}
      <div className="overflow-x-auto rounded-2xl border border-slate-100 bg-white shadow-sm">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50 text-left text-xs font-semibold text-slate-500">
              <th className="px-3 py-2.5">รหัส</th>
              <th className="px-3 py-2.5">ชื่อ-สกุล</th>
              <th className="px-3 py-2.5">ประเภท</th>
              <th className="px-3 py-2.5">หมู่</th>
              <th className="px-3 py-2.5">เบอร์โทร</th>
              <th className="px-3 py-2.5 text-right">ค่าธรรมเนียม/เดือน</th>
              <th className="px-3 py-2.5 text-right">ค้างสะสม</th>
              <th className="px-3 py-2.5 text-center">สถานะ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {rows.map((h) => (
              <tr key={h.id} className="transition hover:bg-emerald-50/40">
                <td className="px-3 py-2.5 font-mono text-xs text-slate-500">{h.code}</td>
                <td className="px-3 py-2.5 font-medium text-slate-800">{h.name}</td>
                <td className="px-3 py-2.5"><TypeBadge type={h.type} /></td>
                <td className="px-3 py-2.5 text-slate-600">หมู่ {h.moo}</td>
                <td className="px-3 py-2.5">
                  {h.phone
                    ? <span className="inline-flex items-center gap-1 text-slate-600"><Phone className="h-3.5 w-3.5 text-emerald-500" />{h.phone}</span>
                    : <span className="inline-flex items-center gap-1 text-slate-300"><PhoneOff className="h-3.5 w-3.5" />—</span>}
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums text-slate-600">{fmtMoney(h.rate)}</td>
                <td className={`px-3 py-2.5 text-right tabular-nums font-semibold ${h.arrears > 0 ? 'text-rose-600' : 'text-slate-300'}`}>
                  {h.arrears > 0 ? `${fmtMoney(h.arrears)} (${h.unpaid} งวด)` : '—'}
                </td>
                <td className="px-3 py-2.5 text-center">
                  {h.active
                    ? <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 ring-1 ring-emerald-200">ใช้บริการ</span>
                    : <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-400">ยกเลิก</span>}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={8} className="px-3 py-12 text-center text-sm text-slate-400">ไม่พบผู้ใช้บริการที่ค้นหา</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-slate-400">แสดง {rows.length} จาก {households.length} ราย</p>
    </div>
  );
}
