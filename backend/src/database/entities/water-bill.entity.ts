import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn,
  Index, ManyToOne, JoinColumn,
} from 'typeorm';
import { Organization } from './organization.entity';
import { WaterCustomer } from './water-customer.entity';

/**
 * บิลค่าน้ำ 1 ใบ = การจดมิเตอร์ + คิดเงิน + สถานะชำระ (รวมแถวเดียวเพื่อความเรียบง่าย v1)
 * 1 แถว ต่อ ผู้ใช้น้ำ × งวด(เดือน/ปี) — จดแล้วคิดเงินอัตโนมัติจากเรต แล้วรับชำระ
 *
 * เลียนโมเดลจากระบบ vendor (จด prev/curr → units → บิล → payment) แต่ทำเป็น multi-tenant
 * ตารางเดียว/DB เดียว (orgId) — ไม่แยก droplet/ไม่ rebuild ต่อ อบต.
 */
export type WaterBillStatus = 'unpaid' | 'paid' | 'cancelled';
/** ปัญหามาตรตอนจด (จากที่พบในแอป vendor) */
export type WaterMeterIssue = 'normal' | 'broken' | 'leak' | 'unreadable' | 'blocked' | 'other';

@Entity('water_bills_v2')
@Index(['organizationId', 'customerId', 'periodYear', 'periodMonth'], { unique: true })
@Index(['organizationId', 'periodYear', 'periodMonth', 'villageNo'])
@Index(['organizationId', 'status'])
export class WaterBill {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;

  @Column({ name: 'customer_id', type: 'uuid' })
  customerId: string;

  @ManyToOne(() => WaterCustomer, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'customer_id' })
  customer: WaterCustomer;

  // snapshot ข้อมูลผู้ใช้ ณ ตอนออกบิล (พิมพ์ซ้ำได้ไม่เปลี่ยนแม้แก้ทะเบียนภายหลัง)
  @Column({ name: 'customer_code', length: 20 })
  customerCode: string;

  @Column({ name: 'full_name', length: 200 })
  fullName: string;

  @Column({ name: 'village_no', type: 'int', nullable: true })
  villageNo: number;

  @Column({ name: 'period_year', type: 'int' })
  periodYear: number;

  @Column({ name: 'period_month', type: 'int' })
  periodMonth: number;

  // ── การจดมิเตอร์
  @Column({ name: 'prev_reading', type: 'int', default: 0 })
  prevReading: number;

  @Column({ name: 'curr_reading', type: 'int', default: 0 })
  currReading: number;

  @Column({ type: 'int', default: 0 })
  units: number;

  @Column({ name: 'read_at', type: 'timestamptz', nullable: true })
  readAt: Date;

  @Column({ name: 'read_by', type: 'uuid', nullable: true })
  readBy: string;

  @Column({ name: 'issue_type', type: 'varchar', length: 20, default: 'normal' })
  issueType: WaterMeterIssue;

  @Column({ type: 'text', nullable: true })
  note: string;

  // ── คิดเงิน (snapshot เรตในตัวบิล)
  @Column({ name: 'unit_price', type: 'numeric', precision: 10, scale: 2, default: 0 })
  unitPrice: string;

  @Column({ name: 'water_amount', type: 'numeric', precision: 12, scale: 2, default: 0 })
  waterAmount: string;

  @Column({ name: 'service_fee', type: 'numeric', precision: 10, scale: 2, default: 0 })
  serviceFee: string;

  @Column({ name: 'total_amount', type: 'numeric', precision: 12, scale: 2, default: 0 })
  totalAmount: string;

  // ── การชำระ
  @Column({ type: 'varchar', length: 12, default: 'unpaid' })
  status: WaterBillStatus;

  @Column({ name: 'paid_at', type: 'timestamptz', nullable: true })
  paidAt: Date;

  @Column({ name: 'paid_amount', type: 'numeric', precision: 12, scale: 2, nullable: true })
  paidAmount: string;

  @Column({ name: 'received_by', type: 'uuid', nullable: true })
  receivedBy: string;

  @Column({ name: 'receipt_no', length: 40, nullable: true })
  receiptNo: string;

  /** ช่องทางชำระ: cash / qr / transfer */
  @Column({ name: 'pay_method', type: 'varchar', length: 12, nullable: true })
  payMethod: string;

  // ── สลิปโอนเงินฝั่งประชาชน (จ่าย QR แล้วแนบหลักฐาน → เจ้าหน้าที่ตรวจ→ยืนยัน)
  @Column({ name: 'slip_url', type: 'text', nullable: true })
  slipUrl: string;

  /** none / pending(รอตรวจ) / confirmed(ยืนยันแล้ว) / rejected(ปฏิเสธ) */
  @Column({ name: 'slip_status', type: 'varchar', length: 12, default: 'none' })
  slipStatus: string;

  @Column({ name: 'slip_uploaded_at', type: 'timestamptz', nullable: true })
  slipUploadedAt: Date;

  /** เหตุผลที่ปฏิเสธสลิป (แสดงให้ประชาชนแก้) */
  @Column({ name: 'slip_note', type: 'text', nullable: true })
  slipNote: string;

  /** เลขอ้างอิงธุรกรรมจากสลิป (ตรวจกับธนาคารแล้ว) — ใช้กันสลิปซ้ำ */
  @Column({ name: 'slip_trans_ref', type: 'varchar', length: 80, nullable: true })
  slipTransRef: string;

  /** ยอดเงินที่อ่านได้จากสลิป (ตรวจกับธนาคาร) */
  @Column({ name: 'slip_amount', type: 'numeric', precision: 12, scale: 2, nullable: true })
  slipAmount: string;

  @Column({ name: 'slip_verified_at', type: 'timestamptz', nullable: true })
  slipVerifiedAt: Date;

  /** รายชื่อบิลพี่น้องที่จ่ายรวมกันด้วยสลิปใบเดียว (จ่ายหลายบิล+QR รวม) — null ถ้าเป็นบิลเดี่ยว */
  @Column({ name: 'slip_group_bill_ids', type: 'jsonb', nullable: true })
  slipGroupBillIds: string[] | null;

  // ── ฟิลด์เต็มตามระบบเก่า (parity) ──
  /** รอบบิลรูประบบเก่า เช่น "69-010" (ปีงบ-เดือน) */
  @Column({ name: 'period_round', length: 10, nullable: true })
  periodRound: string;

  @Column({ name: 'bill_no', length: 40, nullable: true })
  billNo: string;

  /** ชื่อผู้จดมิเตอร์ (จากระบบเก่า) */
  @Column({ name: 'reader_name', length: 200, nullable: true })
  readerName: string;

  @Column({ name: 'prev_read_at', type: 'timestamptz', nullable: true })
  prevReadAt: Date;

  @Column({ name: 'curr_read_at', type: 'timestamptz', nullable: true })
  currReadAt: Date;

  @Column({ name: 'wastewater_fee', type: 'numeric', precision: 12, scale: 2, default: 0 })
  wastewaterFee: string;

  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0 })
  tax: string;

  @Column({ name: 'garbage_fee', type: 'numeric', precision: 12, scale: 2, default: 0 })
  garbageFee: string;

  /** รูปลายเซ็นรับทราบของผู้ใช้น้ำ (เซ็นบนจอตอนจด/รับชำระ) */
  @Column({ name: 'ack_signature_url', type: 'text', nullable: true })
  ackSignatureUrl: string;

  /** รูปมาตรวัดน้ำ (หลักฐานการจด — ถ่ายตอนจด) */
  @Column({ name: 'meter_photo_url', type: 'text', nullable: true })
  meterPhotoUrl: string;

  @Column({ length: 60, nullable: true })
  gps: string;

  /** record ดิบจากระบบเก่า (B01-B24, BA/BP/BU) */
  @Column({ type: 'jsonb', nullable: true })
  legacy: any;

  /** ประวัติการแก้เลขมิเตอร์ของบิลนี้ (สตง.ตรวจได้ว่าใครแก้ เมื่อไหร่) — [{by,at,prev,curr}] */
  @Column({ name: 'edit_history', type: 'jsonb', nullable: true })
  editHistory: { by?: string; at: string; prevReading: number; currReading: number }[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
