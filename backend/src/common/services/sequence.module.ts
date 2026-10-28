import { Global, Module } from '@nestjs/common';
import { SequenceService } from './sequence.service';

/** ให้ทุกโมดูล inject SequenceService ได้โดยไม่ต้อง import ซ้ำ */
@Global()
@Module({
  providers: [SequenceService],
  exports: [SequenceService],
})
export class SequenceModule {}
