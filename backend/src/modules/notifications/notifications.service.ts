import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification } from '../../database/entities/notification.entity';
import { NotificationPreference } from '../../database/entities/notification-preference.entity';
import { paginate, PaginationDto } from '../../common/dto/pagination.dto';
import { AppGateway } from '../gateway/app.gateway';

export interface CreateNotificationDto {
  organizationId: string;
  recipientId: string;
  type: string;
  title: string;
  body: string;
  actionUrl?: string;
  refType?: string;
  refId?: string;
  channel?: string;
  priority?: string;
}

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification) private notifRepo: Repository<Notification>,
    @InjectRepository(NotificationPreference) private prefRepo: Repository<NotificationPreference>,
    @Inject(forwardRef(() => AppGateway)) private gateway: AppGateway,
  ) {}

  async createNotification(dto: CreateNotificationDto) {
    const notification = await this.notifRepo.save({
      ...dto,
      channel: dto.channel || 'in_app',
      priority: dto.priority || 'normal',
    });
    // ส่ง real-time ให้ผู้รับทันที (ถ้าออนไลน์)
    try { this.gateway.sendNotificationToUser(dto.recipientId, notification); } catch { /* offline */ }
    return notification;
  }

  async findAll(userId: string, dto: PaginationDto & { unreadOnly?: boolean }) {
    const qb = this.notifRepo.createQueryBuilder('n')
      .where('n.recipient_id = :userId', { userId })
      .orderBy('n.created_at', 'DESC')
      .skip(dto.skip)
      .take(dto.limit);

    if (dto.unreadOnly) qb.andWhere('n.is_read = false');

    const [data, total] = await qb.getManyAndCount();
    return paginate(data, total, dto);
  }

  async getUnreadCount(userId: string): Promise<number> {
    return this.notifRepo.count({ where: { recipientId: userId, isRead: false } });
  }

  async markAsRead(id: string, userId: string) {
    await this.notifRepo.update(
      { id, recipientId: userId },
      { isRead: true, readAt: new Date() },
    );
    return { message: 'ทำเครื่องหมายอ่านแล้ว' };
  }

  async markAllAsRead(userId: string) {
    await this.notifRepo.update(
      { recipientId: userId, isRead: false },
      { isRead: true, readAt: new Date() },
    );
    return { message: 'อ่านทั้งหมดแล้ว' };
  }

  async remove(id: string, userId: string) {
    await this.notifRepo.delete({ id, recipientId: userId });
    return { message: 'ลบการแจ้งเตือนสำเร็จ' };
  }

  async getPreferences(userId: string) {
    return this.prefRepo.find({ where: { userId } });
  }

  async updatePreferences(userId: string, prefs: any[]) {
    for (const pref of prefs) {
      await this.prefRepo.upsert({ ...pref, userId }, ['userId', 'notificationType']);
    }
    return { message: 'บันทึกตั้งค่าสำเร็จ' };
  }
}
