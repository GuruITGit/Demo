import {
  Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn,
  CreateDateColumn, UpdateDateColumn, DeleteDateColumn,
} from 'typeorm';
import { Organization } from './organization.entity';
import { AssetCategory } from './asset-category.entity';
import { Department } from './department.entity';
import { Employee } from './employee.entity';
import { User } from './user.entity';

@Entity('assets')
export class Asset {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'organization_id' })
  organizationId: string;

  @ManyToOne(() => Organization)
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;

  @Column({ name: 'category_id', nullable: true })
  categoryId: string;

  @ManyToOne(() => AssetCategory)
  @JoinColumn({ name: 'category_id' })
  category: AssetCategory;

  @Column({ name: 'asset_code', unique: true, length: 100 })
  assetCode: string;

  @Column({ name: 'qr_code', length: 500, nullable: true })
  qrCode: string;

  @Column({ name: 'qr_code_url', length: 500, nullable: true })
  qrCodeUrl: string;

  @Column({ length: 300 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ length: 100, nullable: true })
  brand: string;

  @Column({ length: 100, nullable: true })
  model: string;

  @Column({ name: 'serial_number', length: 200, nullable: true })
  serialNumber: string;

  @Column({ name: 'purchase_date', type: 'date', nullable: true })
  purchaseDate: Date;

  @Column({ name: 'purchase_price', type: 'numeric', precision: 15, scale: 2, nullable: true })
  purchasePrice: number;

  @Column({ length: 300, nullable: true })
  supplier: string;

  @Column({ name: 'warranty_expire', type: 'date', nullable: true })
  warrantyExpire: Date;

  @Column({ name: 'department_id', nullable: true })
  departmentId: string;

  @ManyToOne(() => Department)
  @JoinColumn({ name: 'department_id' })
  department: Department;

  @Column({ length: 300, nullable: true })
  location: string;

  @Column({ name: 'custodian_id', nullable: true })
  custodianId: string;

  @ManyToOne(() => Employee)
  @JoinColumn({ name: 'custodian_id' })
  custodian: Employee;

  @Column({ length: 50, default: 'ใช้งาน' })
  status: string;

  @Column({ name: 'photo_url', length: 500, nullable: true })
  photoUrl: string;

  @Column({ name: 'current_value', type: 'numeric', precision: 15, scale: 2, nullable: true })
  currentValue: number;

  @Column({ name: 'depreciation_rate', type: 'numeric', precision: 5, scale: 2, nullable: true })
  depreciationRate: number;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column({ name: 'created_by' })
  createdBy: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'created_by' })
  creator: User;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt: Date;
}
