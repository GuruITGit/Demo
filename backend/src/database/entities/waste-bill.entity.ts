import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index, ManyToOne, JoinColumn,
} from 'typeorm';
import { Organization } from './organization.entity';

/**
 * บิลค่าเก็บขยะบ้าน (ครัวเรือน) รายงวด · ค้นหาด้วยบ้านเลขที่+หมู่ / ชื่อ / เบอร์โทร
 * period = ปี พ.ศ.-เดือน เช่น "2569-10" · หนึ่งครัวเรือน+งวดมีได้บิลเดียว
 */
@Entity('waste_bills')
@Index(['organizationId', 'householdRef', 'period'], { unique: true })
export class WasteBill {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;

  /** รหัสครัวเรือน เช่น HH-014 */
  @Column({ name: 'household_ref', type: 'varchar', length: 20 })
  householdRef: string;

  @Column({ name: 'holder_name', type: 'varchar', length: 200 })
  holderName: string;

  @Column({ name: 'house_no', type: 'varchar', length: 20 })
  houseNo: string;

  @Column({ type: 'varchar', length: 5 })
  moo: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  phone: string | null;

  @Column({ type: 'varchar', length: 7 })
  period: string;

  @Column({ type: 'numeric', precision: 10, scale: 2 })
  amount: string;

  @Column({ name: 'due_date', type: 'date', nullable: true })
  dueDate: string | null;

  @Column({ type: 'varchar', length: 12, default: 'unpaid' })
  status: string;

  @Column({ name: 'paid_method', type: 'varchar', length: 12, nullable: true })
  paidMethod: string | null;

  @Column({ name: 'paid_at', type: 'timestamptz', nullable: true })
  paidAt: Date | null;

  @Column({ name: 'receipt_no', type: 'varchar', length: 30, nullable: true })
  receiptNo: string | null;

  /** ประชาชนแจ้งชำระเอง: รูปสลิป / วิธีที่แจ้ง (transfer | cash) / เวลาแจ้ง / หมายเหตุจากเจ้าหน้าที่ตอนไม่รับ */
  @Column({ name: 'slip_url', type: 'text', nullable: true })
  slipUrl: string | null;

  @Column({ name: 'submitted_method', type: 'varchar', length: 12, nullable: true })
  submittedMethod: string | null;

  @Column({ name: 'submitted_at', type: 'timestamptz', nullable: true })
  submittedAt: Date | null;

  @Column({ name: 'review_note', type: 'varchar', length: 300, nullable: true })
  reviewNote: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
