'use client';
import { useEffect, useState } from 'react';
import { Printer, Smartphone, FileText, Check, TestTube, Bluetooth, Download, AlertTriangle } from 'lucide-react';
import { getPrinterPrefs, setPrinterPrefs, printTest, type PrintMode } from '@/lib/water-print';
import { PageHeader, Card, SectionTitle, controlBase, btn } from '../ui';

export default function PrapaPrinterPage() {
  const [mode, setMode] = useState<PrintMode>('thermal');
  const [copies, setCopies] = useState(1);
  const [saved, setSaved] = useState(false);
  const [testing, setTesting] = useState(false);

  useEffect(() => { const p = getPrinterPrefs(); setMode(p.mode); setCopies(p.copies); }, []);

  const save = (next: { mode?: PrintMode; copies?: number }) => {
    const p = { mode, copies, ...next };
    setMode(p.mode); setCopies(p.copies); setPrinterPrefs(p);
    setSaved(true); setTimeout(() => setSaved(false), 1500);
  };

  const doTest = async () => { setTesting(true); await printTest(); setTimeout(() => setTesting(false), 1200); };

  const MODES: { key: PrintMode; icon: typeof Smartphone; title: string; desc: string }[] = [
    { key: 'thermal', icon: Smartphone, title: 'เครื่องพิมพ์ความร้อน 58mm', desc: 'ภาคสนาม — มือถือ Android + แอป RawBT + เครื่องพิมพ์พกพา (Goojprt/PT-210)' },
    { key: 'pdf', icon: FileText, title: 'ไฟล์ PDF', desc: 'สำนักงาน — เปิด PDF แล้วพิมพ์ผ่านเครื่องพิมพ์ที่ต่ออยู่ (ทุกระบบ)' },
  ];

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <PageHeader icon={Printer} iconClass="text-slate-500" title="ตั้งค่าเครื่องพิมพ์"
        desc={<>ตั้งเฉพาะอุปกรณ์นี้ (แต่ละเครื่องตั้งของตัวเอง){saved && <span className="ml-1 text-emerald-600">· บันทึกแล้ว</span>}</>} />

      {/* โหมดพิมพ์ */}
      <Card>
        <SectionTitle title="วิธีพิมพ์" />
        <div className="grid gap-3 sm:grid-cols-2">
          {MODES.map((m) => {
            const on = mode === m.key;
            return (
              <button key={m.key} onClick={() => save({ mode: m.key })}
                className={`flex items-start gap-3 rounded-xl border p-4 text-left transition ${on ? 'border-sky-500 bg-sky-50' : 'border-slate-200 hover:border-slate-300'}`}>
                <m.icon className={`mt-0.5 h-5 w-5 shrink-0 ${on ? 'text-sky-600' : 'text-slate-400'}`} />
                <span>
                  <span className={`flex items-center gap-1.5 text-sm font-medium ${on ? 'text-sky-800' : 'text-slate-700'}`}>{m.title} {on && <Check className="h-4 w-4" />}</span>
                  <span className="mt-0.5 block text-xs text-slate-500">{m.desc}</span>
                </span>
              </button>
            );
          })}
        </div>

        {/* จำนวนสำเนา (เฉพาะ thermal) */}
        {mode === 'thermal' && (
          <label className="mt-4 flex items-center justify-between gap-3 text-sm text-slate-600 sm:justify-start">
            จำนวนสำเนาต่อครั้ง
            <select value={copies} onChange={(e) => save({ copies: Number(e.target.value) })} className={`${controlBase} w-28 px-3`}>
              {[1, 2, 3].map((n) => <option key={n} value={n}>{n} ใบ</option>)}
            </select>
          </label>
        )}
      </Card>

      {/* ทดสอบพิมพ์ */}
      {mode === 'thermal' && (
        <Card>
          <SectionTitle title="ทดสอบการเชื่อมต่อ" desc="ส่งใบทดสอบไปที่ RawBT → เครื่องพิมพ์ ถ้าพิมพ์ออกครบแสดงว่าใช้ได้" />
          <button onClick={doTest} disabled={testing} className={`${btn('primary')} w-full sm:w-auto`}>
            <TestTube className="h-4 w-4" /> {testing ? 'กำลังส่ง...' : 'ทดสอบพิมพ์'}
          </button>
        </Card>
      )}

      {/* วิธีติดตั้ง (เฉพาะ thermal) */}
      {mode === 'thermal' && (
        <Card>
          <p className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-slate-700"><Bluetooth className="h-4 w-4 text-sky-500" /> ตั้งครั้งแรก (ทำครั้งเดียวต่อเครื่อง)</p>
          <ol className="space-y-2.5 text-sm text-slate-600">
            <Step n={1}><b>เปิดเครื่องพิมพ์</b> แล้วเปิด Bluetooth บนมือถือ · จับคู่ (pair) เครื่องพิมพ์ในหน้าตั้งค่า Bluetooth ก่อน</Step>
            <Step n={2}><span className="inline-flex items-center gap-1"><Download className="h-3.5 w-3.5" /> ติดตั้งแอป <b>RawBT print service</b></span> จาก Google Play</Step>
            <Step n={3}>เปิด RawBT → เลือกเครื่องพิมพ์ที่จับคู่ไว้ → ตั้งเป็นค่าเริ่มต้น</Step>
            <Step n={4}>กลับมากด <b>ทดสอบพิมพ์</b> — ครั้งแรก Android จะถามให้เปิดด้วย RawBT ให้เลือก RawBT</Step>
          </ol>
          <div className="mt-4 rounded-xl bg-amber-50 p-3 text-xs text-amber-800">
            <p className="mb-1 flex items-center gap-1.5 font-semibold"><AlertTriangle className="h-3.5 w-3.5" /> แก้ปัญหาที่เจอบ่อย</p>
            <ul className="ml-4 list-disc space-y-1">
              <li><b>กดพิมพ์แล้วไม่มีอะไรเกิด</b> — ยังไม่ได้ติดตั้ง RawBT หรือยังไม่ได้ตั้งเป็นค่าเริ่มต้น</li>
              <li><b>ตัวหนังสือเพี้ยน/เป็นสี่เหลี่ยม</b> — เช็คว่าเลือกเครื่องพิมพ์ถูกตัวใน RawBT</li>
              <li><b>เชื่อมไม่ติด</b> — ลืมอุปกรณ์ Bluetooth แล้วจับคู่ใหม่ · แบตเครื่องพิมพ์ต้องพอ</li>
              <li><b>ใช้ iPhone</b> — RawBT ใช้ได้เฉพาะ Android · ให้เปลี่ยนเป็นโหมด <b>PDF</b> แทน</li>
            </ul>
          </div>
        </Card>
      )}

      {mode === 'pdf' && (
        <Card className="text-sm text-slate-600">
          <SectionTitle title="โหมด PDF" />
          <p>กดพิมพ์บิลจะเปิดไฟล์ PDF ขนาด 58mm ในแท็บใหม่ แล้วสั่งพิมพ์ผ่านเครื่องพิมพ์ที่เครื่องรู้จัก (รวมเครื่องพิมพ์ A4 ที่สำนักงาน)</p>
          <p className="mt-2 text-xs text-slate-400">เหมาะกับจุดรับเงินที่สำนักงาน หรือ iPhone</p>
        </Card>
      )}
    </div>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-2.5">
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-sky-100 text-xs font-semibold text-sky-700">{n}</span>
      <span>{children}</span>
    </li>
  );
}
