/**
 * ตั้งค่าการรับเงินค่าแผง/ค่าขยะของแต่ละ อบต. — เก็บที่ organizations.metadata.payment (ตั้งที่หน้าเจ้าหน้าที่)
 * ห้าม hardcode บัญชี/ราคาต่อ อบต. · ค่าเริ่มต้นด้านล่างใช้เมื่อยังไม่ได้ตั้ง (promptpayId ว่าง = ซ่อน QR เหลือเงินสด)
 */
export interface PayConfig {
  promptpayId: string;
  promptpayType: 'mobile' | 'natid' | 'ewallet';
  payeeName: string;
  accountBank: string;
  accountNo: string;
  cashPlace: string;
  cashHours: string;
  /** ค่าขยะแผงต่อเดือน (บาท) */
  wasteStallFee: number;
  /** ค่าเก็บขยะบ้านต่อเดือน (บาท) */
  householdFee: number;
  /** ผู้ให้บริการตรวจสลิปอัตโนมัติ: "" = ไม่ใช้ (เจ้าหน้าที่ตรวจเอง) · slip2go · easyslip · slipok */
  slipProvider: string;
  /** โทเคนของผู้ให้บริการ (ความลับ — ห้ามส่งกลับไปหน้าประชาชน) */
  slipToken: string;
}

export const DEFAULT_PAY_CONFIG: PayConfig = {
  promptpayId: '',
  promptpayType: 'mobile',
  payeeName: '',
  accountBank: '',
  accountNo: '',
  cashPlace: 'งานการเงิน ที่ทำการ อบต.',
  cashHours: 'จันทร์–ศุกร์ 08:30–16:30 น. (เว้นวันหยุดราชการ)',
  wasteStallFee: 30,
  householdFee: 40,
  slipProvider: '',
  slipToken: '',
};

const str = (v: unknown, max: number, fallback: string) => (typeof v === 'string' ? v.trim().slice(0, max) : fallback);
const fee = (v: unknown, fallback: number) => (Number.isFinite(Number(v)) && Number(v) >= 0 ? Math.round(Number(v) * 100) / 100 : fallback);

/** อ่านค่าจาก metadata.payment แบบ defensive — ใช้ทั้งตอนอ่านและตอนบันทึก (sanitize) */
export function readPayConfig(meta: any): PayConfig {
  const p = meta?.payment || {};
  const d = DEFAULT_PAY_CONFIG;
  return {
    promptpayId: str(p.promptpayId, 20, d.promptpayId).replace(/[^0-9]/g, ''),
    promptpayType: ['mobile', 'natid', 'ewallet'].includes(p.promptpayType) ? p.promptpayType : d.promptpayType,
    payeeName: str(p.payeeName, 120, d.payeeName),
    accountBank: str(p.accountBank, 60, d.accountBank),
    accountNo: str(p.accountNo, 30, d.accountNo),
    cashPlace: str(p.cashPlace, 120, d.cashPlace),
    cashHours: str(p.cashHours, 120, d.cashHours),
    wasteStallFee: fee(p.wasteStallFee, d.wasteStallFee),
    householdFee: fee(p.householdFee, d.householdFee),
    slipProvider: ['', 'slip2go', 'easyslip', 'slipok'].includes(p.slipProvider) ? p.slipProvider : d.slipProvider,
    slipToken: str(p.slipToken, 300, d.slipToken),
  };
}
