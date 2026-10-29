import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WasteBill } from '../../database/entities/waste-bill.entity';
import { WasteHousehold } from '../../database/entities/waste-household.entity';
import { MarketModule } from '../market/market.module';
import { WasteService } from './waste.service';
import { WasteController } from './waste.controller';

@Module({
  imports: [TypeOrmModule.forFeature([WasteBill, WasteHousehold]), MarketModule],
  controllers: [WasteController],
  providers: [WasteService],
})
export class WasteModule {}
