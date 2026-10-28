import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn,
  DeleteDateColumn, Index, ManyToOne, JoinColumn,
} from 'typeorm';
import { Organization } from './organization.entity';

/**
 * ทะเบียนผู้ใช้น้ำ — เก็บเท่าที่ต้องใช้กรอกหนังสือแจ้งค้างชำระเท่านั้น
 * (รหัส / ชื่อ / หมู่) ไม่มีมิเตอร์-อัตรา-บิล เพราะงานเก็บค่าน้ำ อบต. ใช้ระบบเดิมของเขาอยู่แล้ว
 * ข้อมูลตั้งต้นนำเข้าจากบัญชีรายตัวลูกหนี้ (PDF) 2,059 ราย — เจ้าหน้าที่แก้/เพิ่ม/ลบเองได้
 */
@Entity('water_customers')
@Index(['organizationId', 'customerCode'], { unique: true, where: '"deleted_at" IS NULL' })
@Index(['organizationId', 'accessToken'], { unique: true, where: '"deleted_at" IS NULL' })
@Index(['organizationId', 'villageNo'])
export class WaterCustomer {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;

  /** รหัสผู้ใช้น้ำ 5 หลัก เรียงต่อกันทั้งตำบล ไม่แยกตามหมู่ (เช่น "00169") */
  @Column({ name: 'customer_code', length: 20 })
  customerCode: string;

  /** รหัสเข้าถึงสาธารณะ 6 หลัก (สุ่ม) — พิมพ์/ทำ QR บนใบแจ้งหนี้ ให้เข้าหน้าเช็ค/จ่ายค่าน้ำได้โดยไม่ต้องกรอกชื่อ+บ้าน */
  @Column({ name: 'access_token', length: 10, nullable: true })
  accessToken: string;

  @Column({ name: 'full_name', length: 200 })
  fullName: string;

  /** หมู่ที่ — ตำบลนี้มี 13 หมู่ (ไม่มีหมู่ 3) */
  @Column({ name: 'village_no', type: 'int', nullable: true })
  villageNo: number;

  /** เบอร์โทร — ใช้ผูกให้สมาชิกล็อกอินพอร์ทัลเช็คค่าน้ำเองได้ (กรอกตอนจดมิเตอร์ได้) */
  @Column({ type: 'varchar', length: 20, nullable: true })
  @Index()
  phone: string;

  /** ที่อยู่/บ้านเลขที่ — แสดงบนใบแจ้งหนี้/ใบเสร็จและพอร์ทัลสมาชิก */
  @Column({ type: 'varchar', length: 255, nullable: true })
  address: string;

  @Column({ type: 'text', nullable: true })
  note: string;

  // ── ฟิลด์เต็มตามระบบเก่า (parity) ──
  @Column({ name: 'national_id', length: 20, nullable: true })
  nationalId: string;

  @Column({ length: 100, nullable: true })
  soi: string;

  @Column({ length: 100, nullable: true })
  road: string;

  /** เลขมิเตอร์ล่าสุด (ยกไปเป็นเลขครั้งก่อนของบิลถัดไป) */
  @Column({ name: 'meter_last_reading', type: 'int', nullable: true })
  meterLastReading: number;

  @Column({ name: 'meter_size_code', length: 10, nullable: true })
  meterSizeCode: string;

  @Column({ name: 'meter_digits', type: 'int', nullable: true })
  meterDigits: number;

  @Column({ name: 'meter_serial', length: 60, nullable: true })
  meterSerial: string;

  /** อัตราค่าธรรมเนียมใช้น้ำ/ค่าบริการต่อราย (บาท) */
  @Column({ name: 'fee_rate', type: 'numeric', precision: 10, scale: 2, nullable: true })
  feeRate: string;

  /** ประเภท/สูตรค่าน้ำที่ใช้ */
  @Column({ name: 'rate_type', length: 20, nullable: true })
  rateType: string;

  /**
   * ราคาต่อหน่วยเฉพาะราย (บาท) — ทับเรตกลางของ อบต. เฉพาะคนที่กำหนดไว้
   * null = ใช้เรตกลาง (water_rate.unit_price) · ระบบเก่าเก็บใน M12
   * (อบต.ลำนางรองทยอยขึ้น 3฿→4฿ ทีละคน คนที่ยังไม่ขึ้นถึงจะมีค่านี้)
   */
  @Column({ name: 'unit_price', type: 'numeric', precision: 10, scale: 2, nullable: true })
  unitPrice: string;

  @Column({ name: 'collection_route', length: 20, nullable: true })
  collectionRoute: string;

  /** ลำดับการเดินจดมิเตอร์ในหมู่ (อบต.กำหนดเอง) — เรียงหน้าจดตามนี้ */
  @Column({ name: 'walk_order', type: 'int', nullable: true })
  walkOrder: number;

  @Column({ name: 'apply_date', type: 'date', nullable: true })
  applyDate: string;

  @Column({ name: 'garbage_fee', type: 'numeric', precision: 10, scale: 2, nullable: true })
  garbageFee: string;

  @Column({ name: 'wastewater_fee', type: 'numeric', precision: 10, scale: 2, nullable: true })
  wastewaterFee: string;

  @Column({ name: 'pay_method', length: 20, nullable: true })
  payMethod: string;

  @Column({ name: 'bank_account', length: 40, nullable: true })
  bankAccount: string;

  @Column({ name: 'bank_name', length: 120, nullable: true })
  bankName: string;

  @Column({ name: 'bank_branch', length: 120, nullable: true })
  bankBranch: string;

  @Column({ name: 'discount_type', length: 20, nullable: true })
  discountType: string;

  @Column({ name: 'discount_amount', type: 'numeric', precision: 10, scale: 2, nullable: true })
  discountAmount: string;

  @Column({ name: 'want_vat', type: 'boolean', default: false })
  wantVat: boolean;

  /** สถานะการใช้งาน (สมาชิก/ยกเลิก/งดจ่าย) — code จากระบบเก่า */
  @Column({ name: 'usage_status', length: 20, nullable: true })
  usageStatus: string;

  /** พิกัด GPS "lat,lng" */
  @Column({ length: 60, nullable: true })
  gps: string;

  /** แจ้งปัญหามิเตอร์ (array code) */
  @Column({ type: 'jsonb', nullable: true })
  issues: any;

  @Column({ name: 'cutoff_date', type: 'date', nullable: true })
  cutoffDate: string;

  /** record ดิบจากระบบเก่า (M01-M32 ครบ) — เก็บไว้กัน mapping ผิด */
  @Column({ type: 'jsonb', nullable: true })
  legacy: any;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt: Date;
}
