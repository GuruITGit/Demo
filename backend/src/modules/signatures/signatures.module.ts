import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SignaturesController } from './signatures.controller';
import { SignaturesService } from './signatures.service';
import { UserSignature } from '../../database/entities/user-signature.entity';
import { SignatureLog } from '../../database/entities/signature-log.entity';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [TypeOrmModule.forFeature([UserSignature, SignatureLog]), StorageModule],
  controllers: [SignaturesController],
  providers: [SignaturesService],
  exports: [SignaturesService],
})
export class SignaturesModule {}
