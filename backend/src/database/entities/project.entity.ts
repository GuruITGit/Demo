import {
  Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn,
  CreateDateColumn, UpdateDateColumn,
} from 'typeorm';
import { Organization } from './organization.entity';
import { User } from './user.entity';
import { Department } from './department.entity';

/** เนื้อหาแบบฟอร์มโครงการราชการ 10 หัวข้อ (เก็บเป็น jsonb) */
export interface ProjectProposal {
  principle?: string;            // 1 หลักการและเหตุผล
  objectives?: string[];         // 2 วัตถุประสงค์
  targets?: string;              // 3 เป้าหมาย
  methods?: string[];            // 4 วิธีดำเนินงาน
  responsible?: string;          // 5 ผู้รับผิดชอบโครงการ
  durationLocation?: string;     // 6 ระยะเวลาและสถานที่ดำเนินงาน
  budgetText?: string;           // 7 งบประมาณ (รายละเอียด)
  expectedResults?: string[];    // 8 ผลที่คาดว่าจะได้รับ
  proposers?: { name?: string; position?: string }[];  // 9 ผู้เสนอโครงการ
  approver?: { name?: string; position?: string };      // 10 ผู้อนุมัติโครงการ
}

@Entity('projects')
export class Project {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'organization_id' })
  organizationId: string;

  @ManyToOne(() => Organization)
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;

  @Column({ name: 'project_number', length: 50 })
  projectNumber: string;

  @Column({ length: 500 })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  /** ยุทธศาสตร์/แผนงานที่สังกัด */
  @Column({ name: 'strategy', length: 300, nullable: true })
  strategy: string;

  @Column({ name: 'fiscal_year', type: 'smallint' })
  fiscalYear: number;

  @Column({ name: 'dept_id', nullable: true })
  deptId: string;

  @ManyToOne(() => Department, { nullable: true })
  @JoinColumn({ name: 'dept_id' })
  department: Department;

  @Column({ name: 'project_manager_id', nullable: true })
  projectManagerId: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'project_manager_id' })
  projectManager: User;

  @Column({ name: 'budget_amount', type: 'numeric', precision: 18, scale: 2, default: 0 })
  budgetAmount: number;

  @Column({ name: 'actual_amount', type: 'numeric', precision: 18, scale: 2, default: 0 })
  actualAmount: number;

  @Column({ name: 'target_group', length: 300, nullable: true })
  targetGroup: string;

  @Column({ name: 'expected_output', type: 'text', nullable: true })
  expectedOutput: string;

  /** เนื้อหาแบบฟอร์มโครงการราชการ 10 หัวข้อ */
  @Column({ type: 'jsonb', nullable: true })
  proposal: ProjectProposal;

  @Column({ name: 'start_date', type: 'date', nullable: true })
  startDate: Date;

  @Column({ name: 'end_date', type: 'date', nullable: true })
  endDate: Date;

  /** ความก้าวหน้า 0-100 */
  @Column({ name: 'progress_pct', type: 'smallint', default: 0 })
  progressPct: number;

  /** แผน, ดำเนินการ, เสร็จสิ้น, ยกเลิก */
  @Column({ length: 50, default: 'แผน' })
  status: string;

  @Column({ name: 'created_by', nullable: true })
  createdById: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'created_by' })
  createdBy: User;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
