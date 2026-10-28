import {
  Entity, PrimaryGeneratedColumn, Column, ManyToOne,
  JoinColumn, CreateDateColumn, DeleteDateColumn,
} from 'typeorm';
import { User } from './user.entity';

@Entity('file_uploads')
export class FileUpload {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'original_name', length: 300 })
  originalName: string;

  @Column({ name: 'stored_name', length: 300 })
  storedName: string;

  @Column({ name: 'mime_type', length: 100 })
  mimeType: string;

  @Column({ name: 'file_size', type: 'bigint' })
  fileSize: number;

  @Column({ length: 100 })
  bucket: string;

  @Column({ name: 'object_key', length: 500 })
  objectKey: string;

  @Column({ length: 500, nullable: true })
  url: string;

  /** URL รูปย่อ (เฉพาะไฟล์รูป — สร้างอัตโนมัติตอนอัปโหลด) */
  @Column({ name: 'thumbnail_url', length: 500, nullable: true })
  thumbnailUrl: string;

  /** คำอธิบายรูป/ไฟล์ */
  @Column({ length: 500, nullable: true })
  caption: string;

  /** หมวด/ช่วง (เช่น ก่อน/ระหว่าง/หลัง สำหรับรูปโครงการ) */
  @Column({ length: 50, nullable: true })
  category: string;

  @Column({ name: 'ref_type', length: 100, nullable: true })
  refType: string;

  @Column({ name: 'ref_id', nullable: true })
  refId: string;

  @Column({ name: 'is_public', default: false })
  isPublic: boolean;

  @Column({ name: 'is_orphan', default: false })
  isOrphan: boolean;

  @Column({ name: 'uploaded_by' })
  uploadedBy: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'uploaded_by' })
  uploader: User;

  @CreateDateColumn({ name: 'uploaded_at' })
  uploadedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt: Date;
}
