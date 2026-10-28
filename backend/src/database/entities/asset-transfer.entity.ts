import {
  Entity, PrimaryGeneratedColumn, Column, ManyToOne,
  JoinColumn, CreateDateColumn,
} from 'typeorm';
import { Asset } from './asset.entity';
import { Department } from './department.entity';
import { Employee } from './employee.entity';
import { User } from './user.entity';

@Entity('asset_transfers')
export class AssetTransfer {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'asset_id' })
  assetId: string;

  @ManyToOne(() => Asset)
  @JoinColumn({ name: 'asset_id' })
  asset: Asset;

  @Column({ name: 'from_department_id', nullable: true })
  fromDepartmentId: string;

  @ManyToOne(() => Department)
  @JoinColumn({ name: 'from_department_id' })
  fromDepartment: Department;

  @Column({ name: 'to_department_id' })
  toDepartmentId: string;

  @ManyToOne(() => Department)
  @JoinColumn({ name: 'to_department_id' })
  toDepartment: Department;

  @Column({ name: 'from_custodian_id', nullable: true })
  fromCustodianId: string;

  @ManyToOne(() => Employee)
  @JoinColumn({ name: 'from_custodian_id' })
  fromCustodian: Employee;

  @Column({ name: 'to_custodian_id' })
  toCustodianId: string;

  @ManyToOne(() => Employee)
  @JoinColumn({ name: 'to_custodian_id' })
  toCustodian: Employee;

  @Column({ name: 'transfer_date', type: 'date' })
  transferDate: Date;

  @Column({ type: 'text', nullable: true })
  reason: string;

  @Column({ name: 'approved_by', nullable: true })
  approvedBy: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'approved_by' })
  approver: User;

  @Column({ name: 'created_by' })
  createdBy: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'created_by' })
  creator: User;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
