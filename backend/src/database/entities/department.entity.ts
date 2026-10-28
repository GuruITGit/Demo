import {
  Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany,
  JoinColumn, CreateDateColumn, UpdateDateColumn, DeleteDateColumn,
} from 'typeorm';
import { Organization } from './organization.entity';

@Entity('departments')
export class Department {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'organization_id' })
  organizationId: string;

  @ManyToOne(() => Organization)
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;

  @Column({ length: 20 })
  code: string;

  @Column({ name: 'name_th', length: 200 })
  nameTh: string;

  /** ฝ่าย/กลุ่มที่สังกัด เช่น "ฝ่ายบริหารและปลัด", "ฝ่ายสภา", "ส่วนราชการ" (ใช้จัดกลุ่มใน Tree) */
  @Column({ name: 'group_label', length: 100, nullable: true })
  groupLabel: string;

  /** ประเภทหน่วยงาน: POLITICAL (การเมือง) / COUNCIL (สภา) / ADMIN (ข้าราชการประจำ) */
  @Column({ name: 'dept_type', length: 20, default: 'ADMIN' })
  deptType: string;

  @Column({ name: 'name_en', length: 200, nullable: true })
  nameEn: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  /** อักษร/รหัสนำหน้าเลขทะเบียนของกองนี้ (ตั้งเองได้ เช่น "บร", "ปท0017.1") — ว่าง=ใช้ค่า default ตาม code */
  @Column({ name: 'doc_prefix', length: 30, nullable: true })
  docPrefix: string;

  @Column({ name: 'head_user_id', nullable: true })
  headUserId: string;

  @Column({ name: 'order_no', type: 'smallint', default: 0 })
  orderNo: number;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  /** ซ่อนกองนี้จากตัวเลือกในแบบฟอร์มต่างๆ (เช่น มอบหมายสารบรรณ) — ยังแสดงในบุคลากร/จัดการผู้ใช้ */
  @Column({ name: 'hidden_from_forms', default: false })
  hiddenFromForms: boolean;

  /** ซ่อนกองนี้จากหน้าบุคลากร (สำหรับกองที่ไม่ใช่หน่วยงานจริง เช่น กองที่พักบัญชีระบบ) */
  @Column({ name: 'hidden_from_directory', default: false })
  hiddenFromDirectory: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt: Date;
}
