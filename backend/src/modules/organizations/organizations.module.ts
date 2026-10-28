import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrganizationsController } from './organizations.controller';
import { OrganizationsService } from './organizations.service';
import { Organization } from '../../database/entities/organization.entity';
import { Department } from '../../database/entities/department.entity';
import { Division } from '../../database/entities/division.entity';
import { User } from '../../database/entities/user.entity';
import { UserRole } from '../../database/entities/user-role.entity';
import { Role } from '../../database/entities/role.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Organization, Department, Division, User, UserRole, Role])],
  controllers: [OrganizationsController],
  providers: [OrganizationsService],
  exports: [OrganizationsService],
})
export class OrganizationsModule {}
