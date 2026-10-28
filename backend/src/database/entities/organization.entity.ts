import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  UpdateDateColumn, OneToMany,
} from 'typeorm';

@Entity('organizations')
export class Organization {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true, length: 20 })
  code: string;

  @Column({ name: 'name_th', length: 200 })
  nameTh: string;

  @Column({ name: 'name_en', length: 200, nullable: true })
  nameEn: string;

  @Column({
    type: 'varchar', length: 50,
    enum: ['อบต', 'เทศบาลตำบล', 'เทศบาลเมือง', 'เทศบาลนคร'],
  })
  type: string;

  @Column({ length: 100 })
  province: string;

  @Column({ length: 100 })
  district: string;

  @Column({ name: 'sub_district', length: 100 })
  subDistrict: string;

  @Column({ type: 'text', nullable: true })
  address: string;

  @Column({ length: 20, nullable: true })
  phone: string;

  @Column({ length: 20, nullable: true })
  fax: string;

  @Column({ length: 100, nullable: true })
  email: string;

  @Column({ length: 200, nullable: true })
  website: string;

  @Column({ name: 'logo_url', length: 500, nullable: true })
  logoUrl: string;

  @Column({ name: 'seal_url', length: 500, nullable: true })
  sealUrl: string;

  @Column({ name: 'header_text', type: 'text', nullable: true })
  headerText: string;

  /**
   * โดเมน/subdomain ที่ผูกกับหน่วยงานนี้ — เปิดโดเมนไหน ระบบรู้ว่าเป็น อบต. ไหนอัตโนมัติ
   * เช่น ['sao-lamnangrong.com'] หรือ ['lamnangrong.smartsao.com'] · 1 อบต. มีได้หลายโดเมน
   */
  @Column({ type: 'text', array: true, nullable: true })
  hostnames: string[];

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @Column({ type: 'jsonb', default: '{}' })
  metadata: Record<string, any>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
