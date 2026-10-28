import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike, In, FindOptionsWhere } from 'typeorm';
import { Meeting } from '../../database/entities/meeting.entity';
import { MeetingAttendee } from '../../database/entities/meeting-attendee.entity';
import { MeetingAgendaItem } from '../../database/entities/meeting-agenda-item.entity';
import { MeetingResolution } from '../../database/entities/meeting-resolution.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { paginate, PaginationDto } from '../../common/dto/pagination.dto';
import { getCurrentThaiYear } from '../../common/utils/date.util';
import { assertCanModify, isAdmin } from '../../common/utils/ownership.util';
import { SequenceService } from '../../common/services/sequence.service';

@Injectable()
export class MeetingsService {
  constructor(
    @InjectRepository(Meeting) private meetingRepo: Repository<Meeting>,
    @InjectRepository(MeetingAttendee) private attendeeRepo: Repository<MeetingAttendee>,
    @InjectRepository(MeetingAgendaItem) private agendaRepo: Repository<MeetingAgendaItem>,
    @InjectRepository(MeetingResolution) private resolutionRepo: Repository<MeetingResolution>,
    private notificationsService: NotificationsService,
    private sequences: SequenceService,
  ) {}

  /** เห็นการประชุมทั้งหมดไหม (admin หรือมีสิทธิ์ meetings:read) */
  private canSeeAll(user: any): boolean {
    return isAdmin(user) || !!user?.permissions?.includes('meetings:read:Meeting');
  }

  /** จัดการการประชุม (เริ่ม/จบ/จดบันทึก/วาระ/มติ) ได้ไหม — ผู้สร้าง เลขาฯ หรือ admin */
  private assertCanManage(meeting: Meeting, user: any) {
    const allowed =
      isAdmin(user) ||
      meeting.createdBy === user?.id ||
      meeting.secretaryId === user?.id ||
      !!user?.permissions?.includes('meetings:manage:Minutes');
    if (!allowed) {
      throw new ForbiddenException('เฉพาะผู้สร้างการประชุม เลขานุการ หรือผู้ดูแลระบบเท่านั้นที่ดำเนินการได้');
    }
  }

  /** นัดประชุมของฉัน (ประธาน/เลขาฯ/ผู้เข้าร่วม) ที่กำลังจะถึง — โปรไฟล์ */
  async myUpcoming(orgId: string, userId: string) {
    return this.meetingRepo.query(
      `SELECT DISTINCT m.id, m.title, m.start_datetime AS "startDatetime", m.location,
              m.is_online AS "isOnline", m.status, m.meeting_url AS "meetingUrl"
       FROM meetings m
       LEFT JOIN meeting_attendees a ON a.meeting_id = m.id AND a.user_id = $2
       WHERE m.organization_id = $1
         AND (m.chair_id = $2 OR m.secretary_id = $2 OR a.user_id = $2)
         AND m.start_datetime >= (NOW() - interval '2 hours')
         AND m.status <> 'ยกเลิก'
       ORDER BY m.start_datetime ASC LIMIT 10`,
      [orgId, userId],
    );
  }

  async findAll(orgId: string, dto: PaginationDto & { status?: string }, user: any) {
    const base: FindOptionsWhere<Meeting> = { organizationId: orgId };
    if (dto.status) base.status = dto.status;

    let where: FindOptionsWhere<Meeting>[] | FindOptionsWhere<Meeting> = dto.search
      ? [
          { ...base, title: ILike(`%${dto.search}%`) },
          { ...base, meetingNumber: ILike(`%${dto.search}%`) },
        ]
      : base;

    // ผู้ที่ไม่มีสิทธิ์ดูทั้งหมด เห็นเฉพาะการประชุมที่ตัวเองถูกเชิญ
    if (!this.canSeeAll(user)) {
      const attended = await this.attendeeRepo.find({ where: { userId: user?.id } });
      const ids = attended.map(a => a.meetingId);
      if (ids.length === 0) return paginate([], 0, dto);
      const idIn = In(ids);
      where = Array.isArray(where)
        ? where.map(w => ({ ...w, id: idIn }))
        : { ...where, id: idIn };
    }

    const [data, total] = await this.meetingRepo.findAndCount({
      where,
      relations: ['chair', 'department'],
      skip: dto.skip,
      take: dto.limit,
      order: { startDatetime: 'DESC' },
    });
    return paginate(data, total, dto);
  }

  async findOne(id: string, orgId: string, user?: any) {
    const m = await this.meetingRepo.findOne({
      where: { id, organizationId: orgId },
      relations: ['chair', 'secretary', 'department'],
    });
    if (!m) throw new NotFoundException('ไม่พบการประชุม');
    // ตรวจสิทธิ์การดู เฉพาะเมื่อเรียกจาก endpoint ที่ส่ง user มา
    if (user && !this.canSeeAll(user)) {
      const att = await this.attendeeRepo.findOne({ where: { meetingId: id, userId: user.id } });
      if (!att) throw new ForbiddenException('คุณไม่ได้รับเชิญเข้าร่วมการประชุมนี้');
    }
    return m;
  }

  async create(dto: any, orgId: string, userId: string) {
    const year = getCurrentThaiYear();
    const seq = await this.sequences.next(orgId, 'MEETING', { table: 'meetings', column: 'meeting_number' });
    const meetingNumber = `MTG-${year}-${String(seq).padStart(4, '0')}`;

    const meeting = await this.meetingRepo.save({
      ...dto,
      organizationId: orgId,
      createdBy: userId,
      meetingNumber,
      // ถ้าไม่ระบุประธาน → ผู้สร้างเป็นประธาน (chair_id เป็น NOT NULL) กัน 500
      chairId: dto.chairId || userId,
      status: dto.status || 'กำหนดการ',
    });

    // เพิ่มผู้สร้าง + ประธาน + เลขานุการ เป็นผู้เข้าร่วม (ไม่ซ้ำ) แล้วแจ้งเตือนคนที่ถูกเลือก
    const creatorIsChair = !dto.chairId || dto.chairId === userId;
    const people = new Map<string, string>(); // userId -> role
    people.set(userId, creatorIsChair ? 'ประธาน' : 'ผู้จัดประชุม');
    if (dto.chairId && dto.chairId !== userId) people.set(dto.chairId, 'ประธาน');
    if (dto.secretaryId && !people.has(dto.secretaryId)) people.set(dto.secretaryId, 'เลขานุการ');

    for (const [uid, role] of people) {
      await this.attendeeRepo.upsert(
        { meetingId: meeting.id, userId: uid, role, isConfirmed: uid === userId },
        ['meetingId', 'userId'],
      );
      if (uid !== userId) {
        await this.notificationsService.createNotification({
          organizationId: orgId,
          recipientId: uid,
          type: 'meeting:invite',
          title: `คุณได้รับมอบหมายเป็น${role}ในการประชุม`,
          body: meeting.title,
          refType: 'meeting', refId: meeting.id,
          actionUrl: `/meetings/${meeting.id}`,
        });
      }
    }
    return meeting;
  }

  async update(id: string, dto: any, orgId: string, user: any) {
    const m = await this.findOne(id, orgId);
    this.assertCanManage(m, user);
    Object.assign(m, dto);
    return this.meetingRepo.save(m);
  }

  /** เริ่มประชุม → สถานะ "กำลังประชุม" */
  async startMeeting(id: string, orgId: string, user: any) {
    const m = await this.findOne(id, orgId);
    this.assertCanManage(m, user);
    if (m.status === 'เสร็จสิ้น') throw new BadRequestException('การประชุมนี้สิ้นสุดแล้ว');
    if (m.status === 'ยกเลิก') throw new BadRequestException('การประชุมนี้ถูกยกเลิกแล้ว');
    await this.meetingRepo.update(id, { status: 'กำลังประชุม', actualStart: m.actualStart ?? new Date() });
    return { message: 'เริ่มการประชุมแล้ว' };
  }

  /** สิ้นสุดประชุม → สถานะ "เสร็จสิ้น" */
  async finishMeeting(id: string, orgId: string, user: any) {
    const m = await this.findOne(id, orgId);
    this.assertCanManage(m, user);
    if (m.status === 'เสร็จสิ้น') throw new BadRequestException('การประชุมนี้สิ้นสุดแล้ว');
    await this.meetingRepo.update(id, { status: 'เสร็จสิ้น', actualEnd: new Date() });
    return { message: 'สิ้นสุดการประชุมแล้ว' };
  }

  async cancel(id: string, orgId: string, user: any) {
    const m = await this.findOne(id, orgId);
    this.assertCanManage(m, user);
    await this.meetingRepo.update(id, { status: 'ยกเลิก' });
    return { message: 'ยกเลิกการประชุมสำเร็จ' };
  }

  async remove(id: string, orgId: string, user: any) {
    const m = await this.findOne(id, orgId);
    assertCanModify(m, user, 'meetings:delete:Meeting');
    await this.meetingRepo.softDelete(id);
    return { message: 'ลบการประชุมสำเร็จ' };
  }

  async inviteAttendees(id: string, orgId: string, userIds: string[], user: any) {
    const m = await this.findOne(id, orgId);
    this.assertCanManage(m, user);
    const toSave = userIds.map(uid => ({ meetingId: id, userId: uid, role: 'ผู้เข้าร่วม' }));
    await this.attendeeRepo.upsert(toSave, ['meetingId', 'userId']);

    for (const uid of userIds) {
      await this.notificationsService.createNotification({
        organizationId: orgId,
        recipientId: uid,
        type: 'meeting:invite',
        title: 'คุณได้รับเชิญเข้าร่วมประชุม',
        body: m.title,
        refType: 'meeting', refId: id,
        actionUrl: `/meetings/${id}`,
      });
    }
    return { message: 'ส่งคำเชิญสำเร็จ' };
  }

  async confirmAttendance(meetingId: string, userId: string) {
    await this.attendeeRepo.update({ meetingId, userId }, { isConfirmed: true, confirmedAt: new Date() });
    return { message: 'ยืนยันการเข้าร่วมสำเร็จ' };
  }

  async getAttendees(meetingId: string) {
    return this.attendeeRepo.find({
      where: { meetingId },
      relations: ['user', 'user.department'],
      order: { role: 'ASC' },
    });
  }

  async getAgenda(meetingId: string) {
    return this.agendaRepo.find({
      where: { meetingId },
      relations: ['presenter'],
      order: { orderNo: 'ASC' },
    });
  }

  async addAgendaItem(meetingId: string, dto: any, orgId: string, user: any) {
    const m = await this.findOne(meetingId, orgId);
    this.assertCanManage(m, user);
    const count = await this.agendaRepo.count({ where: { meetingId } });
    return this.agendaRepo.save({ ...dto, meetingId, orderNo: count + 1 });
  }

  async getResolutions(meetingId: string) {
    return this.resolutionRepo.find({
      where: { meetingId },
      relations: ['responsible', 'agendaItem'],
      order: { orderNo: 'ASC' },
    });
  }

  async addResolution(meetingId: string, dto: any, orgId: string, user: any) {
    const m = await this.findOne(meetingId, orgId);
    this.assertCanManage(m, user);
    const count = await this.resolutionRepo.count({ where: { meetingId } });
    return this.resolutionRepo.save({ ...dto, meetingId, orderNo: count + 1 });
  }

  async saveMinutes(id: string, orgId: string, minutesText: string, user: any) {
    const m = await this.findOne(id, orgId);
    this.assertCanManage(m, user);
    await this.meetingRepo.update(id, { minutesText });
    return { message: 'บันทึกรายงานการประชุมสำเร็จ' };
  }
}
