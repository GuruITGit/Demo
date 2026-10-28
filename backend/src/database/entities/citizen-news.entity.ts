import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

/** ข่าว/ประกาศประชาสัมพันธ์ (พอร์ทัลประชาชน /citizen) — CMS จัดการโดยเจ้าหน้าที่ */
@Entity('citizen_news')
export class CitizenNews {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'organization_id' })
  organizationId: string;

  @Column({ length: 250 })
  title: string;

  /** หมวด: ข่าวประชาสัมพันธ์ / ประกาศจัดซื้อจัดจ้าง / กิจกรรม / ประกาศทั่วไป */
  @Column({ length: 40, default: 'ข่าวประชาสัมพันธ์' })
  category: string;

  @Column({ type: 'text', nullable: true })
  excerpt: string | null;

  @Column({ type: 'text', nullable: true })
  content: string | null;

  @Column({ name: 'cover_url', type: 'text', nullable: true })
  coverUrl: string | null;

  /** draft | published */
  @Column({ length: 16, default: 'draft' })
  status: string;

  @Column({ default: false })
  pinned: boolean;

  @Column({ name: 'published_at', type: 'timestamptz', nullable: true })
  publishedAt: Date | null;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
