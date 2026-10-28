import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { WaterUser } from '../../../database/entities/water-user.entity';
import { Organization } from '../../../database/entities/organization.entity';
import { comparePassword, hashPassword } from '../../../common/utils/hash.util';
import { loadOrgIdentity } from '../org-identity';

/** ล็อกอิน/โปรไฟล์ ของบัญชีระบบประปา (แยกจากระบบหลัก) */
@Injectable()
export class WaterAuthService {
  constructor(
    @InjectRepository(WaterUser) private repo: Repository<WaterUser>,
    @InjectRepository(Organization) private orgRepo: Repository<Organization>,
    private jwt: JwtService,
  ) {}

  private sanitize(u: WaterUser) {
    const { passwordHash, ...rest } = u as any;
    return rest;
  }

  async login(orgCode: string, username: string, password: string) {
    const org = await this.orgRepo.findOne({ where: { code: orgCode?.trim() } as any });
    if (!org) throw new UnauthorizedException('ไม่พบรหัสองค์กร');
    const user = await this.repo.findOne({ where: { organizationId: (org as any).id, username: username?.trim() } });
    if (!user || !user.active) throw new UnauthorizedException('บัญชีไม่ถูกต้องหรือถูกระงับ');
    if (!(await comparePassword(password, user.passwordHash))) throw new UnauthorizedException('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');
    user.lastLoginAt = new Date();
    await this.repo.save(user);
    const token = await this.jwt.signAsync(
      { sub: user.id, org: user.organizationId, username: user.username, role: user.role, caps: user.caps || [], typ: 'water' },
      { expiresIn: '12h' }, // ประปาไม่มี refresh token → อายุยาวพอ 1 วันทำงาน (login เช้าครั้งเดียว เหมาะงานภาคสนาม/ออฟไลน์)
    );
    return { accessToken: token, user: this.sanitize(user) };
  }

  async me(userId: string) {
    const u = await this.repo.findOne({ where: { id: userId } });
    if (!u) throw new UnauthorizedException('ไม่พบบัญชี');
    return this.sanitize(u);
  }

  /** ชื่อ/โลโก้หน่วยงาน — เลือกเฉพาะฟิลด์ที่ต้องโชว์ (ไม่ส่ง entity ทั้งก้อน) */
  /** ข้อมูลหน่วยงาน (รวมค่าที่ตั้งเองในประปาแล้ว) + ค่าดิบจากระบบหลักไว้เป็น placeholder หน้าตั้งค่า */
  async org(orgId: string) {
    const o = await this.orgRepo.findOne({ where: { id: orgId } });
    if (!o) throw new UnauthorizedException('ไม่พบหน่วยงาน');
    const merged = await loadOrgIdentity(this.orgRepo, orgId);
    const { nameTh, phone, logoUrl, subDistrict, district, province } = o as any;
    const mainAddress = [subDistrict && `ต.${subDistrict}`, district && `อ.${district}`, province && `จ.${province}`].filter(Boolean).join(' ');
    return { ...merged, main: { nameTh, phone, logoUrl: logoUrl || null, address: mainAddress } };
  }

  async changePassword(userId: string, oldPw: string, newPw: string) {
    const u = await this.repo.findOne({ where: { id: userId } });
    if (!u) throw new UnauthorizedException('ไม่พบบัญชี');
    if (!(await comparePassword(oldPw, u.passwordHash))) throw new BadRequestException('รหัสผ่านเดิมไม่ถูกต้อง');
    if (!newPw || newPw.length < 6) throw new BadRequestException('รหัสผ่านใหม่ต้องอย่างน้อย 6 ตัวอักษร');
    u.passwordHash = await hashPassword(newPw);
    await this.repo.save(u);
    return { ok: true };
  }
}
