import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Role } from '../../database/entities/role.entity';
import { Permission } from '../../database/entities/permission.entity';
import { RolePermission } from '../../database/entities/role-permission.entity';

@Injectable()
export class RbacService {
  constructor(
    @InjectRepository(Role) private roleRepo: Repository<Role>,
    @InjectRepository(Permission) private permRepo: Repository<Permission>,
    @InjectRepository(RolePermission) private rolePermRepo: Repository<RolePermission>,
  ) {}

  async getRoles(orgId?: string) {
    const where: any[] = [{ isSystem: true }];
    if (orgId) where.push({ organizationId: orgId });
    return this.roleRepo.find({ where, order: { level: 'ASC', nameTh: 'ASC' } });
  }

  async getRole(id: string) {
    const role = await this.roleRepo.findOne({ where: { id } });
    if (!role) throw new NotFoundException('ไม่พบบทบาท');
    return role;
  }

  async createRole(dto: any, orgId: string) {
    return this.roleRepo.save({ ...dto, organizationId: orgId });
  }

  async updateRole(id: string, dto: any) {
    const role = await this.roleRepo.findOne({ where: { id } });
    if (!role) throw new NotFoundException('ไม่พบบทบาท');
    if (role.isSystem) throw new ConflictException('ไม่สามารถแก้ไข System Role ได้');
    Object.assign(role, dto);
    return this.roleRepo.save(role);
  }

  async getRolePermissions(roleId: string) {
    return this.rolePermRepo.find({
      where: { roleId },
      relations: ['permission'],
    });
  }

  async assignPermission(roleId: string, permissionId: string) {
    const existing = await this.rolePermRepo.findOne({ where: { roleId, permissionId } });
    if (existing) throw new ConflictException('บทบาทนี้มีสิทธิ์นี้อยู่แล้ว');
    return this.rolePermRepo.save({ roleId, permissionId });
  }

  async removePermission(roleId: string, permissionId: string) {
    await this.rolePermRepo.delete({ roleId, permissionId });
    return { message: 'ถอดสิทธิ์สำเร็จ' };
  }

  async getPermissions(module?: string) {
    const where: any = {};
    if (module) where.module = module;
    return this.permRepo.find({ where, order: { module: 'ASC', action: 'ASC' } });
  }
}
