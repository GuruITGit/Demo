import {
  Entity, PrimaryGeneratedColumn, Column, ManyToOne,
  JoinColumn, CreateDateColumn,
} from 'typeorm';
import { Department } from './department.entity';

@Entity('complaint_categories')
export class ComplaintCategory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'organization_id', nullable: true })
  organizationId: string;

  @Column({ length: 50 })
  code: string;

  @Column({ name: 'name_th', length: 200 })
  nameTh: string;

  @Column({ length: 50, nullable: true })
  icon: string;

  @Column({ length: 20, nullable: true })
  color: string;

  @Column({ name: 'responsible_dept_id', nullable: true })
  responsibleDeptId: string;

  @ManyToOne(() => Department)
  @JoinColumn({ name: 'responsible_dept_id' })
  responsibleDept: Department;

  @Column({ name: 'sla_days', type: 'smallint', default: 15 })
  slaDays: number;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
