import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike, FindOptionsWhere } from 'typeorm';
import { Employee } from '../../database/entities/employee.entity';
import { EmployeePosition } from '../../database/entities/employee-position.entity';
import { EmployeeEducation } from '../../database/entities/employee-education.entity';
import { EmployeeTraining } from '../../database/entities/employee-training.entity';
import { paginate, PaginationDto } from '../../common/dto/pagination.dto';

@Injectable()
export class HrService {
  constructor(
    @InjectRepository(Employee) private employeeRepo: Repository<Employee>,
    @InjectRepository(EmployeePosition) private positionRepo: Repository<EmployeePosition>,
    @InjectRepository(EmployeeEducation) private educationRepo: Repository<EmployeeEducation>,
    @InjectRepository(EmployeeTraining) private trainingRepo: Repository<EmployeeTraining>,
  ) {}

  async findAllEmployees(orgId: string, dto: PaginationDto & { status?: string; deptId?: string }) {
    const base: FindOptionsWhere<Employee> = { organizationId: orgId };
    if (dto.status) base.status = dto.status;
    if (dto.deptId) base.departmentId = dto.deptId;

    const where: FindOptionsWhere<Employee>[] | FindOptionsWhere<Employee> = dto.search
      ? [
          { ...base, firstNameTh: ILike(`%${dto.search}%`) },
          { ...base, lastNameTh: ILike(`%${dto.search}%`) },
          { ...base, employeeCode: ILike(`%${dto.search}%`) },
        ]
      : base;

    const [data, total] = await this.employeeRepo.findAndCount({
      where,
      relations: ['department', 'division', 'position'],
      skip: dto.skip,
      take: dto.limit,
      order: { firstNameTh: 'ASC' },
    });
    return paginate(data, total, dto);
  }

  async findOneEmployee(id: string, orgId: string) {
    const emp = await this.employeeRepo.findOne({
      where: { id, organizationId: orgId },
      relations: ['department', 'division', 'position', 'user'],
    });
    if (!emp) throw new NotFoundException('ไม่พบข้อมูลพนักงาน');
    return emp;
  }

  /** บัญชีผู้ใช้หนึ่งผูกกับพนักงานได้คนเดียว (employees.user_id UNIQUE) — เช็กก่อนกัน 500 จาก DB */
  private async assertUserNotLinked(userId: string, exceptEmployeeId?: string) {
    const linked = await this.employeeRepo.findOne({ where: { userId } });
    if (linked && linked.id !== exceptEmployeeId) {
      throw new ConflictException(`บัญชีผู้ใช้นี้ถูกผูกกับพนักงาน ${linked.firstNameTh} ${linked.lastNameTh} อยู่แล้ว`);
    }
  }

  async createEmployee(dto: any, orgId: string) {
    const conditions: any[] = [];
    if (dto.nationalId) conditions.push({ nationalId: dto.nationalId });
    if (dto.employeeCode) conditions.push({ employeeCode: dto.employeeCode });
    if (conditions.length) {
      const existing = await this.employeeRepo.findOne({ where: conditions });
      if (existing) throw new ConflictException('รหัสพนักงานหรือเลขบัตรประชาชนซ้ำ');
    }
    if (dto.userId) await this.assertUserNotLinked(dto.userId);
    // national_id เป็น VARCHAR(13) — placeholder ต้องไม่เกิน 13 ตัว (Date.now() ได้ 13 หลักพอดี)
    if (!dto.nationalId) dto.nationalId = String(Date.now());
    if (!dto.employeeCode) dto.employeeCode = `EMP-${Date.now()}`;
    return this.employeeRepo.save({ ...dto, organizationId: orgId });
  }

  async updateEmployee(id: string, dto: any, orgId: string) {
    const emp = await this.findOneEmployee(id, orgId);
    if (dto.userId) await this.assertUserNotLinked(dto.userId, id);
    Object.assign(emp, dto);
    return this.employeeRepo.save(emp);
  }

  async removeEmployee(id: string, orgId: string) {
    const emp = await this.findOneEmployee(id, orgId);
    await this.employeeRepo.softDelete(id);
    return { message: 'ลบข้อมูลพนักงานสำเร็จ' };
  }

  async getEducation(employeeId: string) {
    return this.educationRepo.find({ where: { employeeId }, order: { graduationYear: 'DESC' } });
  }

  async addEducation(employeeId: string, dto: any) {
    return this.educationRepo.save({ ...dto, employeeId });
  }

  async getTraining(employeeId: string) {
    return this.trainingRepo.find({ where: { employeeId }, order: { startDate: 'DESC' } });
  }

  async addTraining(employeeId: string, dto: any) {
    return this.trainingRepo.save({ ...dto, employeeId });
  }

  async getPositions(orgId: string) {
    return this.positionRepo.find({ where: { organizationId: orgId, isActive: true }, order: { level: 'ASC' } });
  }
}
