import {
  Controller, Get, Post, Put, Patch, Delete, Body, Param, Query,
  UseGuards, ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { MeetingsService } from './meetings.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { MeetingQueryDto } from './dto/meeting-query.dto';
import { CreateMeetingDto, UpdateMeetingDto, CreateAgendaItemDto, CreateResolutionDto } from './dto/meeting.dto';

@ApiTags('meetings')
@ApiBearerAuth('access-token')
@Controller('meetings')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class MeetingsController {
  constructor(private readonly service: MeetingsService) {}

  // การดู: ผู้ถูกเชิญ + ผู้มีสิทธิ์ + admin (คุมในเซอร์วิส ไม่ใช้ permission guard)
  @Get()
  findAll(@CurrentUser('organizationId') orgId: string, @CurrentUser() user: any, @Query() dto: MeetingQueryDto) {
    return this.service.findAll(orgId, dto, user);
  }

  @Get('my')
  myUpcoming(@CurrentUser('organizationId') orgId: string, @CurrentUser('id') userId: string) {
    return this.service.myUpcoming(orgId, userId);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser('organizationId') orgId: string, @CurrentUser() user: any) {
    return this.service.findOne(id, orgId, user);
  }

  // การสร้าง: ต้องมีสิทธิ์สร้างประชุม
  @Post()
  @RequirePermissions({ module: 'meetings', action: 'create', subject: 'Meeting' })
  create(@Body() dto: CreateMeetingDto, @CurrentUser('organizationId') orgId: string, @CurrentUser('id') userId: string) {
    return this.service.create(dto, orgId, userId);
  }

  // การจัดการระหว่างประชุม: ผู้สร้าง + เลขาฯ + admin (คุมในเซอร์วิส)
  @Put(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateMeetingDto, @CurrentUser('organizationId') orgId: string, @CurrentUser() user: any) {
    return this.service.update(id, dto, orgId, user);
  }

  @Post(':id/start')
  @ApiOperation({ summary: 'เริ่มการประชุม' })
  start(@Param('id', ParseUUIDPipe) id: string, @CurrentUser('organizationId') orgId: string, @CurrentUser() user: any) {
    return this.service.startMeeting(id, orgId, user);
  }

  @Post(':id/finish')
  @ApiOperation({ summary: 'สิ้นสุดการประชุม' })
  finish(@Param('id', ParseUUIDPipe) id: string, @CurrentUser('organizationId') orgId: string, @CurrentUser() user: any) {
    return this.service.finishMeeting(id, orgId, user);
  }

  @Post(':id/cancel')
  @ApiOperation({ summary: 'ยกเลิกการประชุม' })
  cancel(@Param('id', ParseUUIDPipe) id: string, @CurrentUser('organizationId') orgId: string, @CurrentUser() user: any) {
    return this.service.cancel(id, orgId, user);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'ลบการประชุม (เจ้าของหรือผู้ดูแลระบบ)' })
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser('organizationId') orgId: string, @CurrentUser() user: any) {
    return this.service.remove(id, orgId, user);
  }

  @Post(':id/invite')
  invite(@Param('id', ParseUUIDPipe) id: string, @CurrentUser('organizationId') orgId: string, @CurrentUser() user: any, @Body() body: { userIds: string[] }) {
    return this.service.inviteAttendees(id, orgId, body.userIds, user);
  }

  @Put(':id/confirm')
  confirm(@Param('id', ParseUUIDPipe) id: string, @CurrentUser('id') userId: string) {
    return this.service.confirmAttendance(id, userId);
  }

  @Get(':id/attendees')
  getAttendees(@Param('id', ParseUUIDPipe) id: string) { return this.service.getAttendees(id); }

  @Get(':id/agenda')
  getAgenda(@Param('id', ParseUUIDPipe) id: string) { return this.service.getAgenda(id); }

  @Post(':id/agenda')
  addAgenda(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CreateAgendaItemDto, @CurrentUser('organizationId') orgId: string, @CurrentUser() user: any) {
    return this.service.addAgendaItem(id, dto, orgId, user);
  }

  @Get(':id/resolutions')
  getResolutions(@Param('id', ParseUUIDPipe) id: string) { return this.service.getResolutions(id); }

  @Post(':id/resolutions')
  addResolution(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CreateResolutionDto, @CurrentUser('organizationId') orgId: string, @CurrentUser() user: any) {
    return this.service.addResolution(id, dto, orgId, user);
  }

  @Patch(':id/minutes')
  saveMinutes(@Param('id', ParseUUIDPipe) id: string, @CurrentUser('organizationId') orgId: string, @CurrentUser() user: any, @Body() body: { minutesText: string }) {
    return this.service.saveMinutes(id, orgId, body.minutesText, user);
  }
}
