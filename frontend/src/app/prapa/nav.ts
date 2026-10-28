import { Printer } from 'lucide-react';
import type { IllusName } from '@/components/brand/water-illus';
import {
  MeterIcon, RoundIcon, BillIcon, SlipIcon, NoticeIcon,
  ReportBarIcon, ReportDocIcon, VerifyMeterIcon, VerifyPayIcon, IssueIcon,
  HouseIcon, RequestIcon, GisIcon, SettingsIcon, MasterIcon, UsersAdminIcon,
} from '@/components/brand/water-icons';

/**
 * เมนูระบบประปา — แหล่งเดียว ใช้ทั้ง sidebar (prapa-shell) และปุ่มเมนูหน้าหลัก (/prapa)
 * caps = เห็นเมนูเมื่อมีสิทธิ์อย่างน้อยหนึ่งตัว (แอดมินเห็นหมด)
 */
/** illus/desc = รูปและคำอธิบายบนการ์ดเมนูหน้าหลัก */
export type PrapaNavItem = { href: string; label: string; icon: any; caps: string[]; illus: IllusName; desc: string };
export const PRAPA_NAV: { group: string; items: PrapaNavItem[] }[] = [
  {
    group: 'งานประจำ',
    items: [
      { href: '/prapa/reading', illus: 'meter', desc: 'จดเลข · คิดเงิน · พิมพ์ใบแจ้งหนี้', label: 'จดมิเตอร์ / เก็บค่าน้ำ', icon: MeterIcon, caps: ['reading'] },
      { href: '/prapa/round', illus: 'calendar', desc: 'เปิด/ปิดรอบ · ส่งเงินรายวัน', label: 'รอบบิล / รอบส่งเงิน', icon: RoundIcon, caps: ['reading', 'settings', 'payment'] },
      { href: '/prapa/cashier', illus: 'pay', desc: 'เลือกหลายบิลค้าง → รับทีเดียว', label: 'รับชำระเงิน', icon: BillIcon, caps: ['payment'] },
      { href: '/prapa/slips', illus: 'slip', desc: 'ยืนยันการจ่าย QR ของประชาชน', label: 'ตรวจสลิปโอน', icon: SlipIcon, caps: ['slips'] },
      { href: '/prapa/reconcile', illus: 'bank', desc: 'เทียบรายการโอนกับบิล', label: 'กระทบยอดจากธนาคาร', icon: BillIcon, caps: ['payment'] },
      { href: '/prapa/notices', illus: 'notice', desc: 'ออกหนังสือราชการ · พิมพ์', label: 'หนังสือแจ้งค้างชำระ', icon: NoticeIcon, caps: ['notices'] },
    ],
  },
  {
    group: 'รายงาน',
    items: [
      { href: '/prapa/dashboard', illus: 'report', desc: 'ยอดจัดเก็บ · แยกหมู่ · ย้อนหลัง', label: 'สรุปการเก็บค่าน้ำ', icon: ReportBarIcon, caps: ['reports'] },
      { href: '/prapa/report', illus: 'ledger', desc: 'ป.17 · ป.32 · การใช้น้ำ', label: 'รายงาน (ป.17 / ป.32 / ใช้น้ำ)', icon: ReportDocIcon, caps: ['reports'] },
      { href: '/prapa/verify', illus: 'verifymeter', desc: 'ตรวจเลขผิดปกติก่อนปิดรอบ', label: 'ตรวจสอบจดมิเตอร์ (ก่อนปิดรอบ)', icon: VerifyMeterIcon, caps: ['reports', 'reading'] },
      { href: '/prapa/check', illus: 'verifypay', desc: 'ค้นประวัติ · เลขใบเสร็จ · ช่วงวัน', label: 'ตรวจสอบการชำระเงิน', icon: VerifyPayIcon, caps: ['reports', 'payment'] },
      { href: '/prapa/issues', illus: 'issue', desc: 'มาตรชำรุด · รั่ว · มองไม่เห็น', label: 'มาตรวัดน้ำที่มีปัญหา', icon: IssueIcon, caps: ['reports', 'reading'] },
    ],
  },
  {
    group: 'ทะเบียน & แผนที่',
    items: [
      { href: '/prapa/customers', illus: 'cust', desc: 'ค้นหา · เพิ่ม · แก้ไข · เบอร์โทร', label: 'ทะเบียนผู้ใช้น้ำ', icon: HouseIcon, caps: ['customers'] },
      { href: '/prapa/request', illus: 'request', desc: 'กรอกคำขอ · พิมพ์สัญญา', label: 'แบบคำขอ / สัญญา', icon: RequestIcon, caps: ['customers'] },
      { href: '/prapa/map', illus: 'gis', desc: 'จุดพิกัดมาตร · นำทาง', label: 'แผนที่มาตรวัดน้ำ (GIS)', icon: GisIcon, caps: ['customers', 'reports'] },
    ],
  },
  {
    group: 'ตั้งค่า',
    items: [
      { href: '/prapa/rate', illus: 'settings', desc: 'เรต · ค่าธรรมเนียม · พร้อมเพย์', label: 'ตั้งค่าระบบ', icon: SettingsIcon, caps: ['settings'] },
      { href: '/prapa/printer', illus: 'printer', desc: 'เครื่องพิมพ์ความร้อน PT-210', label: 'ตั้งค่าเครื่องพิมพ์', icon: Printer, caps: ['reading', 'payment', 'settings'] },
      { href: '/prapa/master', illus: 'layers', desc: 'หมู่ · เส้นทาง · ประเภทผู้ใช้', label: 'ข้อมูลพื้นฐาน', icon: MasterIcon, caps: ['settings'] },
      { href: '/prapa/admin', illus: 'admin', desc: 'บัญชีเจ้าหน้าที่ · สิทธิ์ · อัปเดตข้อมูล', label: 'จัดการผู้ใช้ / สิทธิ์', icon: UsersAdminIcon, caps: ['users'] },
    ],
  },
];

