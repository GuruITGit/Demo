'use client';
import { Info } from 'lucide-react';
import { ServiceTiles, type CitizenService } from '../service-grid';
import { BOX, BackLink } from '../cz-ui';

/**
 * ขอใช้รถ — เลือกประเภทรถจากรูป แล้วไปกรอกคำร้องที่ฟอร์มแจ้งเรื่อง (ล็อกประเภทให้แล้ว)
 * ชื่อประเภท ("ขอใช้บริการ" + ชื่อรถ) ต้องตรงกับ CATEGORIES ใน report/page.tsx (ฝั่งเจ้าหน้าที่ใช้ชื่อนี้แยกเรื่อง)
 */
const VEHICLE_LIST: Omit<CitizenService, 'href'>[] = [
  { art: 'rescue', title: 'รถกู้ภัย', short: 'อุบัติเหตุ เหตุฉุกเฉินทั่วไป', card: 'bg-[#FFF0E3]' },
  { art: 'fire', title: 'รถดับเพลิง', short: 'ไฟไหม้ ไฟป่า เผาหญ้า', card: 'bg-[#FFE9E6]' },
  { art: 'ambulance', title: 'รถส่งผู้ป่วย', short: 'รับ-ส่งผู้ป่วยไปโรงพยาบาล', card: 'bg-[#EEF4FB]' },
  { art: 'truck', title: 'รถแจกน้ำ', short: 'น้ำอุปโภค-บริโภค ช่วงภัยแล้ง', card: 'bg-[#DFF7FA]' },
];
const VEHICLES: CitizenService[] = VEHICLE_LIST.map((v) => ({ ...v, href: `/citizen/report?cat=${encodeURIComponent(`ขอใช้บริการ${v.title}`)}` }));

export default function CitizenVehiclePage() {
  return (
    <div className="mx-auto max-w-3xl">
      <BackLink href="/citizen">หน้าแรก</BackLink>
      <div className="mb-5 px-1 max-[720px]:mb-4">
        <h1 className="text-[30px] font-bold leading-tight text-[#0F2A44] max-[720px]:text-[24px]">ขอใช้รถ</h1>
        <p className="mt-1 text-[#64748B] max-[720px]:text-[14px]">เลือกประเภทรถที่ต้องการ แล้วกรอกรายละเอียดและจุดที่ให้ไป</p>
      </div>
      <section className={BOX}>
        <ServiceTiles items={VEHICLES} />
        <p className="mt-5 flex items-start gap-2 rounded-xl bg-[#FFF7ED] px-4 py-3 text-[14px] leading-relaxed text-[#9A3412] max-[720px]:mt-4 max-[720px]:text-[13px]">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          กรณีมีผู้บาดเจ็บหรือไฟไหม้ที่ต้องการความช่วยเหลือทันที โปรดโทร 1669 หรือ 199 ก่อน แล้วค่อยแจ้งผ่านเว็บ
        </p>
      </section>
    </div>
  );
}
