import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HrController } from './hr.controller';
import { HrService } from './hr.service';
import { Employee } from '../../database/entities/employee.entity';
import { EmployeePosition } from '../../database/entities/employee-position.entity';
import { EmployeeEducation } from '../../database/entities/employee-education.entity';
import { EmployeeTraining } from '../../database/entities/employee-training.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Employee, EmployeePosition, EmployeeEducation, EmployeeTraining])],
  controllers: [HrController],
  providers: [HrService],
  exports: [HrService],
})
export class HrModule {}
