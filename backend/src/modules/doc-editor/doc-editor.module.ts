import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FileUpload } from '../../database/entities/file-upload.entity';
import { DocumentTemplate } from '../../database/entities/document-template.entity';
import { TicketDocument } from '../../database/entities/ticket-document.entity';
import { PdfModule } from '../pdf/pdf.module';
import { StorageModule } from '../storage/storage.module';
import { TicketModule } from '../ticket/ticket.module';
import { DocEditorController } from './doc-editor.controller';
import { DocEditorService } from './doc-editor.service';
import { DocTemplatesController } from './doc-templates.controller';
import { DocTemplatesService } from './doc-templates.service';

/** ตัวแต่งเอกสาร (Word ผสม Canva) — เครื่องมือเอกสารแยกจาก workflow สารบรรณ */
@Module({
  imports: [TypeOrmModule.forFeature([FileUpload, DocumentTemplate, TicketDocument]), PdfModule, StorageModule, TicketModule],
  controllers: [DocEditorController, DocTemplatesController],
  providers: [DocEditorService, DocTemplatesService],
  exports: [DocEditorService],
})
export class DocEditorModule {}
