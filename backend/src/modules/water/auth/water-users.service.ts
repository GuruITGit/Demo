import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WaterUser, WaterRole, WaterCap, WATER_CAPS, ROLE_CAPS } from '../../../database/entities/water-user.entity';
import { hashPassword } from '../../../common/utils/hash.util';

const ROLES: WaterRole[] = ['admin', 'reader', 'cashier', 'viewer'];
const cleanCaps = (caps?: any): WaterCap[] =>
  Array.isArray(caps) ? (caps.filter((c: any) => (WATER_CAPS as readonly string[]).includes(c)) as WaterCap[]) : [];

/** จัดการบัญชีผู้ใช้ระบบประปา (เฉพาะ admin) */
@Injectable()
export class WaterUsersService {
  constructor(@InjectRepository(WaterUser) private repo: Repository<WaterUser>) {}

  private sanitize(u: WaterUser) { const { passwordHash, ...rest } = u as any; return rest; }

  async list(orgId: string) {
    const rows = await this.repo.find({ where: { organizationId: orgId }, order: { createdAt: 'ASC' } });
    return rows.map((u) => this.sanitize(u));
  }

  async create(orgId: string, dto: any) {
    const username = dto.username?.trim();
    if (!username) throw new BadRequestException('กรุณากรอกชื่อผู้ใช้');
    if (!dto.fullName?.trim()) throw new BadRequestException('กรุณากรอกชื่อ-สกุล');
    if (!dto.password || String(dto.password).length < 6) throw new BadRequestException('รหัสผ่านต้องอย่างน้อย 6 ตัวอักษร');
    const dup = await this.repo.findOne({ where: { organizationId: orgId, username } });
    if (dup) throw new ConflictException(`ชื่อผู้ใช้ "${username}" มีอยู่แล้ว`);
    const role: WaterRole = ROLES.includes(dto.role) ? dto.role : 'reader';
    const caps = dto.caps !== undefined ? cleanCaps(dto.caps) : ROLE_CAPS[role];
    const u = this.repo.create({
      organizationId: orgId, username, fullName: dto.fullName.trim(), phone: dto.phone?.trim() || null,
      role, caps, active: dto.active ?? true, passwordHash: await hashPassword(dto.password),
    } as any) as unknown as WaterUser;
    return this.sanitize(await this.repo.save(u));
  }

  async update(id: string, orgId: string, dto: any) {
    const u = await this.repo.findOne({ where: { id, organizationId: orgId } });
    if (!u) throw new NotFoundException('ไม่พบบัญชี');
    if (dto.fullName !== undefined) u.fullName = dto.fullName.trim();
    if (dto.phone !== undefined) u.phone = dto.phone?.trim() || null;
    if (dto.role !== undefined && ROLES.includes(dto.role)) u.role = dto.role;
    if (dto.caps !== undefined) u.caps = cleanCaps(dto.caps);
    if (dto.active !== undefined) u.active = !!dto.active;
    if (dto.password) {
      if (String(dto.password).length < 6) throw new BadRequestException('รหัสผ่านต้องอย่างน้อย 6 ตัวอักษร');
      u.passwordHash = await hashPassword(dto.password);
    }
    return this.sanitize(await this.repo.save(u));
  }

  async remove(id: string, orgId: string, currentUserId: string) {
    if (id === currentUserId) throw new BadRequestException('ลบบัญชีตัวเองไม่ได้');
    const u = await this.repo.findOne({ where: { id, organizationId: orgId } });
    if (!u) throw new NotFoundException('ไม่พบบัญชี');
    await this.repo.remove(u);
    return { ok: true };
  }
}
