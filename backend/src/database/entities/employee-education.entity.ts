import {
  Entity, PrimaryGeneratedColumn, Column, ManyToOne,
  JoinColumn, CreateDateColumn,
} from 'typeorm';
import { Employee } from './employee.entity';

@Entity('employee_education')
export class EmployeeEducation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'employee_id' })
  employeeId: string;

  @ManyToOne(() => Employee, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'employee_id' })
  employee: Employee;

  @Column({ length: 100 })
  degree: string;

  @Column({ length: 200, nullable: true })
  major: string;

  @Column({ length: 300 })
  institution: string;

  @Column({ name: 'graduation_year', type: 'smallint', nullable: true })
  graduationYear: number;

  @Column({ type: 'numeric', precision: 3, scale: 2, nullable: true })
  gpa: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
