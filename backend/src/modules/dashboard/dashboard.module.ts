import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { IncomingDocument } from '../../database/entities/incoming-document.entity';
import { ApprovalRequest } from '../../database/entities/approval-request.entity';
import { LeaveRequest } from '../../database/entities/leave-request.entity';
import { Complaint } from '../../database/entities/complaint.entity';
import { Meeting } from '../../database/entities/meeting.entity';
import { Budget } from '../../database/entities/budget.entity';
import { Project } from '../../database/entities/project.entity';
import { WelfareRecipient } from '../../database/entities/welfare.entity';

@Module({
  imports: [TypeOrmModule.forFeature([IncomingDocument, ApprovalRequest, LeaveRequest, Complaint, Meeting, Budget, Project, WelfareRecipient])],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
