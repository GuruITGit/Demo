import type { Metadata } from 'next';
import { Noto_Sans_Thai, Sarabun, IBM_Plex_Sans_Thai, Anuphan } from 'next/font/google';
import './globals.css';
import { Providers } from '@/components/providers';
import { getOrgBrand, FALLBACK_ICON, FALLBACK_APPLE_ICON } from '@/lib/org-brand.server';

// ฟอนต์ไทยให้ผู้ใช้เลือกเองได้ (ในปุ่มธีม) — โหลดทุกตัว แล้วสลับด้วยตัวแปร CSS [data-font]
const noto = Noto_Sans_Thai({ subsets: ['thai', 'latin'], weight: ['400', '500', '600', '700'], variable: '--font-noto' });
const sarabun = Sarabun({ subsets: ['thai', 'latin'], weight: ['400', '500', '600', '700'], variable: '--font-sarabun' });
const plex = IBM_Plex_Sans_Thai({ subsets: ['thai', 'latin'], weight: ['400', '500', '600', '700'], variable: '--font-plex' });
const anuphan = Anuphan({ subsets: ['thai', 'latin'], weight: ['400', '500', '600', '700'], variable: '--font-anuphan' });

// ชื่อแท็บ + ไอคอนเว็บ (รวมที่ Google แสดง) = ชื่อ/โลโก้ อบต. ตามโดเมน — ตั้งที่ /hub หรือ /settings (ข้อมูลองค์กร)
// ยังไม่ตั้งโลโก้ / ไม่เจอโดเมน → แบรนด์ Smart SAO สำรอง (public/brand/) · /prapa และ /checkbill มี icon.png ของตัวเอง (หยดน้ำ)
// ห้ามวาง icon.png / apple-icon.png ข้างไฟล์นี้อีก — ไอคอนแบบไฟล์ของ Next ทับค่าจาก generateMetadata
export async function generateMetadata(): Promise<Metadata> {
  const brand = await getOrgBrand();
  const icon = brand?.logoUrl || FALLBACK_ICON;
  return {
    title: brand?.nameTh || 'Smart SAO',
    description: brand ? `บริการออนไลน์ของ${brand.nameTh} — จ่ายค่าน้ำ แจ้งเรื่องร้องเรียน ยื่นคำร้อง ตลอด 24 ชม.` : 'ระบบบริหารงาน อบต.',
    icons: { icon, apple: brand?.logoUrl || FALLBACK_APPLE_ICON },
  };
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th" className="h-full">
      <body className={`${noto.variable} ${sarabun.variable} ${plex.variable} ${anuphan.variable} antialiased h-full`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
