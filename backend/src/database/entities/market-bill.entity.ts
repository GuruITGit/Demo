import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index, ManyToOne, JoinColumn,
} from 'typeorm';
import { Organization } from './organization.entity';
import { MarketStall } from './market-stall.entity';

/**
 * บิลค่าแผงตลาด (ค่าเช่า / ค่าขยะแผง) รายเดือน
 * period = ปี พ.ศ.-เดือน เช่น "2569-10" · หนึ่งล็อก+ชนิด+งวด มีได้บิลเดียว
 * status: unpaid / pending (รอตรวจสลิป) / paid / mismatch (ยอดไม่ตรง)
 */
@Entity('market_bills')
@Index(['organizationId', 'stallCode', 'kind', 'period'], { unique: true })
export class MarketBill {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;

  @Column({ name: 'stall_id', type: 'uuid', nullable: true })
  stallId: string | null;

  @ManyToOne(() => MarketStall, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'stall_id' })
  stall: MarketStall | null;

  @Column({ name: 'stall_code', type: 'varchar', length: 10 })
  stallCode: string;

  @Column({ name: 'payer_name', type: 'varchar', length: 200 })
  payerName: string;

  /** rent = ค่าเช่าแผง · waste = ค่าขยะแผง */
  @Column({ type: 'varchar', length: 10 })
  kind: string;

  @Column({ type: 'varchar', length: 7 })
  period: string;

  @Column({ type: 'numeric', precision: 10, scale: 2 })
  amount: string;

  @Column({ name: 'due_date', type: 'date', nullable: true })
  dueDate: string | null;

  @Column({ type: 'varchar', length: 12, default: 'unpaid' })
  status: string;

  /** cash = รับเงินสดที่ อบต. · qr = สแกนจ่าย · transfer = โอน (มีสลิป) */
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

  /** เลขอ้างอิงธุรกรรมของสลิปที่ตรวจผ่าน (กันสลิปซ้ำ) */
  @Column({ name: 'slip_trans_ref', type: 'varchar', length: 60, nullable: true })
  slipTransRef: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
