import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MarketStall } from '../../database/entities/market-stall.entity';
import { MarketBill } from '../../database/entities/market-bill.entity';
import { MarketOutsideLocation, MarketOutsideCollection } from '../../database/entities/market-outside.entity';
import { Organization } from '../../database/entities/organization.entity';
import { MarketService } from './market.service';
import { MarketController } from './market.controller';
import { MarketOutsideService } from './market-outside.service';
import { MarketOutsideController } from './market-outside.controller';
import { PayConfigService } from './pay-config.service';

@Module({
  imports: [TypeOrmModule.forFeature([MarketStall, MarketBill, Organization, MarketOutsideLocation, MarketOutsideCollection])],
  controllers: [MarketController, MarketOutsideController],
  providers: [MarketService, MarketOutsideService, PayConfigService],
  exports: [PayConfigService],
})
export class MarketModule {}
