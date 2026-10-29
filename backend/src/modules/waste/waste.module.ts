import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WasteBill } from '../../database/entities/waste-bill.entity';
import { WasteService } from './waste.service';
import { WasteController } from './waste.controller';

@Module({
  imports: [TypeOrmModule.forFeature([WasteBill])],
  controllers: [WasteController],
  providers: [WasteService],
})
export class WasteModule {}
