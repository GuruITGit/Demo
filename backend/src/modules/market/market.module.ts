import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MarketStall } from '../../database/entities/market-stall.entity';
import { MarketBill } from '../../database/entities/market-bill.entity';
import { MarketService } from './market.service';
import { MarketController } from './market.controller';

@Module({
  imports: [TypeOrmModule.forFeature([MarketStall, MarketBill])],
  controllers: [MarketController],
  providers: [MarketService],
})
export class MarketModule {}
