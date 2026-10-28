'use client';
import { useMemo, useState } from 'react';
import { debtors, unpaidBills, thMonth, fmtMoney, mooName } from '../mock';
import { PageHead, TypeBadge, DemoNote } from '../ui';
import { FileWarning, Printer, X } from 'lucide-react';

export default function NoticesPage() {
  const [minMonths, setMinMonths] = useState(2);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [preview, setPreview] = useState(false);

  const list = useMemo(() => debtors().filter((d) => d.months >= minMonths), [minMonths]);
  const allChecked = list.length > 0 && list.every((d) => sel.has(d.h.id));

  const toggle = (id: string) => {
    const n = new Set(sel); n.has(id) ? n.delete(id) : n.add(id); setSel(n);
  };
  const toggleAll = () => setSel(allChecked ? new Set() : new Set(list.map((d) => d.h.id)));

  const chosen = list.filter((d) => sel.has(d.h.id));
  const sample = chosen[0] || list[0];

  return (
    <div>
      <PageHead
        title="หนังสือแจ้งค้างชำระ"
        subtitle="คัดกรองลูกหนี้ค้างนาน → ออกหนังสือแจ้งเตือน/ทวงถามยกชุด"
        right={
          <button disabled={chosen.length === 0} onClick={() => setPreview(true)}
            className="inline-flex items-center gap-1.5 rounded-full bg-rose-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-700 disabled:opacity-40">
            <Printer className="h-4 w-4" /> พิมพ์หนังสือ ({chosen.length})
          </button>
        }
      />
      <DemoNote />

      <div className="mb-3 flex items-center gap-2 text-sm">
        <span className="text-slate-500">ค้างตั้งแต่</span>
        <select value={minMonths} onChange={(e) => { setMinMonths(Number(e.target.value)); setSel(new Set()); }}
          className="h-9 rounded-lg border border-slate-200 bg-white px-2 outline-none focus:border-emerald-400">
          {[1, 2, 3, 4].map((n) => <option key={n} value={n}>{n} งวด</option>)}
        </select>
        <span className="text-slate-500">ขึ้นไป · พบ <b className="text-rose-600">{list.length}</b> ราย</span>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-100 bg-white shadow-sm">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50 text-left text-xs font-semibold text-slate-500">
              <th className="px-3 py-2.5"><input type="checkbox" checked={allChecked} onChange={toggleAll} className="h-4 w-4 accent-rose-600" /></th>
              <th className="px-3 py-2.5">รหัส</th>
              <th className="px-3 py-2.5">ชื่อ-สกุล</th>
              <th className="px-3 py-2.5">ประเภท</th>
              <th className="px-3 py-2.5">หมู่</th>
              <th className="px-3 py-2.5 text-center">ค้าง (งวด)</th>
              <th className="px-3 py-2.5 text-right">ยอดค้าง</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {list.map((d) => (
              <tr key={d.h.id} className={`transition hover:bg-rose-50/30 ${sel.has(d.h.id) ? 'bg-rose-50/40' : ''}`}>
                <td className="px-3 py-2.5"><input type="checkbox" checked={sel.has(d.h.id)} onChange={() => toggle(d.h.id)} className="h-4 w-4 accent-rose-600" /></td>
                <td className="px-3 py-2.5 font-mono text-xs text-slate-400">{d.h.code}</td>
                <td className="px-3 py-2.5 font-medium text-slate-800">{d.h.name}</td>
                <td className="px-3 py-2.5"><TypeBadge type={d.h.type} /></td>
                <td className="px-3 py-2.5 text-slate-600">หมู่ {d.h.moo}</td>
                <td className="px-3 py-2.5 text-center"><span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-semibold text-rose-700">{d.months}</span></td>
                <td className="px-3 py-2.5 text-right tabular-nums font-semibold text-rose-600">{fmtMoney(d.arrears)}</td>
              </tr>
            ))}
            {list.length === 0 && <tr><td colSpan={7} className="px-3 py-12 text-center text-sm text-slate-400">ไม่มีลูกหนี้ตามเงื่อนไข</td></tr>}
          </tbody>
        </table>
      </div>

      {/* พรีวิวหนังสือ */}
      {preview && sample && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setPreview(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <div className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
              <span className="text-sm font-semibold text-slate-800">พรีวิวหนังสือแจ้งเตือน — จะพิมพ์ {chosen.length} ฉบับ</span>
              <button onClick={() => setPreview(false)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"><X className="h-5 w-5" /></button>
            </div>
            <div className="p-6">
              {/* ตัวหนังสือราชการ (จำลอง) */}
              <div className="rounded-xl border border-slate-200 p-6 text-sm leading-relaxed text-slate-700">
                <div className="text-center">
                  <p className="font-bold">หนังสือแจ้งเตือนค้างชำระค่าธรรมเนียมเก็บขนขยะมูลฝอย</p>
                  <p className="text-xs text-slate-400">องค์การบริหารส่วนตำบลลำนางรอง</p>
                </div>
                <p className="mt-4">เรียน {sample.h.name}</p>
                <p className="mt-2 indent-8">
                  ด้วยท่านมีค่าธรรมเนียมเก็บขนขยะมูลฝอยค้างชำระจำนวน <b>{sample.months} งวด</b> รวมเป็นเงิน
                  <b className="text-rose-600"> {fmtMoney(sample.arrears)} บาท</b> ประกอบด้วยงวด
                  {' '}{unpaidBills(sample.h.id).map((b) => `${thMonth(b.month)} ${b.year}`).join(', ')}
                </p>
                <p className="mt-2 indent-8">จึงขอให้ท่านนำเงินมาชำระ ณ ที่ทำการองค์การบริหารส่วนตำบล ภายใน 15 วันนับแต่วันที่ได้รับหนังสือฉบับนี้ จักขอบคุณยิ่ง</p>
                <div className="mt-6 text-center text-xs text-slate-400">
                  <p>ผู้ใช้บริการ: {sample.h.code} · {mooName(sample.h.moo)}</p>
                </div>
              </div>
            </div>
            <div className="flex gap-2 border-t border-slate-100 px-4 py-3">
              <button className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-full bg-slate-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-900"><Printer className="h-4 w-4" /> พิมพ์ทั้งหมด ({chosen.length} ฉบับ)</button>
              <button onClick={() => setPreview(false)} className="rounded-full border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50">ปิด</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
