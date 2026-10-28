import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

/** ชิ้นส่วนกลางของพอร์ทัลประชาชน (ธีมฟ้าอ่อน/ขาว) — ใช้ร่วมกันทุกหน้าใน /citizen */

/** กล่องมาตรฐานของทุก section — ขาว ขอบฟ้าอ่อน */
export const BOX = 'rounded-[20px] border border-[#DCEBF8] bg-white p-8 max-[720px]:rounded-2xl max-[720px]:p-4';

/** หัวข้อของแต่ละกล่อง — ขนาดเดียวกันทุก section */
export function SectionHead({ title, sub, aside }: { title: string; sub?: string; aside?: React.ReactNode }) {
  return (
    <div className="mb-6 flex items-start justify-between gap-3 max-[720px]:mb-4">
      <div className="flex min-w-0 flex-col gap-1">
        <h2 className="text-[26px] leading-tight font-bold text-[#0F2A44] max-[720px]:text-[20px]">{title}</h2>
        {sub && <p className="text-[#64748B] max-[720px]:text-[14px]">{sub}</p>}
      </div>
      {aside}
    </div>
  );
}

/** ปุ่มย้อนกลับมาตรฐานของพอร์ทัลประชาชน — ปุ่มแคปซูลขาว มีวงกลมลูกศร เห็นชัด กดง่ายบนมือถือ (สูง 44px) */
export function BackLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href}
      className="mb-4 inline-flex min-h-[44px] items-center gap-2.5 rounded-full border border-[#CFE4F6] bg-white py-1.5 pl-1.5 pr-4 text-[15px] font-semibold text-[#0F2A44] shadow-[0_1px_2px_rgba(15,42,68,0.06)] transition hover:border-sky-400 hover:text-sky-700 active:scale-[0.98] max-[720px]:mb-3 max-[720px]:text-[14px]">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sky-50 text-sky-600">
        <ArrowLeft className="h-[18px] w-[18px]" />
      </span>
      {children}
    </Link>
  );
}
