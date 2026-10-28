import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn,
  DeleteDateColumn, Index, ManyToOne, JoinColumn,
} from 'typeorm';
import { Organization } from './organization.entity';
import { WaterUser } from './water-user.entity';
import { WaterCustomer } from './water-customer.entity';

/**
 * หนังสือแจ้งเตือนค้างชำระค่าน้ำประปา — เก็บทุกฉบับที่ออกไป
 * ชื่อ/รหัส/หมู่ เก็บเป็น snapshot ไว้ในตัวหนังสือด้วย เพราะเป็นเอกสารราชการ
 * ที่ออกไปแล้ว ต้องพิมพ์ซ้ำได้เหมือนเดิมเป๊ะ แม้ภายหลังจะแก้ชื่อในทะเบียนหรือลบผู้ใช้น้ำออก
 */
@Entity('water_notices')
@Index(['organizationId', 'docNumber'], { unique: true, where: '"deleted_at" IS NULL' })
@Index(['organizationId', 'noticeDate'])
export class WaterNotice {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;

  /**
   * เลขที่หนังสือ (หัวหนังสือคือ "ที่ บร 85405/<เลขนี้>")
   * มาจากทะเบียนส่งของ อบต. เอง — เจ้าหน้าที่กรอกเอง ไม่กรอกก็ได้ (เว้นว่างในกระดาษ)
   */
  @Column({ name: 'doc_number', type: 'int', nullable: true })
  docNumber: number | null;

  /** ปี พ.ศ. ที่ใช้รันเลข — ขึ้นปีใหม่เริ่มนับ 1 ใหม่ */
  @Column({ name: 'doc_year', type: 'int' })
  docYear: number;

  /** วันที่บนหัวหนังสือ (เจ้าหน้าที่เลือกเอง ไม่ผูกกับวันที่บันทึก) */
  @Column({ name: 'notice_date', type: 'date' })
  noticeDate: string;

  @Column({ name: 'customer_id', type: 'uuid', nullable: true })
  customerId: string;

  @ManyToOne(() => WaterCustomer, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'customer_id' })
  customer: WaterCustomer;

  // ── snapshot ณ วันที่ออกหนังสือ (ห้ามอ่านจากทะเบียนตอนพิมพ์ซ้ำ) ──
  @Column({ name: 'customer_code', length: 20 })
  customerCode: string;

  @Column({ name: 'full_name', length: 200 })
  fullName: string;

  @Column({ name: 'village_no', type: 'int', nullable: true })
  villageNo: number;

  /** เดือนที่ค้างชำระ (1-12) + ปี พ.ศ. */
  @Column({ name: 'period_month', type: 'int' })
  periodMonth: number;

  @Column({ name: 'period_year', type: 'int' })
  periodYear: number;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount: string;

  /** จำนวนเงินเป็นตัวอักษร — เก็บไว้ด้วยเพื่อให้พิมพ์ซ้ำได้เหมือนเดิม แม้สูตรอ่านเงินจะถูกแก้ภายหลัง */
  @Column({ name: 'amount_text', length: 300 })
  amountText: string;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy: string;

  /** ผู้ออกหนังสือ = เจ้าหน้าที่ประปา (water_users) ไม่ใช่ users ของระบบสารบรรณ */
  @ManyToOne(() => WaterUser, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'created_by' })
  creator: WaterUser;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt: Date;
}
