import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MarketStall } from '../../database/entities/market-stall.entity';
import { MarketBill } from '../../database/entities/market-bill.entity';
import { WasteBill } from '../../database/entities/waste-bill.entity';
import { Organization } from '../../database/entities/organization.entity';
import { MarketOutsideLocation } from '../../database/entities/market-outside.entity';
import { StorageModule } from '../storage/storage.module';
import { OrganizationsModule } from '../organizations/organizations.module';
import { MarketModule } from '../market/market.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { CitizenPayService } from './citizen-pay.service';
import { CitizenPayController } from './citizen-pay.controller';

@Module({
  imports: [TypeOrmModule.forFeature([MarketStall, MarketBill, WasteBill, Organization, MarketOutsideLocation]), StorageModule, OrganizationsModule, MarketModule, NotificationsModule],
  controllers: [CitizenPayController],
  providers: [CitizenPayService],
})
export class CitizenPayModule {}
