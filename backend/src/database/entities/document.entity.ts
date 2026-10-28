import {
  Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn,
  CreateDateColumn, UpdateDateColumn, DeleteDateColumn, Index,
} from 'typeorm';
import { Organization } from './organization.entity';
import { DocumentCategory } from './document-category.entity';
import { Department } from './department.entity';
import { User } from './user.entity';

@Entity('documents')
export class Document {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'organization_id' })
  organizationId: string;

  @ManyToOne(() => Organization)
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;

  @Column({ name: 'category_id', nullable: true })
  categoryId: string;

  @ManyToOne(() => DocumentCategory)
  @JoinColumn({ name: 'category_id' })
  category: DocumentCategory;

  @Column({ name: 'doc_number', length: 100, nullable: true })
  docNumber: string;

  @Column({ length: 500 })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ name: 'file_url', length: 500 })
  fileUrl: string;

  @Column({ name: 'file_name', length: 300 })
  fileName: string;

  @Column({ name: 'file_size', type: 'bigint', nullable: true })
  fileSize: number;

  @Column({ name: 'mime_type', length: 100, nullable: true })
  mimeType: string;

  @Column({ name: 'ocr_text', type: 'text', nullable: true })
  ocrText: string;

  @Column({ name: 'ocr_processed_at', type: 'timestamptz', nullable: true })
  ocrProcessedAt: Date;

  @Column({ name: 'doc_year', type: 'smallint', nullable: true })
  docYear: number;

  @Column({ name: 'doc_date', type: 'date', nullable: true })
  docDate: Date;

  @Column({ type: 'text', array: true, default: '{}' })
  tags: string[];

  /** ระดับการเข้าถึง: public(สาธารณะ) / department(แค่กอง) / private(แค่เฉพาะบุคคล) */
  @Column({ name: 'access_level', length: 30, default: 'department' })
  accessLevel: string;

  /** ผู้สร้าง/หน่วยงานเจ้าของเอกสาร (กรอกเอง — ต่างจาก creator ที่เป็นผู้อัปโหลด) */
  @Column({ name: 'owner_org', length: 255, nullable: true })
  ownerOrg: string;

  /** รายชื่อผู้มีสิทธิ์เข้าถึง (ใช้เมื่อ access_level = private) */
  @Column({ name: 'allowed_user_ids', type: 'uuid', array: true, default: '{}' })
  allowedUserIds: string[];

  @Column({ name: 'department_id', nullable: true })
  departmentId: string;

  @ManyToOne(() => Department)
  @JoinColumn({ name: 'department_id' })
  department: Department;

  @Column({ name: 'source_type', length: 50, nullable: true })
  sourceType: string;

  @Column({ name: 'source_id', nullable: true })
  sourceId: string;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @Column({ name: 'download_count', default: 0 })
  downloadCount: number;

  @Column({ name: 'view_count', default: 0 })
  viewCount: number;

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
