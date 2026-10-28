import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PlatformSecret } from '../../database/entities/platform-secret.entity';
import { AuditLog } from '../../database/entities/audit-log.entity';
import { PlatformSecretsController } from './platform-secrets.controller';
import { PlatformSecretsService } from './platform-secrets.service';

/** ความลับระดับเจ้าของระบบ (ตั้งที่ /hub) — export service ให้โมดูลอื่นอ่านค่า เช่น AI อ่านหนังสือ */
@Module({
  imports: [TypeOrmModule.forFeature([PlatformSecret, AuditLog])],
  controllers: [PlatformSecretsController],
  providers: [PlatformSecretsService],
  exports: [PlatformSecretsService],
})
export class PlatformSecretsModule {}
