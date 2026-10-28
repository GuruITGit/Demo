'use client';
import { ROUTES, households, mooName } from '../mock';
import { PageHead, DemoNote } from '../ui';
import { Truck, User, CalendarDays, MapPin } from 'lucide-react';

const DAYS = ['จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์', 'อาทิตย์'];

export default function SchedulePage() {
  const countByMoo = (moo: number) => households.filter((h) => h.moo === moo && h.active).length;

  // สร้างตารางรายวัน: วัน → หมู่ที่เก็บ
  const byDay = DAYS.map((d) => ({
    day: d,
    moos: ROUTES.filter((r) => r.days.includes(d)).map((r) => r.moo),
  }));

  return (
    <div>
      <PageHead title="ตารางเก็บขยะ / เส้นทางรถ" subtitle="วันเก็บ · รถ · เจ้าหน้าที่ประจำเส้นทาง แยกตามหมู่บ้าน" />
      <DemoNote />

      {/* ปฏิทินรายสัปดาห์ */}
      <div className="mb-6 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
          <CalendarDays className="h-4 w-4 text-emerald-500" /> ตารางประจำสัปดาห์
        </h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
          {byDay.map((d) => {
            const off = d.moos.length === 0;
            return (
              <div key={d.day} className={`rounded-xl border p-3 text-center ${off ? 'border-slate-100 bg-slate-50' : 'border-emerald-100 bg-emerald-50/50'}`}>
                <p className="text-xs font-semibold text-slate-600">{d.day}</p>
                <div className="mt-2 space-y-1">
                  {off
                    ? <span className="text-[11px] text-slate-300">— หยุด —</span>
                    : d.moos.map((m) => (
                      <span key={m} className="block rounded-md bg-white px-1.5 py-0.5 text-[11px] font-medium text-emerald-700 ring-1 ring-emerald-100">หมู่ {m}</span>
                    ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* เส้นทาง/รถ */}
      <div className="grid gap-3 sm:grid-cols-2">
        {ROUTES.map((r) => (
          <div key={r.moo} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between">
              <div>
                <p className="flex items-center gap-1.5 text-sm font-bold text-slate-800">
                  <MapPin className="h-4 w-4 text-emerald-500" /> หมู่ {r.moo} — {r.name}
                </p>
                <p className="mt-1 text-[11px] text-slate-400">{countByMoo(r.moo)} ครัวเรือน</p>
              </div>
              <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 ring-1 ring-emerald-200">{r.days}</span>
            </div>
            <div className="mt-3 flex flex-wrap gap-4 text-xs text-slate-600">
              <span className="inline-flex items-center gap-1.5"><Truck className="h-4 w-4 text-slate-400" /> ทะเบียนรถ {r.truck}</span>
              <span className="inline-flex items-center gap-1.5"><User className="h-4 w-4 text-slate-400" /> {r.staff}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
