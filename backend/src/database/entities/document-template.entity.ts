import { Column, CreateDateColumn, DeleteDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

/** แม่แบบเอกสารของตัวแต่งเอกสาร — organizationId NULL = แม่แบบมาตรฐานของระบบ (ทุก อบต. ใช้ได้) */
@Entity('document_templates')
export class DocumentTemplate {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'organization_id', type: 'uuid', nullable: true }) organizationId: string | null;
  @Column({ length: 200 }) name: string;
  /** overlay = แต่งทับหนังสือที่แนบ · document = ร่างเอกสารใหม่ */
  @Column({ length: 20, default: 'document' }) category: string;
  /** คีย์ของแม่แบบมาตรฐาน (seed แบบ idempotent) */
  @Column({ name: 'system_key', type: 'varchar', length: 60, nullable: true }) systemKey: string | null;
  @Column({ type: 'jsonb' }) layout: any;
  @Column({ name: 'created_by', type: 'uuid', nullable: true }) createdBy: string | null;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' }) updatedAt: Date;
  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz' }) deletedAt: Date | null;
}
