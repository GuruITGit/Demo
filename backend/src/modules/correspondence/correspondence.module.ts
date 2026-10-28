import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CorrespondenceController } from './correspondence.controller';
import { CorrespondenceService } from './correspondence.service';
import { IncomingDocument } from '../../database/entities/incoming-document.entity';
import { OutgoingDocument } from '../../database/entities/outgoing-document.entity';
import { DocumentWorkflowLog } from '../../database/entities/document-workflow-log.entity';
import { DocumentNumberSequence } from '../../database/entities/document-number-sequence.entity';
import { AuditLog } from '../../database/entities/audit-log.entity';
import { NotificationsModule } from '../notifications/notifications.module';

/** หนังสือเข้า-ออกแบบเก่า (IncomingDocument/OutgoingDocument) — คนละระบบกับสารบรรณ v4 (ดู modules/ticket) ไม่เชื่อมกันเลย */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      IncomingDocument, OutgoingDocument, DocumentWorkflowLog, DocumentNumberSequence, AuditLog,
    ]),
    NotificationsModule,
  ],
  controllers: [CorrespondenceController],
  providers: [CorrespondenceService],
  exports: [CorrespondenceService],
})
export class CorrespondenceModule {}
