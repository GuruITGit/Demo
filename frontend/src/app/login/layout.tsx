import type { Metadata } from 'next';

// หน้าเข้าระบบเจ้าหน้าที่ — ไม่ให้ Google เก็บไปแสดงในผลค้นหา (ประชาชนควรเจอหน้า /citizen)
export const metadata: Metadata = {
  title: 'เข้าสู่ระบบเจ้าหน้าที่ · Smart SAO',
  robots: { index: false, follow: false },
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
