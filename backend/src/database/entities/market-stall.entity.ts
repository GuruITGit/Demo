import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index, ManyToOne, JoinColumn,
} from 'typeorm';
import { Organization } from './organization.entity';

/**
 * แผงตลาด อบต. (ผังแผงประจำ) — 1 แถวต่อ 1 ล็อก · สถานะตามผัง: ว่าง / จอง / มีผู้เช่า
 * ค่าเช่าเป็นของแต่ละแผง (ตามโซน) · ค่าขยะแผงตั้งต่อ อบต. ที่ market_rates ของ org ไม่ได้เก็บที่นี่
 */
@Entity('market_stalls')
@Index(['organizationId', 'stallCode'], { unique: true })
export class MarketStall {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;

  /** รหัสล็อก เช่น A01 (ตรงกับผังที่พิมพ์แจก) */
  @Column({ name: 'stall_code', type: 'varchar', length: 10 })
  stallCode: string;

  /** โซน/แถว เช่น A */
  @Column({ type: 'varchar', length: 10 })
  zone: string;

  /** available = ว่าง · reserved = จองรอยืนยัน · occupied = มีผู้เช่า */
  @Column({ type: 'varchar', length: 12, default: 'available' })
  status: string;

  @Column({ name: 'tenant_name', type: 'varchar', length: 200, nullable: true })
  tenantName: string | null;

  /** ค่าเช่าต่อเดือนของล็อกนี้ (บาท) */
  @Column({ name: 'monthly_rate', type: 'numeric', precision: 10, scale: 2, default: 0 })
  monthlyRate: string;

  /** เบอร์ผู้จอง (กรอกจากหน้าประชาชนตอนจองแผง) */
  @Column({ name: 'contact_phone', type: 'varchar', length: 20, nullable: true })
  contactPhone: string | null;

  @Column({ name: 'reserved_at', type: 'timestamptz', nullable: true })
  reservedAt: Date | null;

  @Column({ type: 'boolean', default: true })
  active: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
