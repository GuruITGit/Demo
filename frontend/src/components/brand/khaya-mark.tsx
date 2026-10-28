/**
 * โลโก้ประจำระบบจัดเก็บค่าขยะ — ถังขยะ + ใบไม้ (สื่อสิ่งแวดล้อม/รีไซเคิล)
 * gradient เขียว emerald→teal (เข้าธีมแถบบน) + ใบไม้ขาว → อ่านออกทั้งบนชิปขาวและพื้นสว่าง
 * id ของ gradient คงที่ ไม่ชนกันเมื่อมีหลายตัวในหน้าเดียว
 */
export function KhayaMark({ className = 'h-8 w-8' }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} role="img" aria-label="ระบบค่าขยะ" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="km-bin" x1="10" y1="8" x2="38" y2="42" gradientUnits="userSpaceOnUse">
          <stop stopColor="#10b981" />
          <stop offset="1" stopColor="#0d9488" />
        </linearGradient>
      </defs>
      {/* หูจับฝา */}
      <path d="M20 10.5V8a1.6 1.6 0 0 1 1.6-1.6h4.8A1.6 1.6 0 0 1 28 8v2.5" stroke="url(#km-bin)" strokeWidth="2.2" fill="none" strokeLinecap="round" />
      {/* ฝาถัง */}
      <rect x="9" y="10.5" width="30" height="5.6" rx="2.8" fill="url(#km-bin)" />
      {/* ตัวถัง (ทรงคว่ำเล็กน้อย) */}
      <path d="M12.4 17.6h23.2l-2.1 20.9a3.2 3.2 0 0 1-3.18 2.9H17.68a3.2 3.2 0 0 1-3.18-2.9L12.4 17.6Z" fill="url(#km-bin)" />
      {/* ใบไม้ขาว */}
      <path d="M17.8 34.2c0-6 4.6-9.6 10.8-9.6-.2 6.4-4.6 9.9-10.8 9.6Z" fill="#ffffff" opacity="0.96" />
      {/* ก้าน/เส้นกลางใบ */}
      <path d="M26.4 27.2c-3 1.3-5.4 3.6-6.9 6.7" stroke="#0d9488" strokeWidth="1.5" fill="none" strokeLinecap="round" />
    </svg>
  );
}
