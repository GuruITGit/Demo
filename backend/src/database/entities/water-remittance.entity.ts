import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index, ManyToOne, JoinColumn,
} from 'typeorm';
import { Organization } from './organization.entity';

/**
 * รอบส่งเงิน (นำส่งเงินประจำวัน) — บันทึกการปิดยอดเงินรับแต่ละวัน (ตัวควบคุมภายในแบบ ป.32)
 * เจ้าหน้าที่ "ปิดรอบส่งเงิน" ของวัน → snapshot จำนวนใบเสร็จ + ยอดรวมที่เก็บได้วันนั้น
 */
@Entity('water_remittance')
@Index(['organizationId', 'remitDate'], { unique: true })
export class WaterRemittance {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;

  /** วันที่ส่งเงิน (YYYY-MM-DD) */
  @Column({ name: 'remit_date', type: 'date' })
  remitDate: string;

  @Column({ name: 'bill_count', type: 'int', default: 0 })
  billCount: number;

  @Column({ name: 'total_amount', type: 'numeric', precision: 12, scale: 2, default: 0 })
  totalAmount: string;

  @Column({ type: 'text', nullable: true })
  note: string;

  @Column({ name: 'closed_by', type: 'uuid', nullable: true })
  closedBy: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
