import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { SystemSetting } from '../../database/entities/system-setting.entity';

@Injectable()
export class SettingsService {
  constructor(
    @InjectRepository(SystemSetting) private repo: Repository<SystemSetting>,
  ) {}

  async findAll(orgId: string) {
    const rows = await this.repo.find({
      where: [{ organizationId: orgId }, { organizationId: IsNull() }],
      order: { key: 'ASC' },
    });
    // ยุบให้เหลือ key ละ 1 แถว — เลือกค่าเฉพาะ org ก่อน global (กันแถวซ้ำโผล่ 2 บรรทัด)
    const byKey = new Map<string, SystemSetting>();
    for (const r of rows) {
      const existing = byKey.get(r.key);
      if (!existing || (r.organizationId && !existing.organizationId)) byKey.set(r.key, r);
    }
    return [...byKey.values()].map((r) => this.transform(r));
  }

  /**
   * อ่านค่า setting มาใช้ในโค้ด — คืน null ถ้าไม่มี
   * ⚠ ค่าเดียวกันมีได้ทั้งแถว global (organization_id = null) และแถวขององค์กร
   *   ต้องเลือกแถวขององค์กรก่อนเสมอ ไม่งั้นแก้ค่าในหน้าตั้งค่าแล้วโค้ดยังอ่านค่าเดิม
   *   (ไม่ระบุ orgId = ระบบไม่มีบริบทองค์กร เช่นงานเบื้องหลัง → ใช้ค่าขององค์กรใดก็ได้ที่ตั้งไว้ก่อน global)
   */
  async getValue(key: string, orgId?: string): Promise<string | null> {
    if (orgId) {
      const own = await this.repo.findOne({ where: { key, organizationId: orgId } });
      if (own) return own.value;
    }
    const rows = await this.repo.find({ where: { key } });
    const scoped = rows.find((r) => r.organizationId);
    return (scoped ?? rows[0])?.value ?? null;
  }

  async findOne(key: string, orgId: string) {
    const row = await this.repo.findOne({
      where: [{ key, organizationId: orgId }, { key, organizationId: IsNull() }],
    });
    if (!row) throw new NotFoundException(`ไม่พบการตั้งค่า: ${key}`);
    return this.transform(row);
  }

  async update(key: string, value: string, orgId: string, userId: string) {
    let row = await this.repo.findOne({ where: { key, organizationId: orgId } });
    if (!row) {
      const global = await this.repo.findOne({ where: [{ key, organizationId: orgId }, { key, organizationId: IsNull() }] });
      if (!global) throw new NotFoundException(`ไม่พบการตั้งค่า: ${key}`);
      row = this.repo.create({
        key,
        organizationId: orgId,
        value,
        description: global.description,
        isPublic: global.isPublic,
        updatedBy: userId,
      });
    } else {
      row.value = value;
      row.updatedBy = userId;
    }
    await this.repo.save(row);
    return this.transform(row);
  }

  private transform(r: SystemSetting) {
    const settingType = r.value === 'true' || r.value === 'false' ? 'boolean' : 'text';
    return {
      id: r.id,
      settingKey: r.key,
      settingValue: r.value,
      settingType,
      description: r.description,
      isPublic: r.isPublic,
      updatedAt: r.updatedAt,
    };
  }
}
