import { Global, Module } from '@nestjs/common';
import { ModuleAccessService } from './module-access.service';

/** โมดูล global — ให้ทุกที่ inject ModuleAccessService ได้ (interceptor + organizations service) */
@Global()
@Module({
  providers: [ModuleAccessService],
  exports: [ModuleAccessService],
})
export class ModuleAccessModule {}
