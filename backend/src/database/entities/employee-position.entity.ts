import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
} from 'typeorm';

@Entity('employee_positions')
export class EmployeePosition {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'organization_id' })
  organizationId: string;

  @Column({ length: 50 })
  code: string;

  @Column({ name: 'name_th', length: 200 })
  nameTh: string;

  @Column({ name: 'name_en', length: 200, nullable: true })
  nameEn: string;

  @Column({ type: 'smallint', nullable: true })
  level: number;

  @Column({ name: 'salary_min', type: 'numeric', precision: 12, scale: 2, nullable: true })
  salaryMin: number;

  @Column({ name: 'salary_max', type: 'numeric', precision: 12, scale: 2, nullable: true })
  salaryMax: number;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
