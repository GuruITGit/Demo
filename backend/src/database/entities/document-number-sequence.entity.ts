import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn, Unique,
} from 'typeorm';

@Entity('document_number_sequences')
@Unique(['organizationId', 'docType', 'year'])
export class DocumentNumberSequence {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'organization_id' })
  organizationId: string;

  // ยาวพอสำหรับคีย์ BOOK:<เล่ม>:<deptId(uuid)> (สูงสุด ~59 ตัวอักษร)
  @Column({ name: 'doc_type', length: 120 })
  docType: string;

  @Column({ type: 'smallint' })
  year: number;

  @Column({ length: 20, nullable: true })
  prefix: string;

  @Column({ name: 'current_number', default: 0 })
  currentNumber: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
