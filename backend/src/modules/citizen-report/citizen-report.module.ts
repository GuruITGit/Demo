import { CitizenReportComment } from '../../database/entities/citizen-report-comment.entity';
import { FileUpload } from '../../database/entities/file-upload.entity';
import { DocEditorModule } from '../doc-editor/doc-editor.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { CitizenReportDocController } from './citizen-report-doc.controller';
import { CitizenReportDocService } from './citizen-report-doc.service';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CitizenReport } from '../../database/entities/citizen-report.entity';
import { Organization } from '../../database/entities/organization.entity';
import { WaterCustomer } from '../../database/entities/water-customer.entity';
import { Department } from '../../database/entities/department.entity';
import { StorageModule } from '../storage/storage.module';
import { PdfModule } from '../pdf/pdf.module';
import { CitizenReportService } from './citizen-report.service';
import { CitizenReportController } from './citizen-report.controller';
import { CitizenReportStaffController } from './citizen-report-staff.controller';

@Module({
  imports: [TypeOrmModule.forFeature([CitizenReport, CitizenReportComment, FileUpload, Organization, WaterCustomer, Department]), StorageModule, PdfModule, DocEditorModule, NotificationsModule],
  controllers: [CitizenReportController, CitizenReportStaffController, CitizenReportDocController],
  providers: [CitizenReportService, CitizenReportDocService],
})
export class CitizenReportModule {}
