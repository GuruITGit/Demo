import {
  Entity, PrimaryGeneratedColumn, Column, ManyToOne,
  JoinColumn, CreateDateColumn,
} from 'typeorm';

@Entity('document_categories')
export class DocumentCategory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'organization_id', nullable: true })
  organizationId: string;

  @Column({ name: 'parent_id', nullable: true })
  parentId: string;

  @ManyToOne(() => DocumentCategory)
  @JoinColumn({ name: 'parent_id' })
  parent: DocumentCategory;

  @Column({ length: 50 })
  code: string;

  @Column({ name: 'name_th', length: 200 })
  nameTh: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ length: 50, nullable: true })
  icon: string;

  @Column({ length: 20, nullable: true })
  color: string;

  @Column({ name: 'order_no', type: 'smallint', default: 0 })
  orderNo: number;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
