import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'ตรวจสอบค่าน้ำประปา',
  description: 'เช็คยอดค้างชำระ ประวัติการใช้น้ำ และชำระค่าน้ำประปาด้วยตนเอง',
  // ระบุตรงๆ — root ใช้ generateMetadata (โลโก้ อบต.) ซึ่งทับไฟล์ icon.png ของโฟลเดอร์นี้
  icons: { icon: '/checkbill/icon.png', apple: '/checkbill/apple-icon.png' },
};

/** พอร์ทัลสมาชิก (สาธารณะ) — ไม่มี sidebar/แถบระบบหลัก, ไม่ต้องล็อกอินระบบ อบต. */
export default function CheckbillLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-linear-to-b from-sky-50 via-white to-cyan-50">{children}</div>;
}
