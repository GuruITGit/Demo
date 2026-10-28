'use client';
import Link from 'next/link';
import {
  FileText, Receipt, Coins, FileWarning, BarChart3, ClipboardList,
  Users, Truck, Settings2, ArrowRight, Recycle,
} from 'lucide-react';
import {
  households, debtors, periodSummary, CURRENT, thMonth, fmtMoney,
} from './mock';
import { StatCard, ProgressBar } from './ui';

const MODULES = [
  { href: '/khaya/cashier', label: 'รับชำระเงิน (สำนักงาน)', sub: 'ค้นครัวเรือน → รับเงิน → พิมพ์ใบเสร็จ', icon: Receipt, tone: 'from-emerald-500 to-teal-600' },
  { href: '/khaya/collect', label: 'รับชำระ (ภาคสนาม)', sub: 'เก็บเงินตามหมู่ / เส้นทางรถ', icon: Coins, tone: 'from-teal-500 to-cyan-600' },
  { href: '/khaya/notices', label: 'หนังสือแจ้งค้างชำระ', sub: 'ออกหนังสือทวง · พิมพ์ซอง', icon: FileWarning, tone: 'from-rose-500 to-pink-600' },
  { href: '/khaya/dashboard', label: 'สรุปการจัดเก็บ', sub: 'ยอดจัดเก็บ · แยกหมู่ / ประเภท', icon: BarChart3, tone: 'from-sky-500 to-blue-600' },
  { href: '/khaya/report', label: 'รายงานลูกหนี้ / รายรับ', sub: 'บัญชีลูกหนี้ · รายรับ · Excel/PDF', icon: ClipboardList, tone: 'from-violet-500 to-purple-600' },
  { href: '/khaya/customers', label: 'ทะเบียนผู้ใช้บริการ', sub: 'ค้นหา · เพิ่ม · แก้ไข · ประเภท', icon: Users, tone: 'from-amber-500 to-orange-600' },
  { href: '/khaya/schedule', label: 'ตารางเก็บขยะ / เส้นทางรถ', sub: 'วันเก็บ · รถ · เจ้าหน้าที่', icon: Truck, tone: 'from-lime-500 to-green-600' },
  { href: '/khaya/rate', label: 'อัตราค่าธรรมเนียม', sub: 'เรตตามประเภท · ใบเสร็จ', icon: Settings2, tone: 'from-slate-500 to-slate-600' },
];

const STEPS = [
  { icon: Users, title: 'ทะเบียนครัวเรือน', sub: 'แยกประเภท บ้าน/ร้านค้า/ตลาด' },
  { icon: FileText, title: 'ออกบิลประจำงวด', sub: 'คิดค่าธรรมเนียมตามอัตรา' },
  { icon: Coins, title: 'จัดเก็บเงิน', sub: 'สำนักงาน / ภาคสนาม + ใบเสร็จ' },
  { icon: BarChart3, title: 'สรุป & ทวงหนี้', sub: 'รายงาน + หนังสือค้างชำระ' },
];

export default function KhayaHome() {
  const totalHH = households.length;
  const activeHH = households.filter((h) => h.active).length;
  const sum = periodSummary(CURRENT.year, CURRENT.month);
  const dl = debtors();
  const totalArrears = dl.reduce((s, x) => s + x.arrears, 0);

  return (
    <div className="space-y-6">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-3xl bg-linear-to-br from-emerald-600 via-teal-600 to-teal-700 p-6 text-white shadow-lg sm:p-8">
        <div className="pointer-events-none absolute -right-10 -top-12 h-52 w-52 rounded-full bg-white/10 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-16 right-1/3 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
        <Recycle className="pointer-events-none absolute -bottom-6 -right-4 h-40 w-40 text-white/10" strokeWidth={1.2} />
        <div className="relative">
          <p className="text-sm font-medium text-white/85">องค์การบริหารส่วนตำบล · กองสาธารณสุขและสิ่งแวดล้อม</p>
          <h1 className="mt-1 text-2xl font-bold sm:text-3xl">ระบบจัดเก็บค่าธรรมเนียมขยะมูลฝอย</h1>
          <p className="mt-2 max-w-lg text-sm text-white/85">
            งวดปัจจุบัน <span className="font-semibold text-white">{thMonth(CURRENT.month)} {CURRENT.year}</span> — จัดเก็บได้ {sum.rate * 100 >= 0 ? Math.round(sum.rate * 100) : 0}% ของยอดตั้งเก็บ
          </p>
          <div className="mt-5 flex flex-wrap gap-2.5">
            <Link href="/khaya/cashier" className="inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-sm font-semibold text-emerald-700 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
              <Receipt className="h-4 w-4" /> รับชำระเงิน <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="/khaya/bills" className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-4 py-2 text-sm font-semibold text-white ring-1 ring-white/30 transition hover:bg-white/25">
              <FileText className="h-4 w-4" /> ออกบิลประจำงวด
            </Link>
          </div>
        </div>
      </section>

      {/* สถิติงวด */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="ครัวเรือนในทะเบียน" value={totalHH} unit="ราย" tone="amber" icon={Users} sub={`ใช้บริการอยู่ ${activeHH} ราย`} />
        <StatCard label="ออกบิลงวดนี้" value={sum.billed} unit="ใบ" tone="sky" icon={FileText} sub={`ตั้งเก็บ ${fmtMoney(sum.target)} บาท`} />
        <StatCard label="เก็บได้งวดนี้" value={fmtMoney(sum.collected)} unit="บาท" tone="emerald" icon={Coins} sub={`ชำระแล้ว ${sum.paidCount} ราย`} />
        <StatCard label="ค้างชำระสะสม" value={fmtMoney(totalArrears)} unit="บาท" tone="rose" icon={FileWarning} sub={`ลูกหนี้ ${dl.length} ราย`} />
      </section>

      {/* อัตราจัดเก็บงวด */}
      <section className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="font-semibold text-slate-700">อัตราจัดเก็บงวด {thMonth(CURRENT.month)} {CURRENT.year}</span>
          <span className="font-bold text-emerald-600">{Math.round(sum.rate * 100)}%</span>
        </div>
        <ProgressBar value={sum.rate} tone={sum.rate >= 0.6 ? 'emerald' : sum.rate >= 0.3 ? 'amber' : 'rose'} />
        <p className="mt-2 text-xs text-slate-400">
          ชำระแล้ว {sum.paidCount}/{sum.billed} ราย · ยังค้าง {sum.unpaid} ราย · คงเหลือรอเก็บ {fmtMoney(sum.outstanding)} บาท
        </p>
      </section>

      {/* เมนูทั้งหมด */}
      <section>
        <h2 className="mb-3 text-sm font-semibold text-slate-500">เมนูทั้งหมด</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {MODULES.map((m) => (
            <Link key={m.href} href={m.href}
              className="group flex flex-col rounded-2xl border border-slate-100 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-md">
              <span className={`flex h-11 w-11 items-center justify-center rounded-xl bg-linear-to-br ${m.tone} text-white shadow-sm transition group-hover:scale-105`}>
                <m.icon className="h-5 w-5" />
              </span>
              <p className="mt-3 text-sm font-semibold text-slate-800">{m.label}</p>
              <p className="mt-0.5 text-[11px] leading-snug text-slate-400">{m.sub}</p>
            </Link>
          ))}
        </div>
      </section>

      {/* ทำงานยังไง */}
      <section className="overflow-hidden rounded-3xl border border-emerald-100 bg-linear-to-br from-emerald-50/70 to-teal-50/50 p-6">
        <h2 className="mb-5 text-center text-base font-bold text-slate-800">ระบบทำงานอย่างไร</h2>
        <div className="flex items-start">
          {STEPS.map((s, i) => (
            <div key={i} className="flex flex-1 items-start last:flex-none">
              <div className="flex flex-col items-center gap-2 px-1 text-center">
                <div className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-emerald-600 shadow-sm ring-1 ring-emerald-100">
                  <s.icon className="h-5 w-5" />
                  <span className="absolute -right-1 -top-1 grid h-5 w-5 place-items-center rounded-full bg-emerald-500 text-[10px] font-bold text-white">{i + 1}</span>
                </div>
                <span className="text-xs font-semibold text-slate-700">{s.title}</span>
                <span className="hidden text-[11px] text-slate-500 sm:block">{s.sub}</span>
              </div>
              {i < STEPS.length - 1 && <div className="mx-1 mt-6 h-0.5 flex-1 rounded bg-emerald-200 sm:mx-2" />}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
