import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Organization } from '../../database/entities/organization.entity';
import { PayConfig, readPayConfig } from './pay-config';

/** ค่าที่ส่งให้หน้าเจ้าหน้าที่: ไม่ส่งโทเคนกลับ (บอกแค่ว่าตั้งแล้วหรือยัง) */
export type StaffPayConfig = Omit<PayConfig, 'slipToken'> & { slipTokenSet: boolean };

@Injectable()
export class PayConfigService {
  constructor(@InjectRepository(Organization) private readonly orgs: Repository<Organization>) {}

  /** ค่าเต็ม (ภายในระบบเท่านั้น — มีโทเคน) */
  async get(orgId: string): Promise<PayConfig> {
    const org = await this.orgs.findOne({ where: { id: orgId }, select: { id: true, metadata: true } });
    return readPayConfig(org?.metadata);
  }

  /** ค่าสำหรับหน้าเจ้าหน้าที่ (ไม่มีโทเคน) */
  async getForStaff(orgId: string): Promise<StaffPayConfig> {
    const { slipToken, ...rest } = await this.get(orgId);
    return { ...rest, slipTokenSet: !!slipToken };
  }

  /**
   * บันทึกเฉพาะฟิลด์ที่ส่งมา — ไม่แตะ metadata ส่วนอื่น
   * slipToken: ไม่ส่ง = คงของเดิม · ส่งค่าว่าง = ลบโทเคน · ส่งค่า = ตั้งใหม่
   */
  async save(orgId: string, input: Partial<PayConfig>): Promise<StaffPayConfig> {
    const org = await this.orgs.findOne({ where: { id: orgId } });
    if (!org) throw new NotFoundException('ไม่พบหน่วยงาน');
    const given = Object.fromEntries(Object.entries(input).filter(([, v]) => v !== undefined));
    const next = readPayConfig({ payment: { ...readPayConfig(org.metadata), ...given } });
    org.metadata = { ...(org.metadata || {}), payment: next };
    await this.orgs.save(org);
    const { slipToken, ...rest } = next;
    return { ...rest, slipTokenSet: !!slipToken };
  }
}
