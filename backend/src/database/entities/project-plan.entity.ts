import {
  Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn,
  CreateDateColumn, Index,
} from 'typeorm';
import { Project, ProjectProposal } from './project.entity';
import { User } from './user.entity';

/** ชนิดของรายการในประวัติแผนโครงการ */
export enum PlanChangeType {
  NEW_PLAN = 'แผนใหม่',
  UPDATE = 'อัปเดต',
}

/**
 * ประวัติแผน/ความคืบหน้าของโครงการ (Rework 2.0)
 * โครงการแก้ย้อนหลังไม่ได้ — ทุกการเปลี่ยนแปลงสร้างเป็นรายการใหม่ต่อท้าย
 *   planNo เพิ่มเมื่อ "เปลี่ยนแผน", revisionNo เพิ่มเมื่อ "อัปเดตความคืบหน้า" ในแผนเดิม
 */
@Entity('project_plans')
@Index('idx_project_plan_project', ['projectId'])
export class ProjectPlan {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'organization_id' })
  organizationId: string;

  @Column({ name: 'project_id' })
  projectId: string;

  @ManyToOne(() => Project, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'project_id' })
  project: Project;

  /** แผนที่ N */
  @Column({ name: 'plan_no', type: 'smallint', default: 1 })
  planNo: number;

  /** ครั้งที่อัปเดตภายในแผนเดียวกัน (0 = ตอนเปิดแผน) */
  @Column({ name: 'revision_no', type: 'smallint', default: 0 })
  revisionNo: number;

  @Column({ name: 'change_type', length: 20, default: PlanChangeType.NEW_PLAN })
  changeType: string;

  /** ชื่อ/หัวข้อแผนเวอร์ชันนี้ (ถ้ามี) */
  @Column({ length: 300, nullable: true })
  title: string;

  /** รายละเอียด / สิ่งที่เปลี่ยนแปลงจากเดิม */
  @Column({ type: 'text', nullable: true })
  description: string;

  // ── snapshot ของข้อมูลโครงการ ณ เวอร์ชันนี้ ──
  @Column({ name: 'budget_amount', type: 'numeric', precision: 18, scale: 2, default: 0 })
  budgetAmount: number;

  @Column({ name: 'actual_amount', type: 'numeric', precision: 18, scale: 2, default: 0 })
  actualAmount: number;

  @Column({ name: 'progress_pct', type: 'smallint', default: 0 })
  progressPct: number;

  @Column({ length: 50, nullable: true })
  status: string;

  @Column({ name: 'start_date', type: 'date', nullable: true })
  startDate: Date;

  @Column({ name: 'end_date', type: 'date', nullable: true })
  endDate: Date;

  /** snapshot เนื้อหาแบบฟอร์มโครงการ ณ เวอร์ชันนี้ (ใช้ diff/ไฮไลต์ส่วนที่เปลี่ยน) */
  @Column({ type: 'jsonb', nullable: true })
  proposal: ProjectProposal;

  @Column({ name: 'created_by', nullable: true })
  createdById: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'created_by' })
  createdBy: User;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
