'use client';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { ServiceIllus, type ServiceArt } from './service-illus';

/** บริการประชาชน (ชุดเดียวใช้ทั้งหน้าแรกและหน้า "ดูทั้งหมด") — ไม่มี href = ยังไม่เปิด (ป้าย "เร็วๆ นี้") */
/** static = หน้านอก Next (เช่น /citizen/market ที่ rewrite ไป public/) → ใช้ <a> โหลดเต็มหน้า ไม่ใช่ <Link> */
export type CitizenService = { href?: string; static?: boolean; art: ServiceArt; title: string; short: string; card: string };

export const SERVICE_GROUPS: { title: string; items: CitizenService[] }[] = [
  {
    title: 'ชำระเงินออนไลน์',
    items: [
      { href: '/citizen/water', art: 'water', title: 'ค่าน้ำประปา', short: 'ดูยอดค้าง จ่ายได้ทุกเวลา', card: 'bg-[#E3F2FD]' },
      { href: '/citizen/waste', static: true, art: 'garbage', title: 'ค่าเก็บขยะ', short: 'ค่าธรรมเนียมรายเดือน/รายปี', card: 'bg-[#E3F7EC]' },
      { href: '/citizen/market#dues', static: true, art: 'market', title: 'ค่าแผงตลาด', short: 'ค่าเช่าแผงพ่อค้าแม่ค้า', card: 'bg-[#FFF3DC]' },
      { art: 'lotus', title: 'เงินฌาปนกิจสงเคราะห์', short: 'ส่งเงินสงเคราะห์ศพสมาชิก', card: 'bg-[#F1EBFF]' },
    ],
  },
  {
    title: 'แจ้งเรื่อง / ขอใช้บริการ',
    items: [
      { href: '/citizen/report', art: 'megaphone', title: 'แจ้งเหตุ / ร้องเรียน', short: 'ไฟฟ้า ถนน ประปา ขยะ ฯลฯ', card: 'bg-[#E4EDFF]' },
      { href: '/citizen/vehicle', art: 'fire', title: 'ขอใช้รถ', short: 'กู้ภัย ดับเพลิง ส่งผู้ป่วย แจกน้ำ', card: 'bg-[#FFE9E6]' },
    ],
  },
];

export const ALL_SERVICES = SERVICE_GROUPS.flatMap((g) => g.items);

/** การ์ดหน้าแรก — เฉพาะที่ประชาชนใช้บ่อย · ค่าน้ำประปา/เงินฌาปนกิจยังอยู่ในหน้า "ดูทั้งหมด" */
export const HOME_SERVICES = ['ค่าเก็บขยะ', 'ค่าแผงตลาด', 'แจ้งเหตุ / ร้องเรียน', 'ขอใช้รถ'].flatMap((t) => ALL_SERVICES.filter((s) => s.title === t));

/** การ์ดบริการสไตล์แอปทางรัฐ — พื้นพาสเทล ชื่อมุมซ้ายบน ภาพประกอบมุมขวาล่าง · ยังไม่เปิด = กดไม่ได้ + ป้าย "เร็วๆ นี้" */
export function ServiceTile({ sv }: { sv: CitizenService }) {
  // ปรับตามความกว้างการ์ดเอง (container query) — การ์ดแคบ (มือถือ / 4 คอลัมน์) ใช้แบบย่อ: ซ่อนคำอธิบาย ภาพเล็กลง
  const inner = (
    <>
      <span className="relative z-10 flex max-w-[58%] flex-col gap-1 @max-[340px]:max-w-full">
        <span className="text-[21px] font-bold leading-snug text-[#0F2A44] @max-[340px]:text-[17px] @max-[220px]:text-[15.5px]">{sv.title}</span>
        <span className="text-[15px] leading-snug text-[#475569] @max-[340px]:hidden">{sv.short}</span>
        {!sv.href && <span className="hidden w-fit rounded-full bg-white/80 px-2 py-0.5 text-[11px] font-medium text-[#64748B] @max-[340px]:inline-flex">เร็วๆ นี้</span>}
      </span>
      <span className="relative z-10 mt-auto">
        {sv.href
          ? <span className="inline-flex h-9 items-center gap-1 rounded-full bg-white px-3.5 text-[14px] font-semibold text-sky-700 @max-[340px]:h-8 @max-[340px]:w-8 @max-[340px]:justify-center @max-[340px]:px-0">
              <span className="@max-[340px]:hidden">ใช้บริการ</span><ArrowRight className="h-4 w-4" />
            </span>
          : <span className="inline-flex rounded-full bg-white/80 px-2.5 py-1 text-[12px] font-medium text-[#64748B] @max-[340px]:hidden">เร็วๆ นี้</span>}
      </span>
      <ServiceIllus name={sv.art}
        className="pointer-events-none absolute bottom-2 right-3 h-[82%] w-auto transition group-hover:scale-[1.04] @max-[340px]:bottom-1 @max-[340px]:right-1 @max-[340px]:h-auto @max-[340px]:w-[62%]" />
    </>
  );
  const box = `group relative flex min-h-[180px] flex-col overflow-hidden rounded-2xl p-6 max-[720px]:min-h-[158px] max-[720px]:rounded-xl max-[720px]:p-3.5 ${sv.card}`;
  const linkCls = `${box} transition hover:-translate-y-0.5 hover:shadow-[0_8px_20px_-12px_rgba(15,42,68,0.35)]`;
  const card = !sv.href
    ? <div className={box} aria-disabled="true">{inner}</div>
    : sv.static
      ? <a href={sv.href} className={linkCls}>{inner}</a>
      : <Link href={sv.href} className={linkCls}>{inner}</Link>;
  return <div className="@container">{card}</div>;
}

/** การ์ดบริการ 2 คอลัมน์ */
export function ServiceTiles({ items }: { items: CitizenService[] }) {
  return (
    <div className="grid grid-cols-2 gap-4 max-[720px]:gap-2.5">
      {items.map((sv) => <ServiceTile key={sv.title} sv={sv} />)}
    </div>
  );
}
