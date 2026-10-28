import {
  Entity, PrimaryGeneratedColumn, Column, ManyToOne,
  JoinColumn, CreateDateColumn,
} from 'typeorm';

@Entity('asset_categories')
export class AssetCategory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'organization_id', nullable: true })
  organizationId: string;

  @Column({ name: 'parent_id', nullable: true })
  parentId: string;

  @ManyToOne(() => AssetCategory)
  @JoinColumn({ name: 'parent_id' })
  parent: AssetCategory;

  @Column({ length: 50 })
  code: string;

  @Column({ name: 'name_th', length: 200 })
  nameTh: string;

  @Column({ name: 'depreciation_years', type: 'smallint', default: 5 })
  depreciationYears: number;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
