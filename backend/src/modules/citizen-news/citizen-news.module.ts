import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CitizenNews } from '../../database/entities/citizen-news.entity';
import { Organization } from '../../database/entities/organization.entity';
import { StorageModule } from '../storage/storage.module';
import { CitizenNewsService } from './citizen-news.service';
import { CitizenNewsController } from './citizen-news.controller';
import { CitizenNewsStaffController } from './citizen-news-staff.controller';

@Module({
  imports: [TypeOrmModule.forFeature([CitizenNews, Organization]), StorageModule],
  controllers: [CitizenNewsController, CitizenNewsStaffController],
  providers: [CitizenNewsService],
})
export class CitizenNewsModule {}
