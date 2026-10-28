import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';
import { Document } from '../../database/entities/document.entity';
import { DocumentCategory } from '../../database/entities/document-category.entity';
import { DocumentVersion } from '../../database/entities/document-version.entity';
import { AuditLog } from '../../database/entities/audit-log.entity';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Document, DocumentCategory, DocumentVersion, AuditLog]),
    StorageModule,
  ],
  controllers: [DocumentsController],
  providers: [DocumentsService],
  exports: [DocumentsService],
})
export class DocumentsModule {}
