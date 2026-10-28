import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index, ManyToOne, JoinColumn,
} from 'typeorm';
import { Organization } from './organization.entity';

/**
 * บัญชีผู้ใช้ของ "ระบบประปา" — แยกขาดจาก users (สารบรรณ/ระบบหลัก) โดยสิ้นเชิง
 * login/สิทธิ์/แอดมิน ของประปาเป็นของตัวเอง ไม่เกี่ยวกับบัญชีสารบรรณ
 * สิทธิ์ = role สำเร็จรูป (preset) + caps ปรับรายคนได้ (jsonb ของ capability key ต่อโมดูล)
 */
export type WaterRole = 'admin' | 'reader' | 'cashier' | 'viewer';

/** capability ต่อโมดูลประปา — เก็บใน caps[] · admin = ทุกอัน */
export const WATER_CAPS = ['reading', 'payment', 'slips', 'notices', 'reports', 'customers', 'settings', 'users'] as const;
export type WaterCap = typeof WATER_CAPS[number];

/** ชุดสิทธิ์ตาม role สำเร็จรูป (แอดมินปรับรายคนทับได้) */
export const ROLE_CAPS: Record<WaterRole, WaterCap[]> = {
  admin: [...WATER_CAPS],
  reader: ['reading', 'payment'],                                  // เจ้าหน้าที่จด (จด+เก็บภาคสนาม)
  cashier: ['payment', 'slips', 'notices', 'reports', 'customers'], // เก็บเงินสำนักงาน
  viewer: ['reports'],                                             // ดูรายงานอย่างเดียว
};

@Entity('water_users')
@Index(['organizationId', 'username'], { unique: true })
export class WaterUser {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;

  @Column({ length: 60 })
  username: string;

  @Column({ name: 'password_hash', type: 'text' })
  passwordHash: string;

  @Column({ name: 'full_name', length: 200 })
  fullName: string;

  @Column({ length: 30, nullable: true })
  phone: string;

  @Column({ length: 12, default: 'reader' })
  role: WaterRole;

  /** capability ที่ใช้จริง (jsonb) — ตั้งต้นจาก role แล้วแอดมินปรับได้ */
  @Column({ type: 'jsonb', default: () => `'[]'` })
  caps: WaterCap[];

  @Column({ default: true })
  active: boolean;

  @Column({ name: 'last_login_at', type: 'timestamptz', nullable: true })
  lastLoginAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
