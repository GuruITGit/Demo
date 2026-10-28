import {
  Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn,
  CreateDateColumn, UpdateDateColumn, DeleteDateColumn, Unique,
} from 'typeorm';
import { Organization } from './organization.entity';
import { Department } from './department.entity';
import { Division } from './division.entity';

// username/email ไม่ซ้ำ "ต่อหน่วยงาน" (ไม่ใช่ทั้งระบบ) — แต่ละ อบต. ตั้งชื่อ admin ของตัวเองได้ (multi-tenant)
@Entity('users')
@Unique('UQ_users_org_username', ['organizationId', 'username'])
@Unique('UQ_users_org_email', ['organizationId', 'email'])
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'organization_id' })
  organizationId: string;

  @ManyToOne(() => Organization)
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;

  @Column({ name: 'employee_id', nullable: true })
  employeeId: string;

  @Column({ length: 100 })
  username: string;

  @Column({ length: 200 })
  email: string;

  @Column({ length: 20, nullable: true })
  phone: string;

  // select:false — กัน hash หลุดไปกับทุก query/relation (จุดที่ต้องใช้จริงให้ addSelect เอง เช่น login)
  @Column({ name: 'password_hash', length: 255, select: false })
  passwordHash: string;

  @Column({ name: 'full_name_th', length: 200 })
  fullNameTh: string;

  @Column({ name: 'full_name_en', length: 200, nullable: true })
  fullNameEn: string;

  @Column({ name: 'title_th', length: 50, nullable: true })
  titleTh: string;

  @Column({ length: 20, nullable: true })
  prefix: string;

  @Column({ name: 'avatar_url', length: 500, nullable: true })
  avatarUrl: string;

  @Column({ name: 'department_id', nullable: true })
  departmentId: string;

  @ManyToOne(() => Department)
  @JoinColumn({ name: 'department_id' })
  department: Department;

  @Column({ name: 'division_id', nullable: true })
  divisionId: string;

  @ManyToOne(() => Division)
  @JoinColumn({ name: 'division_id' })
  division: Division;

  @Column({ name: 'position_name', length: 200, nullable: true })
  positionName: string;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @Column({ name: 'is_verified', default: false })
  isVerified: boolean;

  @Column({ name: 'is_2fa_enabled', default: false })
  is2faEnabled: boolean;

  @Column({ name: 'two_fa_secret', length: 255, nullable: true, select: false })
  twoFaSecret: string;

  @Column({ name: 'failed_login_count', type: 'smallint', default: 0 })
  failedLoginCount: number;

  @Column({ name: 'locked_until', type: 'timestamptz', nullable: true })
  lockedUntil: Date;

  @Column({ name: 'password_changed_at', type: 'timestamptz', nullable: true })
  passwordChangedAt: Date;

  @Column({ name: 'last_login_at', type: 'timestamptz', nullable: true })
  lastLoginAt: Date;

  @Column({ name: 'last_login_ip', type: 'inet', nullable: true })
  lastLoginIp: string;

  @Column({ name: 'line_user_id', length: 100, nullable: true })
  lineUserId: string;

  @Column({ name: 'line_notify_token', length: 255, nullable: true, select: false })
  lineNotifyToken: string;

  @Column({ type: 'jsonb', default: '{}' })
  metadata: Record<string, any>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt: Date;

  @Column({ name: 'created_by', nullable: true })
  createdBy: string;
}
