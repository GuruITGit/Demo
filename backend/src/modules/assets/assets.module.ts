import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AssetsController } from './assets.controller';
import { AssetsService } from './assets.service';
import { Asset } from '../../database/entities/asset.entity';
import { AssetCategory } from '../../database/entities/asset-category.entity';
import { AssetTransfer } from '../../database/entities/asset-transfer.entity';
import { AssetInspection } from '../../database/entities/asset-inspection.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Asset, AssetCategory, AssetTransfer, AssetInspection])],
  controllers: [AssetsController],
  providers: [AssetsService],
  exports: [AssetsService],
})
export class AssetsModule {}
