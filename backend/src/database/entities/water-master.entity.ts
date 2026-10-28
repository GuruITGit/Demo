import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index, ManyToOne, JoinColumn,
} from 'typeorm';
import { Organization } from './organization.entity';

/**
 * ข้อมูลพื้นฐาน (master/lookup) ของกองการประปา — ตารางเดียวครอบทุกประเภท (type)
 * แทนตารางแยกในระบบเก่า: พื้นที่/หมู่ · เส้นทาง · วิธีชำระเงิน · ผู้ได้รับสิทธิ(ส่วนลด) ·
 * ขนาดมิเตอร์(ค่าธรรมเนียม) · ประเภทผู้ใช้(สูตรค่าน้ำ) · สถานะการใช้งาน
 * value = ตัวเลขประกอบ (ค่าธรรมเนียม/ส่วนลด) · config = jsonb (สูตรก้าวหน้า ฯลฯ)
 */
export type WaterMasterType = 'area' | 'route' | 'payment_channel' | 'discount' | 'meter_size' | 'user_type' | 'usage_status';

@Entity('water_master')
@Index(['organizationId', 'type'])
export class WaterMaster {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;

  /** ประเภท master */
  @Column({ length: 20 })
  type: WaterMasterType;

  /** รหัส (เช่น "01") */
  @Column({ length: 20, nullable: true })
  code: string;

  /** ชื่อ/คำอธิบาย */
  @Column({ length: 200 })
  name: string;

  /** ค่าตัวเลขประกอบ — ค่าธรรมเนียม(ขนาดมิเตอร์) / จำนวน-เปอร์เซ็นต์ส่วนลด / ราคาต่อหน่วย(ประเภทผู้ใช้) */
  @Column({ type: 'numeric', precision: 12, scale: 2, nullable: true })
  value: string;

  /** config เพิ่มเติม (jsonb) — เช่น สูตรก้าวหน้า tiers, ชนิดส่วนลด */
  @Column({ type: 'jsonb', nullable: true })
  config: any;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;

  @Column({ type: 'boolean', default: true })
  active: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
