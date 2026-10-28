import {
  Entity, PrimaryGeneratedColumn, Column, UpdateDateColumn, Index, ManyToOne, JoinColumn,
} from 'typeorm';
import { Organization } from './organization.entity';

/**
 * เรตค่าน้ำต่อ อบต. — ตั้งค่าได้ (ไม่ hardcode) เลียนแนวจากระบบ vendor ที่ส่ง config มา
 * v1: เรตเดียวทั้ง อบต. (ลำนางรอง = 4 บาท/หน่วย + ค่าบริการ 5 บาท, สูตร 4 ทั้งหมดตามที่ อบต.ยืนยัน)
 * ค่าขยะ/บำบัด/ประเภทผู้ใช้ ค่อยเสริมทีหลัง
 */
@Entity('water_rate')
@Index(['organizationId'], { unique: true })
export class WaterRate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;

  /** ราคาต่อหน่วย (บาท) */
  @Column({ name: 'unit_price', type: 'numeric', precision: 10, scale: 2, default: 4 })
  unitPrice: string;

  /** ค่าบริการคงที่ต่อบิล (บาท) — ลำนางรองเก็บทุกราย 5 บาท แม้ใช้ 0 หน่วย */
  @Column({ name: 'service_fee', type: 'numeric', precision: 10, scale: 2, default: 5 })
  serviceFee: string;

  /** พร้อมเพย์ปลายทางสำหรับสร้าง QR จ่ายเงิน — เบอร์/เลขบัตร ปชช./เลขผู้เสียภาษี (ว่าง = ไม่โชว์ QR) */
  @Column({ name: 'promptpay_id', type: 'varchar', length: 30, nullable: true })
  promptpayId: string;

  /** ชนิดพร้อมเพย์: mobile / natid / ewallet (default mobile) */
  @Column({ name: 'promptpay_type', type: 'varchar', length: 12, default: 'mobile' })
  promptpayType: string;

  /** ชื่อผู้รับเงินที่แสดงคู่ QR (เช่น "อบต.ลำนางรอง") */
  @Column({ name: 'payee_name', type: 'varchar', length: 120, nullable: true })
  payeeName: string;

  /**
   * Biller ID (Comp Code) ที่ อบต. ได้จากการสมัคร KTB Bill Payment กับธนาคารกรุงไทย
   * ตั้งค่านี้เมื่อไหร่ → บิลจะออก QR Bill Payment (มี Ref1/Ref2) แทนพร้อมเพย์ = กระทบยอดอัตโนมัติได้
   * เว้นว่าง = ใช้ QR พร้อมเพย์เดิม (ต้องแนบสลิปยืนยันเอง)
   */
  @Column({ name: 'ktb_biller_id', type: 'varchar', length: 20, nullable: true })
  ktbBillerId: string;

  /** ผู้ให้บริการตรวจสลิปอัตโนมัติ: 'easyslip' | 'slipok' (ว่าง = ปิด ใช้ยืนยันมือแบบเดิม) */
  @Column({ name: 'slip_verify_provider', type: 'varchar', length: 20, nullable: true })
  slipVerifyProvider: string;

  /** API token ของผู้ให้บริการตรวจสลิป (secret — ห้ามส่งกลับ frontend) */
  @Column({ name: 'slip_verify_token', type: 'varchar', length: 200, nullable: true })
  slipVerifyToken: string;

  /**
   * ผู้ให้บริการตรวจสลิปหลายเจ้า เรียงลำดับใช้งาน [{provider, token}]
   * เจ้าแรกโทเคนหมด/ล่ม → ระบบใช้เจ้าถัดไปอัตโนมัติ (secret — ห้ามส่งกลับ frontend)
   */
  @Column({ name: 'slip_verify_providers', type: 'jsonb', nullable: true })
  slipVerifyProviders: { provider: string; token: string }[];

  /** ชื่อบัญชีผู้รับเงินที่ถูกต้อง (ตามที่ขึ้นบนสลิป) — ใช้เทียบบัญชีปลายทางด้วยชื่อ */
  @Column({ name: 'slip_receiver_name', type: 'varchar', length: 200, nullable: true })
  slipReceiverName: string;

  // ── เรตแบบก้าวหน้า (tiered) ตามระบบเก่า ──
  /** โหมดคิดค่าน้ำ: 'flat' (unit_price เดียว) หรือ 'tiered' (คิดตามขั้น tiers) */
  @Column({ name: 'rate_mode', length: 12, default: 'flat' })
  rateMode: string;

  /** ขั้นค่าน้ำ [{from,to,price}] — from/to = ช่วงหน่วย, price = บาท/หน่วยในขั้นนั้น (เมื่อ rate_mode='tiered') */
  @Column({ type: 'jsonb', nullable: true })
  tiers: { from: number; to: number; price: number }[];

  /** หน่วยขั้นต่ำ + ค่าน้ำขั้นต่ำ (ใช้ต่ำกว่านี้คิดเท่าขั้นต่ำ) */
  @Column({ name: 'min_units', type: 'int', default: 0 })
  minUnits: number;

  @Column({ name: 'min_charge', type: 'numeric', precision: 10, scale: 2, default: 0 })
  minCharge: string;

  /** ค่าธรรมเนียม default (บาท) — ต่อบิล */
  @Column({ name: 'garbage_fee', type: 'numeric', precision: 10, scale: 2, default: 0 })
  garbageFee: string;

  @Column({ name: 'wastewater_fee', type: 'numeric', precision: 10, scale: 2, default: 0 })
  wastewaterFee: string;

  /** อัตราภาษี (%) */
  @Column({ name: 'tax_rate', type: 'numeric', precision: 6, scale: 3, default: 0 })
  taxRate: string;

  // ── ตั้งค่าเอกสาร/ใบเสร็จ (admin) ──
  /** ข้อความหัวใบเสร็จ/ใบแจ้งหนี้ (เช่น ที่อยู่ อบต. เบอร์โทร) */
  @Column({ name: 'receipt_header', type: 'text', nullable: true })
  receiptHeader: string;

  /** ข้อความท้ายใบเสร็จ (เช่น หมายเหตุ/ขอบคุณ) */
  @Column({ name: 'receipt_footer', type: 'text', nullable: true })
  receiptFooter: string;

  /** ชื่อเอกสารบนใบแจ้งหนี้/ใบเสร็จ (default "ใบแจ้งค่าน้ำประปา") */
  @Column({ name: 'doc_title', length: 120, nullable: true })
  docTitle: string;

  /** หัว/ท้าย "ใบแจ้งหนี้" แยกจากใบเสร็จ (ระบบเก่า TempHeader/TempFooter) — ว่าง = ใช้ receipt_header/footer */
  @Column({ name: 'invoice_header', type: 'text', nullable: true })
  invoiceHeader: string;

  @Column({ name: 'invoice_footer', type: 'text', nullable: true })
  invoiceFooter: string;

  /** ใบเสร็จ/ใบแจ้งหนี้หมดอายุหลังจากกี่วัน (ระบบเก่า billExpired = 30) */
  @Column({ name: 'bill_expiry_days', type: 'int', default: 30 })
  billExpiryDays: number;

  /** รูปลายเซ็นบนรายงาน (ป.17/ป.32) และบนใบเตือน (ระบบเก่า report_image/warning_image) — dataURL/URL */
  @Column({ name: 'report_signature_url', type: 'text', nullable: true })
  reportSignatureUrl: string;

  @Column({ name: 'warning_signature_url', type: 'text', nullable: true })
  warningSignatureUrl: string;

  /** ใบเสร็จสีฟ้า (กระดาษต่อเนื่อง) — รูปตรา + ลายเซ็นผู้รับเงิน (dataURL) และค่าเลื่อนชดเชยเครื่องพิมพ์ (มม. บวก = ขวา/ลง) */
  @Column({ name: 'receipt_seal_url', type: 'text', nullable: true })
  receiptSealUrl: string;

  @Column({ name: 'receipt_signature_url', type: 'text', nullable: true })
  receiptSignatureUrl: string;

  @Column({ name: 'receipt_offset_x', type: 'numeric', precision: 5, scale: 1, default: 0 })
  receiptOffsetX: string;

  @Column({ name: 'receipt_offset_y', type: 'numeric', precision: 5, scale: 1, default: 0 })
  receiptOffsetY: string;

  /**
   * ข้อมูลหน่วยงานเฉพาะระบบประปา (แถบบน + หัวใบเสร็จ/ใบแจ้งหนี้/ซองจดหมาย/รายงาน)
   * ว่าง = ใช้จากทะเบียนหน่วยงานหลัก (organizations) — แต่ละ อบต. ตั้งเองได้โดยไม่แตะระบบหลัก
   */
  @Column({ name: 'org_name', length: 200, nullable: true })
  orgName: string;

  @Column({ name: 'org_address', type: 'text', nullable: true })
  orgAddress: string;

  @Column({ name: 'org_phone', length: 50, nullable: true })
  orgPhone: string;

  /** โลโก้ (dataURL ที่หน้าเว็บย่อให้ ≤ 256px แล้ว) */
  @Column({ name: 'org_logo_url', type: 'text', nullable: true })
  orgLogoUrl: string;

  /**
   * หนังสือแจ้งค้างชำระ (แบบราชการ) — ส่วนที่ต่างกันทุก อบต.
   * ว่าง = เว้นช่องไว้เขียนมือ/ประกอบจากชื่อหน่วยงานให้อัตโนมัติ (ไม่มีค่า default ของ อบต. ใด อบต. หนึ่ง)
   */
  @Column({ name: 'notice_doc_prefix', length: 60, nullable: true })
  noticeDocPrefix: string;

  /** ที่อยู่บนหัวหนังสือ (แบบราชการ "อำเภอ… จังหวัด… 31260") — คนละรูปแบบกับที่อยู่บนใบเสร็จ */
  @Column({ name: 'notice_address_line', length: 200, nullable: true })
  noticeAddressLine: string;

  /** กองที่รับผิดชอบกิจการประปา (เช่น "กองช่าง") */
  @Column({ name: 'notice_division', length: 120, nullable: true })
  noticeDivision: string;

  /** ผู้ลงนาม (นายก อบต.) + ตำแหน่งใต้ลายเซ็น */
  @Column({ name: 'notice_signer_name', length: 160, nullable: true })
  noticeSignerName: string;

  @Column({ name: 'notice_signer_title', length: 200, nullable: true })
  noticeSignerTitle: string;

  /** โทร./โทรสาร ท้ายหนังสือ — ว่าง = ใช้เบอร์หน่วยงาน */
  @Column({ name: 'notice_phone', length: 50, nullable: true })
  noticePhone: string;

  /** ให้ชำระภายในกี่วันนับจากได้รับหนังสือ */
  @Column({ name: 'notice_due_days', type: 'int', default: 7 })
  noticeDueDays: number;

  /** รอบบิลปัจจุบัน (งวดที่กำลังจด/เก็บ) — ใช้เป็นค่าตั้งต้นหน้าจดมิเตอร์ · เปลี่ยนรอบ = เลื่อนเดือน */
  @Column({ name: 'current_period_year', type: 'int', nullable: true })
  currentPeriodYear: number;

  @Column({ name: 'current_period_month', type: 'int', nullable: true })
  currentPeriodMonth: number;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
