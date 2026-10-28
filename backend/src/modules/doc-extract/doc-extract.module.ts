import { Module } from '@nestjs/common';
import { DocExtractController } from './doc-extract.controller';
import { DocExtractService } from './doc-extract.service';
import { PlatformSecretsModule } from '../platform-secrets/platform-secrets.module';

/** AI อ่านหนังสือราชการ → กรอกฟอร์มสร้างสารบรรณ (แยกจาก engine สารบรรณ · Claude หรือ Gemini ตามที่ตั้งใน /hub หรือ .env) */
@Module({
  imports: [PlatformSecretsModule],
  controllers: [DocExtractController],
  providers: [DocExtractService],
})
export class DocExtractModule {}
