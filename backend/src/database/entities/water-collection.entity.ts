import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn,
  Index, ManyToOne, JoinColumn,
} from 'typeorm';
import { Organization } from './organization.entity';

/**
 * สรุปการเก็บค่าน้ำ — ตัวเลขจัดเก็บต่อ "งวด (เดือน/ปี พ.ศ.) × หมู่"
 *
 * อบต. มีระบบเก็บเงินของ vendor อยู่แล้ว (ที่ไม่ยอมเชื่อมข้อมูลให้) — หน้านี้จึงเป็น
 * "ป้อนตัวเลขสรุปเอง" (จากรายงาน ป.32/Excel ของระบบเดิม) เพื่อทำ dashboard ภาพรวม
 * ค่อยเป็นค่อยไป (ทิศ C) — ไม่ผูกกับบิลรายตัว เก็บแค่ยอดรวมพอทำกราฟ/เทียบหมู่ได้
 *
 * ค้างชำระ = billed − collected (คำนวณตอนแสดง ไม่เก็บซ้ำ)
 */
@Entity('water_collection_summary')
@Index(['organizationId', 'periodYear', 'periodMonth', 'villageNo'], { unique: true })
export class WaterCollectionSummary {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;

  /** ปี พ.ศ. ของงวด */
  @Column({ name: 'period_year', type: 'int' })
  periodYear: number;

  /** เดือนของงวด (1–12) */
  @Column({ name: 'period_month', type: 'int' })
  periodMonth: number;

  /** หมู่ที่ */
  @Column({ name: 'village_no', type: 'int' })
  villageNo: number;

  /** จำนวนผู้ใช้น้ำที่ออกบิลในงวด/หมู่นี้ */
  @Column({ type: 'int', default: 0 })
  customers: number;

  /** ยอดที่ออกบิลรวม (บาท) */
  @Column({ name: 'billed_amount', type: 'numeric', precision: 14, scale: 2, default: 0 })
  billedAmount: string;

  /** ยอดที่เก็บได้จริง (บาท) */
  @Column({ name: 'collected_amount', type: 'numeric', precision: 14, scale: 2, default: 0 })
  collectedAmount: string;

  /** หน่วยน้ำที่ใช้รวม (ถ้ามี — ไม่บังคับ) */
  @Column({ type: 'int', nullable: true })
  units: number;

  @Column({ type: 'text', nullable: true })
  note: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
