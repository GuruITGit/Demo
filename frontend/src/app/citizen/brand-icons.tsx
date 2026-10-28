/** โลโก้ช่องทางติดต่อ (วาดเป็น SVG ในตัว ไม่โหลดจากภายนอก) — ใช้ในส่วน "ติดต่อ อบต." */

export function LineIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
      <rect width="48" height="48" rx="11" fill="#06C755" />
      <path fill="#fff" d="M24 10.5c-8.8 0-16 5.8-16 12.9 0 6.4 5.7 11.7 13.4 12.7.5.1 1.2.3 1.4.8.2.4.1 1.1.1 1.5l-.2 1.4c-.1.4-.3 1.6 1.4.9 1.7-.7 9.3-5.5 12.7-9.4 2.3-2.6 3.4-5.2 3.4-7.9 0-7.1-7.2-12.9-16.2-12.9z" />
      <text x="24" y="26.6" textAnchor="middle" fontSize="7.6" fontWeight="800" fill="#06C755" fontFamily="Arial, Helvetica, sans-serif">LINE</text>
    </svg>
  );
}

export function FacebookIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path fill="#1877F2" d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.1 10.13 24v-8.44H7.08v-3.49h3.04V9.41c0-3.02 1.8-4.7 4.54-4.7 1.31 0 2.68.24 2.68.24v2.97h-1.5c-1.5 0-1.96.93-1.96 1.89v2.26h3.33l-.53 3.5h-2.8V24C19.62 23.1 24 18.1 24 12.07" />
    </svg>
  );
}

/** หมุดแผนที่สีแบบ Google Maps */
export function MapPinIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path fill="#EA4335" d="M12 1.5c-4.1 0-7.5 3.3-7.5 7.4 0 5.6 7.5 13.6 7.5 13.6s7.5-8 7.5-13.6c0-4.1-3.4-7.4-7.5-7.4z" />
      <path fill="#C5221F" d="M12 1.5c4.1 0 7.5 3.3 7.5 7.4 0 5.6-7.5 13.6-7.5 13.6z" opacity=".35" />
      <circle cx="12" cy="9" r="2.9" fill="#fff" />
    </svg>
  );
}
