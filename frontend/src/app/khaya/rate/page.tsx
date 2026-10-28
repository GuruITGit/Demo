'use client';
import { useState } from 'react';
import { KTYPES, RATE, households } from '../mock';
import { PageHead, TypeBadge, DemoNote } from '../ui';
import { Save, Receipt, Percent } from 'lucide-react';

export default function RatePage() {
  const [rates, setRates] = useState<Record<string, number>>({ ...RATE });
  const [fine, setFine] = useState(0);
  const [docName, setDocName] = useState('ใบเสร็จรับเงินค่าธรรมเนียมเก็บขนขยะมูลฝอย');
  const [header, setHeader] = useState('องค์การบริหารส่วนตำบลลำนางรอง อ.โนนดินแดง จ.บุรีรัมย์ โทร. 0-4462-xxxx');
  const [footer, setFooter] = useState('ขอบคุณที่ร่วมรักษาความสะอาดของชุมชน');
  const [saved, setSaved] = useState(false);

  const countByType = (t: string) => households.filter((h) => h.type === t).length;

  return (
    <div>
      <PageHead title="ตั้งค่าอัตราค่าธรรมเนียม" subtitle="กำหนดอัตราเก็บรายเดือนตามประเภทผู้ใช้บริการ + ข้อความบนใบเสร็จ" />
      <DemoNote />

      {/* อัตราตามประเภท */}
      <section className="mb-5 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-slate-700">อัตราค่าธรรมเนียม (บาท/เดือน)</h2>
        <div className="space-y-2">
          {KTYPES.map((t) => (
            <div key={t} className="flex items-center gap-3 rounded-xl border border-slate-100 px-3 py-2">
              <div className="flex-1">
                <TypeBadge type={t} />
                <span className="ml-2 text-[11px] text-slate-400">{countByType(t)} ราย</span>
              </div>
              <div className="flex items-center gap-1.5">
                <input type="number" value={rates[t]} onChange={(e) => { setRates({ ...rates, [t]: Number(e.target.value) }); setSaved(false); }}
                  className="h-9 w-24 rounded-lg border border-slate-200 px-2 text-right text-sm tabular-nums outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100" />
                <span className="text-sm text-slate-400">บาท</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ค่าปรับ */}
      <section className="mb-5 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
        <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-slate-700"><Percent className="h-4 w-4 text-emerald-500" /> ค่าปรับชำระล่าช้า</h2>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-slate-500">ปรับเพิ่ม</span>
          <input type="number" value={fine} onChange={(e) => { setFine(Number(e.target.value)); setSaved(false); }}
            className="h-9 w-20 rounded-lg border border-slate-200 px-2 text-right tabular-nums outline-none focus:border-emerald-400" />
          <span className="text-slate-500">บาท/งวดที่ค้าง (เว้น 0 = ไม่คิดค่าปรับ)</span>
        </div>
      </section>

      {/* ใบเสร็จ */}
      <section className="mb-5 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
        <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-slate-700"><Receipt className="h-4 w-4 text-emerald-500" /> เอกสาร / ใบเสร็จ</h2>
        <div className="space-y-3 text-sm">
          <label className="block">
            <span className="text-xs font-medium text-slate-500">ชื่อเอกสาร (หัวใบเสร็จ)</span>
            <input value={docName} onChange={(e) => { setDocName(e.target.value); setSaved(false); }}
              className="mt-1 h-9 w-full rounded-lg border border-slate-200 px-2 outline-none focus:border-emerald-400" />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-slate-500">ข้อความหัวเอกสาร (ที่อยู่/เบอร์ อบต.)</span>
            <input value={header} onChange={(e) => { setHeader(e.target.value); setSaved(false); }}
              className="mt-1 h-9 w-full rounded-lg border border-slate-200 px-2 outline-none focus:border-emerald-400" />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-slate-500">ข้อความท้ายใบเสร็จ</span>
            <input value={footer} onChange={(e) => { setFooter(e.target.value); setSaved(false); }}
              className="mt-1 h-9 w-full rounded-lg border border-slate-200 px-2 outline-none focus:border-emerald-400" />
          </label>
        </div>
      </section>

      <div className="flex items-center gap-3">
        <button onClick={() => setSaved(true)}
          className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700">
          <Save className="h-4 w-4" /> บันทึกการตั้งค่า
        </button>
        {saved && <span className="text-sm font-medium text-emerald-600">✓ บันทึกแล้ว (เดโม — ไม่เก็บถาวร)</span>}
      </div>
    </div>
  );
}
