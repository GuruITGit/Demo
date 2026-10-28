import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { User } from '../../../database/entities/user.entity';
import { UserRole } from '../../../database/entities/user-role.entity';
import { RolePermission } from '../../../database/entities/role-permission.entity';
import { UserPermission } from '../../../database/entities/user-permission.entity';

export interface JwtPayload {
  sub: string;
  username: string;
  orgId: string;
  iat?: number;
  exp?: number;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(UserRole) private userRoleRepo: Repository<UserRole>,
    @InjectRepository(RolePermission) private rolePermRepo: Repository<RolePermission>,
    @InjectRepository(UserPermission) private userPermRepo: Repository<UserPermission>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('jwt.secret'),
    });
  }

  async validate(payload: JwtPayload) {
    const user = await this.userRepo.findOne({
      where: { id: payload.sub, isActive: true },
      select: ['id', 'username', 'email', 'fullNameTh', 'organizationId', 'departmentId', 'divisionId', 'isActive', 'lockedUntil'],
    });

    if (!user) throw new UnauthorizedException('Token ไม่ถูกต้อง');
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new UnauthorizedException('บัญชีถูกระงับชั่วคราว');
    }

    const userRoles = await this.userRoleRepo.find({
      where: { userId: user.id },
      relations: ['role'],
    });

    const roleNames = userRoles.map((ur) => ur.role.name);
    const roleIds = userRoles.map((ur) => ur.roleId);

    // helper: รวม permission ของทุก role ในคิวรีเดียว (เลี่ยง N+1 ต่อ request)
    const loadRolePermissions = async (): Promise<string[]> => {
      if (roleIds.length === 0) return [];
      const rolePerms = await this.rolePermRepo.find({
        where: { roleId: In(roleIds) },
        relations: ['permission'],
      });
      return [...new Set(rolePerms.map(
        (rp) => `${rp.permission.module}:${rp.permission.action}:${rp.permission.subject}`,
      ))];
    };

    // SUPER_ADMIN bypasses all permission checks
    if (roleNames.includes('SUPER_ADMIN')) {
      return { ...user, roles: roleNames, permissions: await loadRolePermissions() };
    }

    // สิทธิ์ = สิทธิ์ของบทบาท ∪ สิทธิ์เพิ่มรายคน (override เพิ่มได้อย่างเดียว — ไม่บดบัง role อีกต่อไป)
    const directPerms = await this.userPermRepo.find({
      where: { userId: user.id },
      relations: ['permission'],
    });
    const directPermStrings = directPerms.map(
      (p) => `${p.permission.module}:${p.permission.action}:${p.permission.subject}`,
    );
    const rolePermStrings = await loadRolePermissions();
    return { ...user, roles: roleNames, permissions: [...new Set([...rolePermStrings, ...directPermStrings])] };
  }
}
