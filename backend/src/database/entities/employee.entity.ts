import {
  Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn,
  CreateDateColumn, UpdateDateColumn, DeleteDateColumn,
} from 'typeorm';
import { Organization } from './organization.entity';
import { Department } from './department.entity';
import { Division } from './division.entity';
import { EmployeePosition } from './employee-position.entity';
import { User } from './user.entity';

@Entity('employees')
export class Employee {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'organization_id' })
  organizationId: string;

  @ManyToOne(() => Organization)
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;

  @Column({ name: 'user_id', unique: true, nullable: true })
  userId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'employee_code', unique: true, length: 50 })
  employeeCode: string;

  @Column({ length: 20, nullable: true })
  title: string;

  @Column({ name: 'first_name_th', length: 100 })
  firstNameTh: string;

  @Column({ name: 'last_name_th', length: 100 })
  lastNameTh: string;

  @Column({ name: 'first_name_en', length: 100, nullable: true })
  firstNameEn: string;

  @Column({ name: 'last_name_en', length: 100, nullable: true })
  lastNameEn: string;

  @Column({ name: 'national_id', unique: true, length: 13 })
  nationalId: string;

  @Column({ name: 'birth_date', type: 'date', nullable: true })
  birthDate: Date;

  @Column({ length: 10, nullable: true })
  gender: string;

  @Column({ length: 50, default: 'ไทย' })
  nationality: string;

  @Column({ length: 50, nullable: true })
  religion: string;

  @Column({ type: 'text', nullable: true })
  address: string;

  @Column({ length: 20, nullable: true })
  phone: string;

  @Column({ name: 'emergency_contact', length: 200, nullable: true })
  emergencyContact: string;

  @Column({ name: 'emergency_phone', length: 20, nullable: true })
  emergencyPhone: string;

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

  @Column({ name: 'position_id', nullable: true })
  positionId: string;

  @ManyToOne(() => EmployeePosition)
  @JoinColumn({ name: 'position_id' })
  position: EmployeePosition;

  @Column({ name: 'position_name', length: 200, nullable: true })
  positionName: string;

  @Column({ name: 'employee_type', length: 50 })
  employeeType: string;

  @Column({ name: 'hire_date', type: 'date' })
  hireDate: Date;

  @Column({ name: 'probation_end_date', type: 'date', nullable: true })
  probationEndDate: Date;

  @Column({ name: 'contract_end_date', type: 'date', nullable: true })
  contractEndDate: Date;

  @Column({ name: 'resign_date', type: 'date', nullable: true })
  resignDate: Date;

  @Column({ type: 'numeric', precision: 12, scale: 2, nullable: true })
  salary: number;

  @Column({ length: 30, default: 'ปฏิบัติงาน' })
  status: string;

  @Column({ name: 'photo_url', length: 500, nullable: true })
  photoUrl: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt: Date;
}
