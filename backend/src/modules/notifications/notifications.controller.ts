import {
  Controller, Get, Put, Delete, Param, Query,
  UseGuards, ParseUUIDPipe, Body,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { NotificationQueryDto } from './dto/notification-query.dto';

@ApiTags('notifications')
@ApiBearerAuth('access-token')
@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly service: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'รายการแจ้งเตือน' })
  findAll(@CurrentUser('id') userId: string, @Query() dto: NotificationQueryDto) {
    // NotificationQueryDto แปลง "true"/"1" เป็น boolean ให้แล้ว (@Transform)
    return this.service.findAll(userId, dto);
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'จำนวนที่ยังไม่อ่าน' })
  getUnreadCount(@CurrentUser('id') userId: string) {
    return this.service.getUnreadCount(userId).then(count => ({ count }));
  }

  @Get('preferences')
  @ApiOperation({ summary: 'ตั้งค่าการแจ้งเตือน' })
  getPreferences(@CurrentUser('id') userId: string) {
    return this.service.getPreferences(userId);
  }

  @Put('preferences')
  @ApiOperation({ summary: 'อัปเดตตั้งค่า' })
  updatePreferences(@CurrentUser('id') userId: string, @Body() body: { prefs: any[] }) {
    return this.service.updatePreferences(userId, body.prefs);
  }

  @Put('read-all')
  @ApiOperation({ summary: 'อ่านทั้งหมด' })
  markAllAsRead(@CurrentUser('id') userId: string) {
    return this.service.markAllAsRead(userId);
  }

  @Put(':id/read')
  @ApiOperation({ summary: 'ทำเครื่องหมายอ่านแล้ว' })
  markAsRead(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.service.markAsRead(id, userId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'ลบการแจ้งเตือน' })
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.service.remove(id, userId);
  }
}
