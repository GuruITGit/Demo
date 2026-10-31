'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Landmark, ShieldCheck } from 'lucide-react';
import { api } from '@/lib/api';

type Brand = { nameTh?: string; logoUrl?: string | null } | null;

/** โทนสี "หน้าบ้าน" ประชาชน — ฟ้าอ่อน/ขาว (พื้น #F5FAFF · accent sky-600 · ตัวอักษร #0F2A44) */
export default function CitizenLayout({ children }: { children: React.ReactNode }) {
  // แบรนด์ อบต. ตามโดเมนที่เปิด (multi-tenant) — ห้าม hardcode ชื่อ อบต.
  const [brand, setBrand] = useState<Brand>(null);
  useEffect(() => {
    api.get('/organizations/by-host').then((r) => { if (r.data?.data?.found) setBrand(r.data.data); }).catch(() => {});
  }, []);
  const orgName = brand?.nameTh || 'บริการประชาชนออนไลน์';

  return (
    <div className="flex min-h-screen flex-col bg-[#F5FAFF] font-[family-name:var(--font-plex)] text-[#0F2A44]">
      {/* แถบบน — มือถือ 2 แถว: (1) ชื่อ อบต. (2) เมนูทั้ง 4 แถวเดียว · จอใหญ่อยู่แถวเดียวกัน */}
      <header className="border-b border-[#DCEBF8] bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-6 py-3.5 max-[720px]:px-4 max-[720px]:py-2.5">
          <Link href="/citizen" className="flex min-w-0 items-center gap-3 max-[720px]:gap-2.5">
            {/* ตรา อบต. ส่วนใหญ่เป็นวงกลม → แสดงเป็นวงกลมเต็มกรอบ (ไม่มีขอบขาว) · ยังไม่มีโลโก้ = ไอคอนในกรอบสี่เหลี่ยมสีฟ้าเดิม */}
            {brand?.logoUrl
              ? <span className="flex h-11 w-11 shrink-0 overflow-hidden rounded-full max-[720px]:h-9 max-[720px]:w-9">
                  <img src={brand.logoUrl} alt="" className="h-full w-full rounded-full object-cover" />
                </span>
              : <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-sky-600 text-white max-[720px]:h-9 max-[720px]:w-9 max-[720px]:rounded-lg">
                  <Landmark className="h-6 w-6" />
                </span>}
            <span className="min-w-0 leading-tight">
              <strong className="block truncate text-[19px] font-semibold max-[720px]:text-[16px]">{orgName}</strong>
              <small className="block text-sm text-[#64748B] max-[720px]:text-[12px]">บริการประชาชนออนไลน์</small>
            </span>
          </Link>
          <nav className="flex items-center gap-x-5 text-base font-medium max-[720px]:w-full max-[720px]:justify-between max-[720px]:gap-x-1 max-[720px]:border-t max-[720px]:border-[#EAF5FE] max-[720px]:pt-1.5 max-[720px]:text-[14px]" aria-label="เมนูหลัก">
            <Link href="/citizen#services" className="px-1 py-2 hover:underline">บริการ</Link>
            <Link href="/citizen#news" className="px-1 py-2 hover:underline">ข่าว<span className="max-[720px]:hidden">ประชาสัมพันธ์</span></Link>
            <Link href="/citizen#contact" className="px-1 py-2 hover:underline">ติดต่อ<span className="max-[720px]:hidden"> อบต.</span></Link>
            <Link href="/login?staff=1"
              className="inline-flex min-h-[44px] items-center gap-1.5 whitespace-nowrap rounded-xl border border-[#CFE4F6] px-4 text-sm font-semibold text-sky-700 transition hover:border-sky-600 hover:bg-sky-600 hover:text-white max-[720px]:min-h-[36px] max-[720px]:rounded-lg max-[720px]:px-2.5 max-[720px]:text-[13px]">
              <ShieldCheck className="h-4 w-4" /> สำหรับเจ้าหน้าที่
            </Link>
          </nav>
        </div>
      </header>

      {/* padding มาตรฐานของทุกหน้าในพอร์ทัล — flex-1 ดันฟุตเตอร์ลงล่างสุดเสมอแม้เนื้อหาสั้น */}
      <main className="flex-1 px-4 pb-16 pt-6 sm:px-6 sm:pt-8">{children}</main>

      <footer className="border-t border-[#DCEBF8] bg-white text-[15px] text-[#475569]">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-6 py-6">
          <span>© {orgName} · ระบบบริการประชาชนออนไลน์</span>
          <span className="text-[#64748B]">ข้อมูลที่ท่านกรอกใช้เพื่อดำเนินการตามเรื่องที่แจ้งเท่านั้น</span>
        </div>
      </footer>
    </div>
  );
}
