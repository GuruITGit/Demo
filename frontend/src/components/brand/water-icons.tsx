/**
 * ชุดไอคอนโมดูลประปา (เจนเวกเตอร์เอง) — สไตล์ duotone โมทีฟหยดน้ำ
 * currentColor → inherit สีการ์ด/เมนู · drop-in แทน lucide (รับ prop className เหมือนกัน)
 */
type P = { className?: string };
const Svg = ({ className = 'h-5 w-5', children }: P & { children: React.ReactNode }) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
    {children}
  </svg>
);

/* จดมิเตอร์ / เก็บค่าน้ำ — มิเตอร์น้ำ + หน้าปัด + หยดน้ำ */
export const MeterIcon = ({ className }: P) => (
  <Svg className={className}>
    <rect x="3" y="6.5" width="18" height="13.5" rx="3" fill="currentColor" opacity="0.15" />
    <rect x="3" y="6.5" width="18" height="13.5" rx="3" fill="none" stroke="currentColor" strokeWidth="1.7" />
    <circle cx="12" cy="13.2" r="4.1" fill="none" stroke="currentColor" strokeWidth="1.5" />
    <path d="M12 13.2L14.7 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <circle cx="12" cy="13.2" r="1" fill="currentColor" />
    <path d="M12 2.2s2 2.3 2 3.5a2 2 0 0 1-4 0c0-1.2 2-3.5 2-3.5z" fill="currentColor" />
  </Svg>
);

/* รอบบิล / รอบส่งเงิน — ปฏิทิน + หยดน้ำ */
export const RoundIcon = ({ className }: P) => (
  <Svg className={className}>
    <rect x="3.5" y="5" width="17" height="15.5" rx="3" fill="currentColor" opacity="0.15" />
    <rect x="3.5" y="5" width="17" height="15.5" rx="3" fill="none" stroke="currentColor" strokeWidth="1.7" />
    <path d="M3.5 9.5H20.5" stroke="currentColor" strokeWidth="1.7" />
    <path d="M8 3.4V6M16 3.4V6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    <path d="M12 12.6s1.7 1.9 1.7 3a1.7 1.7 0 0 1-3.4 0c0-1.1 1.7-3 1.7-3z" fill="currentColor" />
  </Svg>
);

/* รับชำระเงิน (สำนักงาน) — ใบเงิน + หยดน้ำ */
export const BillIcon = ({ className }: P) => (
  <Svg className={className}>
    <rect x="2.5" y="6" width="19" height="12" rx="2.5" fill="currentColor" opacity="0.15" />
    <rect x="2.5" y="6" width="19" height="12" rx="2.5" fill="none" stroke="currentColor" strokeWidth="1.7" />
    <path d="M12 8.6s1.8 2.1 1.8 3.3a1.8 1.8 0 0 1-3.6 0c0-1.2 1.8-3.3 1.8-3.3z" fill="currentColor" />
    <circle cx="5.6" cy="12" r="1" fill="currentColor" />
    <circle cx="18.4" cy="12" r="1" fill="currentColor" />
  </Svg>
);

/* รับชำระ (ภาคสนาม) — เหรียญ/เงินสด */
export const CoinsIcon = ({ className }: P) => (
  <Svg className={className}>
    <path d="M5 8c0-1.5 3.1-2.5 7-2.5s7 1 7 2.5-3.1 2.5-7 2.5S5 9.5 5 8z" fill="currentColor" opacity="0.15" />
    <path d="M5 8c0-1.5 3.1-2.5 7-2.5s7 1 7 2.5-3.1 2.5-7 2.5S5 9.5 5 8z" fill="none" stroke="currentColor" strokeWidth="1.6" />
    <path d="M5 8v4c0 1.5 3.1 2.5 7 2.5s7-1 7-2.5V8" fill="none" stroke="currentColor" strokeWidth="1.6" />
    <path d="M5 12v4c0 1.5 3.1 2.5 7 2.5s7-1 7-2.5v-4" fill="none" stroke="currentColor" strokeWidth="1.6" />
  </Svg>
);

/* ตรวจสลิปโอน — สลิป/ใบเสร็จ */
export const SlipIcon = ({ className }: P) => (
  <Svg className={className}>
    <path d="M6 3.5h12v17l-2-1.3-2 1.3-2-1.3-2 1.3-2-1.3-2 1.3z" fill="currentColor" opacity="0.15" />
    <path d="M6 3.5h12v17l-2-1.3-2 1.3-2-1.3-2 1.3-2-1.3-2 1.3z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    <path d="M9 8h6M9 11h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </Svg>
);

/* หนังสือแจ้งค้างชำระ — เอกสาร + เครื่องหมายเตือน */
export const NoticeIcon = ({ className }: P) => (
  <Svg className={className}>
    <path d="M6.5 3h7.5l4 4v14h-11.5z" fill="currentColor" opacity="0.15" />
    <path d="M6.5 3h7.5l4 4v14h-11.5z" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
    <path d="M14 3v4h4" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
    <path d="M12 10.5v3.4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    <circle cx="12" cy="17.3" r="1" fill="currentColor" />
  </Svg>
);

/* สรุปการเก็บค่าน้ำ — กราฟแท่ง */
export const ReportBarIcon = ({ className }: P) => (
  <Svg className={className}>
    <rect x="3" y="4" width="18" height="17" rx="3" fill="currentColor" opacity="0.15" />
    <rect x="3" y="4" width="18" height="17" rx="3" fill="none" stroke="currentColor" strokeWidth="1.7" />
    <path d="M7.5 16.5V12M12 16.5V9M16.5 16.5v-2.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
  </Svg>
);

/* รายงาน (ป.17 / ป.32) — คลิปบอร์ด + บรรทัด */
export const ReportDocIcon = ({ className }: P) => (
  <Svg className={className}>
    <rect x="4.5" y="4" width="15" height="17" rx="2.5" fill="currentColor" opacity="0.15" />
    <rect x="4.5" y="4" width="15" height="17" rx="2.5" fill="none" stroke="currentColor" strokeWidth="1.7" />
    <rect x="9" y="2.4" width="6" height="3.4" rx="1.2" fill="none" stroke="currentColor" strokeWidth="1.5" />
    <path d="M8 11h8M8 14.5h8M8 18h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </Svg>
);

/* ตรวจสอบจดมิเตอร์ (ก่อนปิดรอบ) — โล่ + ถูก */
export const VerifyMeterIcon = ({ className }: P) => (
  <Svg className={className}>
    <path d="M12 2.5l7 2.6v5.4c0 4.6-3 7.9-7 9.5-4-1.6-7-4.9-7-9.5V5.1z" fill="currentColor" opacity="0.15" />
    <path d="M12 2.5l7 2.6v5.4c0 4.6-3 7.9-7 9.5-4-1.6-7-4.9-7-9.5V5.1z" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
    <path d="M8.8 11.9l2.2 2.2 4.2-4.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

/* ตรวจสอบการชำระเงิน — คลิปบอร์ด + ถูก */
export const VerifyPayIcon = ({ className }: P) => (
  <Svg className={className}>
    <rect x="4.5" y="4" width="15" height="17" rx="2.5" fill="currentColor" opacity="0.15" />
    <rect x="4.5" y="4" width="15" height="17" rx="2.5" fill="none" stroke="currentColor" strokeWidth="1.7" />
    <rect x="9" y="2.4" width="6" height="3.4" rx="1.2" fill="none" stroke="currentColor" strokeWidth="1.5" />
    <path d="M8.3 12.8l2.2 2.2 4.6-4.7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

/* มาตรวัดน้ำที่มีปัญหา — สามเหลี่ยมเตือน */
export const IssueIcon = ({ className }: P) => (
  <Svg className={className}>
    <path d="M12 4.3l8.6 14.7H3.4z" fill="currentColor" opacity="0.15" />
    <path d="M12 4.3l8.6 14.7H3.4z" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
    <path d="M12 9.8v3.3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    <circle cx="12" cy="16.2" r="1" fill="currentColor" />
  </Svg>
);

/* ทะเบียนผู้ใช้น้ำ — บ้าน + หยดน้ำ */
export const HouseIcon = ({ className }: P) => (
  <Svg className={className}>
    <path d="M6 10.5V20h12v-9.5z" fill="currentColor" opacity="0.15" />
    <path d="M3.5 11L12 4l8.5 7" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M6 10.8V20h12v-9.2" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
    <path d="M12 12.2s1.7 1.9 1.7 3a1.7 1.7 0 0 1-3.4 0c0-1.1 1.7-3 1.7-3z" fill="currentColor" />
  </Svg>
);

/* แบบคำขอ / สัญญา — เอกสาร + ปากกา */
export const RequestIcon = ({ className }: P) => (
  <Svg className={className}>
    <path d="M7 3h7l4 4v14H7z" fill="currentColor" opacity="0.15" />
    <path d="M7 3h7l4 4v14H7z" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
    <path d="M14 3v4h4" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
    <path d="M9.5 12h5M9.5 15h3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <path d="M14.5 16.8l3.3 3.3-3.7 1 .4-3.3z" fill="currentColor" opacity="0.35" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
  </Svg>
);

/* แผนที่มาตรวัดน้ำ (GIS) — พินแผนที่ + หยดน้ำ */
export const GisIcon = ({ className }: P) => (
  <Svg className={className}>
    <path d="M12 21s7-6.3 7-11a7 7 0 0 0-14 0c0 4.7 7 11 7 11z" fill="currentColor" opacity="0.15" />
    <path d="M12 21s7-6.3 7-11a7 7 0 0 0-14 0c0 4.7 7 11 7 11z" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
    <path d="M12 6.4s2 2.3 2 3.6a2 2 0 0 1-4 0c0-1.3 2-3.6 2-3.6z" fill="currentColor" />
  </Svg>
);

/* ตั้งค่าระบบ — สไลเดอร์ */
export const SettingsIcon = ({ className }: P) => (
  <Svg className={className}>
    <path d="M4 7h7M15 7h5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    <circle cx="13" cy="7" r="2.3" fill="currentColor" opacity="0.15" />
    <circle cx="13" cy="7" r="2.3" fill="none" stroke="currentColor" strokeWidth="1.6" />
    <path d="M4 12.5h5M13 12.5h7" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    <circle cx="11" cy="12.5" r="2.3" fill="currentColor" opacity="0.15" />
    <circle cx="11" cy="12.5" r="2.3" fill="none" stroke="currentColor" strokeWidth="1.6" />
    <path d="M4 18h7M15 18h5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    <circle cx="13" cy="18" r="2.3" fill="currentColor" opacity="0.15" />
    <circle cx="13" cy="18" r="2.3" fill="none" stroke="currentColor" strokeWidth="1.6" />
  </Svg>
);

/* ข้อมูลพื้นฐาน — เลเยอร์ */
export const MasterIcon = ({ className }: P) => (
  <Svg className={className}>
    <path d="M12 3l8.5 4.2-8.5 4.2-8.5-4.2z" fill="currentColor" opacity="0.15" />
    <path d="M12 3l8.5 4.2-8.5 4.2-8.5-4.2z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    <path d="M3.5 12l8.5 4.2 8.5-4.2M3.5 16.3l8.5 4.2 8.5-4.2" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
  </Svg>
);

/* จัดการผู้ใช้ / สิทธิ์ — ผู้ใช้ + เฟือง */
export const UsersAdminIcon = ({ className }: P) => (
  <Svg className={className}>
    <circle cx="9.5" cy="8" r="3.2" fill="currentColor" opacity="0.15" />
    <circle cx="9.5" cy="8" r="3.2" fill="none" stroke="currentColor" strokeWidth="1.7" />
    <path d="M4 19c0-3 2.5-5.2 5.5-5.2 1.4 0 2.7.5 3.7 1.2" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    <circle cx="17.5" cy="16.5" r="3.4" fill="currentColor" opacity="0.15" />
    <circle cx="17.5" cy="16.5" r="3.4" fill="none" stroke="currentColor" strokeWidth="1.5" />
    <path d="M17.5 14.8v-1.1M17.5 19.3v-1.1M15.8 16.5h-1.1M20.3 16.5h-1.1" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
  </Svg>
);
