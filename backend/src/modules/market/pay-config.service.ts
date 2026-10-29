import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Organization } from '../../database/entities/organization.entity';
import { PayConfig, readPayConfig } from './pay-config';

@Injectable()
export class PayConfigService {
  constructor(@InjectRepository(Organization) private readonly orgs: Repository<Organization>) {}

  async get(orgId: string): Promise<PayConfig> {
    const org = await this.orgs.findOne({ where: { id: orgId }, select: { id: true, metadata: true } });
    return readPayConfig(org?.metadata);
  }

  /** บันทึกเฉพาะฟิลด์ที่รู้จัก (ผ่าน readPayConfig) — ไม่แตะ metadata ส่วนอื่น */
  async save(orgId: string, input: Partial<PayConfig>): Promise<PayConfig> {
    const org = await this.orgs.findOne({ where: { id: orgId } });
    if (!org) throw new NotFoundException('ไม่พบหน่วยงาน');
    const next = readPayConfig({ payment: { ...readPayConfig(org.metadata), ...input } });
    org.metadata = { ...(org.metadata || {}), payment: next };
    await this.orgs.save(org);
    return next;
  }
}
