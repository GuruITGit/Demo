import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MeetingsController } from './meetings.controller';
import { MeetingsService } from './meetings.service';
import { Meeting } from '../../database/entities/meeting.entity';
import { MeetingAttendee } from '../../database/entities/meeting-attendee.entity';
import { MeetingAgendaItem } from '../../database/entities/meeting-agenda-item.entity';
import { MeetingResolution } from '../../database/entities/meeting-resolution.entity';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Meeting, MeetingAttendee, MeetingAgendaItem, MeetingResolution]),
    NotificationsModule,
  ],
  controllers: [MeetingsController],
  providers: [MeetingsService],
  exports: [MeetingsService],
})
export class MeetingsModule {}
