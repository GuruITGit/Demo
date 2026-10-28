import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LeaveController } from './leave.controller';
import { LeaveService } from './leave.service';
import { LeaveRequest } from '../../database/entities/leave-request.entity';
import { LeaveApprovalLog } from '../../database/entities/leave-approval-log.entity';
import { LeaveQuota } from '../../database/entities/leave-quota.entity';
import { LeaveType } from '../../database/entities/leave-type.entity';
import { Employee } from '../../database/entities/employee.entity';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([LeaveRequest, LeaveApprovalLog, LeaveQuota, LeaveType, Employee]),
    NotificationsModule,
  ],
  controllers: [LeaveController],
  providers: [LeaveService],
  exports: [LeaveService],
})
export class LeaveModule {}
