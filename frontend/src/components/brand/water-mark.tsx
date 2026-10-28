/**
 * โลโก้ประจำระบบประปา — หยดน้ำ + หน้าปัดมาตรวัดน้ำ (เจนเวกเตอร์เอง)
 * หยดน้ำ gradient sky→cyan (เข้าธีมแถบบน) + หน้าปัดขาว + เข็มชี้ → อ่านออกทั้งบนชิปขาวและพื้นสว่าง
 * id ของ gradient ไม่ซ้ำ (คงที่) ปลอดภัยเมื่อมีหลายตัวในหน้าเดียว
 */
export function WaterMark({ className = 'h-8 w-8' }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} role="img" aria-label="ระบบประปา" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="wm-drop" x1="10" y1="6" x2="38" y2="44" gradientUnits="userSpaceOnUse">
          <stop stopColor="#0ea5e9" />
          <stop offset="1" stopColor="#0891b2" />
        </linearGradient>
      </defs>
      {/* หยดน้ำ */}
      <path
        d="M24 3.5C24 3.5 38.5 19.5 38.5 30A14.5 14.5 0 1 1 9.5 30C9.5 19.5 24 3.5 24 3.5Z"
        fill="url(#wm-drop)"
      />
      {/* ไฮไลต์ผิวน้ำซ้ายบน */}
      <path
        d="M18.2 12.8C15 17 12.6 21.7 12.2 25.6c-.15 1.5-2.2 1.4-2.2-.1 0-3.9 2.4-8.9 5.7-13.4.9-1.2 3.4-.4 2.5 1.1Z"
        fill="#e0f7ff" opacity="0.5"
      />
      {/* หน้าปัดมาตรวัด (ขาว) */}
      <circle cx="24" cy="30.5" r="9.2" fill="#ffffff" />
      {/* สเกล 3 ขีด */}
      <circle cx="18.4" cy="27" r="1" fill="#0891b2" />
      <circle cx="24" cy="25.2" r="1" fill="#0891b2" />
      <circle cx="29.6" cy="27" r="1" fill="#0891b2" />
      {/* เข็มชี้ */}
      <path d="M24 30.5L28.2 26.9" stroke="#0e7490" strokeWidth="1.9" strokeLinecap="round" />
      <circle cx="24" cy="30.5" r="1.9" fill="#0e7490" />
    </svg>
  );
}
