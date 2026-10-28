import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TicketController } from './ticket.controller';
import { TicketService } from './ticket.service';
import { TicketNumberingService } from './ticket-numbering.service';
import { TicketSummaryService } from './ticket-summary.service';
import { CorrespondenceTicket } from '../../database/entities/correspondence-ticket.entity';
import { CorrespondenceTicketDepartment } from '../../database/entities/correspondence-ticket-department.entity';
import { DocumentWorkflowLog } from '../../database/entities/document-workflow-log.entity';
import { Department } from '../../database/entities/department.entity';
import { User } from '../../database/entities/user.entity';
import { AuditLog } from '../../database/entities/audit-log.entity';
import { NotificationsModule } from '../notifications/notifications.module';
import { StorageModule } from '../storage/storage.module';
import { PdfModule } from '../pdf/pdf.module';

/** สารบรรณ v4 (saraban) — แยกออกจาก CorrespondenceModule (หนังสือเข้า-ออกแบบเก่า) เพราะไม่เชื่อมกันเลย */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      CorrespondenceTicket, CorrespondenceTicketDepartment,
      DocumentWorkflowLog, AuditLog, Department, User,
    ]),
    NotificationsModule,
    StorageModule,
    PdfModule,
  ],
  controllers: [TicketController],
  providers: [TicketService, TicketNumberingService, TicketSummaryService],
  exports: [TicketService, TicketNumberingService, TicketSummaryService],
})
export class TicketModule {}
