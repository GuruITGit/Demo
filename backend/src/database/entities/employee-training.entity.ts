import {
  Entity, PrimaryGeneratedColumn, Column, ManyToOne,
  JoinColumn, CreateDateColumn,
} from 'typeorm';
import { Employee } from './employee.entity';

@Entity('employee_training')
export class EmployeeTraining {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'employee_id' })
  employeeId: string;

  @ManyToOne(() => Employee, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'employee_id' })
  employee: Employee;

  @Column({ name: 'course_name', length: 300 })
  courseName: string;

  @Column({ length: 300, nullable: true })
  organizer: string;

  @Column({ length: 300, nullable: true })
  location: string;

  @Column({ name: 'start_date', type: 'date' })
  startDate: Date;

  @Column({ name: 'end_date', type: 'date', nullable: true })
  endDate: Date;

  @Column({ type: 'smallint', nullable: true })
  hours: number;

  @Column({ name: 'certificate_url', length: 500, nullable: true })
  certificateUrl: string;

  @Column({ type: 'text', nullable: true })
  note: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
