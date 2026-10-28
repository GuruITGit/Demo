'use client';

/**
 * แถบหัวข้อหน้า (บาง) — เครื่องมือ/ค้นหา/แจ้งเตือน/โปรไฟล์ ย้ายไปอยู่ที่ TopNav แล้ว
 * คงพร็อพ {title} ไว้เพื่อให้ทุกหน้าเดิมใช้งานได้โดยไม่ต้องแก้
 */
export function Header({ title }: { title?: string }) {
  if (!title) return null;
  return (
    <div className="no-print shrink-0 px-6 pt-4 pb-1">
      <h1 className="text-base font-semibold text-gray-500">{title}</h1>
    </div>
  );
}
