import {
  Entity, PrimaryGeneratedColumn, Column, ManyToOne,
  JoinColumn, CreateDateColumn,
} from 'typeorm';
import { Asset } from './asset.entity';
import { User } from './user.entity';

@Entity('asset_inspections')
export class AssetInspection {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'asset_id' })
  assetId: string;

  @ManyToOne(() => Asset)
  @JoinColumn({ name: 'asset_id' })
  asset: Asset;

  @Column({ name: 'inspection_date', type: 'date' })
  inspectionDate: Date;

  @Column({ name: 'inspector_id' })
  inspectorId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'inspector_id' })
  inspector: User;

  @Column({ length: 30 })
  condition: string;

  @Column({ type: 'text', nullable: true })
  note: string;

  @Column({ name: 'photo_url', length: 500, nullable: true })
  photoUrl: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
