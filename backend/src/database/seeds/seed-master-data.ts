import { DataSource } from 'typeorm';
import { LeaveType } from '../entities/leave-type.entity';
import { DocumentCategory } from '../entities/document-category.entity';
import { AssetCategory } from '../entities/asset-category.entity';
import { ComplaintCategory } from '../entities/complaint-category.entity';
import { ApprovalRequestType } from '../entities/approval-request-type.entity';
import { SystemSetting } from '../entities/system-setting.entity';

export async function seedMasterData(dataSource: DataSource): Promise<void> {
  // Leave Types
  const leaveRepo = dataSource.getRepository(LeaveType);
  const leaveTypes = [
    { code: 'ANNUAL', nameTh: 'ลาพักผ่อน', maxDaysYear: 10, requiresDoc: false, advanceDays: 3 },
    { code: 'SICK', nameTh: 'ลาป่วย', maxDaysYear: 30, requiresDoc: false, advanceDays: 0 },
    { code: 'SICK_HEAVY', nameTh: 'ลาป่วยหนัก', maxDaysYear: 180, requiresDoc: true, advanceDays: 0 },
    { code: 'PERSONAL', nameTh: 'ลากิจส่วนตัว', maxDaysYear: 5, requiresDoc: false, advanceDays: 1 },
    { code: 'MATERNITY', nameTh: 'ลาคลอดบุตร', maxDaysYear: 98, requiresDoc: true, advanceDays: 0 },
    { code: 'ORDINATION', nameTh: 'ลาอุปสมบท', maxDaysYear: 120, requiresDoc: true, advanceDays: 60 },
    { code: 'MILITARY', nameTh: 'ลาฝึกวิชาทหาร', maxDaysYear: 60, requiresDoc: true, advanceDays: 0 },
    { code: 'PUBLIC', nameTh: 'ลาไปปฏิบัติงานสาธารณะ', maxDaysYear: 30, requiresDoc: true, advanceDays: 3 },
    { code: 'STUDY', nameTh: 'ลาเพื่อการศึกษา', maxDaysYear: 365, requiresDoc: true, advanceDays: 30 },
    { code: 'HALF_DAY_MORNING', nameTh: 'ลาครึ่งวันเช้า', maxDaysYear: null, requiresDoc: false, advanceDays: 0 },
    { code: 'HALF_DAY_AFTERNOON', nameTh: 'ลาครึ่งวันบ่าย', maxDaysYear: null, requiresDoc: false, advanceDays: 0 },
  ];
  for (const lt of leaveTypes) {
    const exists = await leaveRepo.findOne({ where: { code: lt.code } });
    if (!exists) await leaveRepo.save(leaveRepo.create(lt));
  }
  console.log('  Leave types seeded');

  // Document Categories
  const docCatRepo = dataSource.getRepository(DocumentCategory);
  const docCategories = [
    { code: 'GENERAL', nameTh: 'หนังสือทั่วไป', icon: 'file-text', color: '#6366f1' },
    { code: 'REGULATION', nameTh: 'กฎหมายและระเบียบ', icon: 'scale', color: '#0ea5e9' },
    { code: 'BUDGET', nameTh: 'งบประมาณและการเงิน', icon: 'banknote', color: '#22c55e' },
    { code: 'HR', nameTh: 'ด้านบุคลากร', icon: 'users', color: '#f97316' },
    { code: 'PROCUREMENT', nameTh: 'จัดซื้อจัดจ้าง', icon: 'shopping-cart', color: '#a855f7' },
    { code: 'DEVELOPMENT', nameTh: 'โครงการพัฒนา', icon: 'building', color: '#14b8a6' },
    { code: 'MEETING', nameTh: 'รายงานการประชุม', icon: 'calendar', color: '#f43f5e' },
    { code: 'REPORT', nameTh: 'รายงาน', icon: 'bar-chart', color: '#84cc16' },
    { code: 'CORRESPONDENCE', nameTh: 'หนังสือโต้ตอบ', icon: 'mail', color: '#eab308' },
    { code: 'ARCHIVE', nameTh: 'เอกสารเก็บถาวร', icon: 'archive', color: '#64748b' },
  ];
  for (const dc of docCategories) {
    const exists = await docCatRepo.findOne({ where: { code: dc.code } });
    if (!exists) await docCatRepo.save(docCatRepo.create(dc));
  }
  console.log('  Document categories seeded');

  // Asset Categories
  const assetCatRepo = dataSource.getRepository(AssetCategory);
  const assetCategories = [
    { code: 'LAND', nameTh: 'ที่ดิน', depreciationYears: 0 },
    { code: 'BUILDING', nameTh: 'อาคารและสิ่งก่อสร้าง', depreciationYears: 20 },
    { code: 'VEHICLE', nameTh: 'ยานพาหนะ', depreciationYears: 10 },
    { code: 'COMPUTER', nameTh: 'คอมพิวเตอร์และอุปกรณ์', depreciationYears: 5 },
    { code: 'FURNITURE', nameTh: 'เฟอร์นิเจอร์และครุภัณฑ์สำนักงาน', depreciationYears: 5 },
    { code: 'EQUIPMENT', nameTh: 'เครื่องมือและอุปกรณ์', depreciationYears: 5 },
    { code: 'ELECTRICAL', nameTh: 'ครุภัณฑ์ไฟฟ้า', depreciationYears: 10 },
    { code: 'SPORTS', nameTh: 'ครุภัณฑ์กีฬา', depreciationYears: 5 },
    { code: 'MEDICAL', nameTh: 'ครุภัณฑ์สาธารณสุข', depreciationYears: 10 },
    { code: 'OTHER', nameTh: 'ครุภัณฑ์อื่น', depreciationYears: 5 },
  ];
  for (const ac of assetCategories) {
    const exists = await assetCatRepo.findOne({ where: { code: ac.code } });
    if (!exists) await assetCatRepo.save(assetCatRepo.create(ac));
  }
  console.log('  Asset categories seeded');

  // Complaint Categories
  const complaintCatRepo = dataSource.getRepository(ComplaintCategory);
  const complaintCategories = [
    { code: 'ROAD', nameTh: 'ถนนและทางเท้า', icon: 'road', color: '#f97316', slaDays: 15 },
    { code: 'FLOOD', nameTh: 'น้ำท่วมและการระบายน้ำ', icon: 'droplets', color: '#0ea5e9', slaDays: 7 },
    { code: 'WASTE', nameTh: 'ขยะมูลฝอย', icon: 'trash', color: '#84cc16', slaDays: 3 },
    { code: 'NOISE', nameTh: 'เสียงรบกวน', icon: 'volume-x', color: '#a855f7', slaDays: 7 },
    { code: 'ENVIRONMENT', nameTh: 'สิ่งแวดล้อมและมลพิษ', icon: 'leaf', color: '#22c55e', slaDays: 15 },
    { code: 'LIGHT', nameTh: 'ไฟฟ้าแสงสว่าง', icon: 'lightbulb', color: '#eab308', slaDays: 3 },
    { code: 'PUBLIC_SERVICE', nameTh: 'บริการสาธารณะ', icon: 'building', color: '#6366f1', slaDays: 15 },
    { code: 'CORRUPTION', nameTh: 'การทุจริตและประพฤติมิชอบ', icon: 'alert-triangle', color: '#ef4444', slaDays: 30 },
    { code: 'ANIMAL', nameTh: 'สัตว์รบกวน', icon: 'paw-print', color: '#14b8a6', slaDays: 7 },
    { code: 'OTHER', nameTh: 'อื่นๆ', icon: 'help-circle', color: '#64748b', slaDays: 15 },
  ];
  for (const cc of complaintCategories) {
    const exists = await complaintCatRepo.findOne({ where: { code: cc.code } });
    if (!exists) await complaintCatRepo.save(complaintCatRepo.create(cc));
  }
  console.log('  Complaint categories seeded');

  // Approval Request Types
  const approvalTypeRepo = dataSource.getRepository(ApprovalRequestType);
  const approvalTypes = [
    {
      code: 'PURCHASE',
      nameTh: 'ขออนุมัติจัดซื้อ/จัดจ้าง',
      approvalLevels: 4,
      formTemplate: {
        fields: [
          { name: 'item_name', label: 'รายการที่ต้องการจัดซื้อ', type: 'text', required: true },
          { name: 'quantity', label: 'จำนวน', type: 'number', required: true },
          { name: 'unit', label: 'หน่วย', type: 'text', required: true },
          { name: 'unit_price', label: 'ราคาต่อหน่วย (บาท)', type: 'number', required: true },
          { name: 'budget_source', label: 'แหล่งงบประมาณ', type: 'text', required: true },
          { name: 'reason', label: 'เหตุผลและความจำเป็น', type: 'textarea', required: true },
        ],
      },
    },
    {
      code: 'TRAVEL',
      nameTh: 'ขออนุมัติเดินทางไปราชการ',
      approvalLevels: 3,
      formTemplate: {
        fields: [
          { name: 'destination', label: 'สถานที่ไปราชการ', type: 'text', required: true },
          { name: 'start_date', label: 'วันที่เดินทาง', type: 'date', required: true },
          { name: 'end_date', label: 'วันที่กลับ', type: 'date', required: true },
          { name: 'purpose', label: 'วัตถุประสงค์', type: 'textarea', required: true },
          { name: 'expense', label: 'ค่าใช้จ่ายโดยประมาณ (บาท)', type: 'number', required: false },
        ],
      },
    },
    {
      code: 'OVERTIME',
      nameTh: 'ขออนุมัติทำงานล่วงเวลา',
      approvalLevels: 2,
      formTemplate: {
        fields: [
          { name: 'ot_date', label: 'วันที่ทำงานล่วงเวลา', type: 'date', required: true },
          { name: 'start_time', label: 'เวลาเริ่มต้น', type: 'time', required: true },
          { name: 'end_time', label: 'เวลาสิ้นสุด', type: 'time', required: true },
          { name: 'reason', label: 'เหตุผล', type: 'textarea', required: true },
        ],
      },
    },
    {
      code: 'BUDGET',
      nameTh: 'ขออนุมัติใช้งบประมาณ',
      approvalLevels: 4,
      formTemplate: {
        fields: [
          { name: 'budget_item', label: 'รายการงบประมาณ', type: 'text', required: true },
          { name: 'amount', label: 'จำนวนเงิน (บาท)', type: 'number', required: true },
          { name: 'fiscal_year', label: 'ปีงบประมาณ', type: 'number', required: true },
          { name: 'reason', label: 'เหตุผล', type: 'textarea', required: true },
        ],
      },
    },
    {
      code: 'PROJECT',
      nameTh: 'ขออนุมัติโครงการ',
      approvalLevels: 4,
      formTemplate: {
        fields: [
          { name: 'project_name', label: 'ชื่อโครงการ', type: 'text', required: true },
          { name: 'objective', label: 'วัตถุประสงค์', type: 'textarea', required: true },
          { name: 'target_group', label: 'กลุ่มเป้าหมาย', type: 'text', required: true },
          { name: 'budget', label: 'งบประมาณ (บาท)', type: 'number', required: true },
          { name: 'timeline', label: 'ระยะเวลาดำเนินการ', type: 'text', required: true },
        ],
      },
    },
    {
      code: 'TRAINING',
      nameTh: 'ขออนุมัติเข้ารับการฝึกอบรม',
      approvalLevels: 2,
      formTemplate: {
        fields: [
          { name: 'course_name', label: 'ชื่อหลักสูตร', type: 'text', required: true },
          { name: 'organizer', label: 'ผู้จัดอบรม', type: 'text', required: true },
          { name: 'date', label: 'วันที่อบรม', type: 'text', required: true },
          { name: 'location', label: 'สถานที่', type: 'text', required: true },
          { name: 'fee', label: 'ค่าลงทะเบียน (บาท)', type: 'number', required: false },
        ],
      },
    },
  ];
  for (const at of approvalTypes) {
    const exists = await approvalTypeRepo.findOne({ where: { code: at.code } });
    if (!exists) await approvalTypeRepo.save(approvalTypeRepo.create(at));
  }
  console.log('  Approval request types seeded');

  // System Settings
  const settingRepo = dataSource.getRepository(SystemSetting);
  const settings = [
    { key: 'system.name', value: 'SmartGov Office', description: 'ชื่อระบบ', isPublic: true },
    { key: 'system.version', value: '1.0.0', description: 'เวอร์ชันระบบ', isPublic: true },
    { key: 'system.language', value: 'th', description: 'ภาษาหลัก', isPublic: true },
    { key: 'system.timezone', value: 'Asia/Bangkok', description: 'timezone', isPublic: true },
    { key: 'auth.max_failed_attempts', value: '5', description: 'จำนวนครั้งที่ login ผิดสูงสุด', isPublic: false },
    { key: 'auth.lockout_minutes', value: '30', description: 'เวลาล็อคบัญชี (นาที)', isPublic: false },
    { key: 'auth.password_expire_days', value: '90', description: 'วันหมดอายุรหัสผ่าน', isPublic: false },
    { key: 'auth.session_timeout_minutes', value: '480', description: 'เวลาหมด session (นาที)', isPublic: false },
    { key: 'file.max_size_mb', value: '50', description: 'ขนาดไฟล์สูงสุดต่อไฟล์ (MB) — ใช้งานจริง', isPublic: true },
    { key: 'file.allowed_types', value: 'pdf,doc,docx,xls,xlsx,jpg,jpeg,png,zip', description: 'ประเภทไฟล์ที่อนุญาต', isPublic: true },
    { key: 'notification.email_enabled', value: 'false', description: 'เปิดใช้การแจ้งเตือนอีเมล', isPublic: false },
    { key: 'workflow.leave_approval_levels', value: '2', description: 'จำนวนชั้นอนุมัติการลา', isPublic: false },
  ];
  for (const s of settings) {
    const exists = await settingRepo.findOne({ where: { key: s.key, organizationId: null as any } });
    if (!exists) await settingRepo.save(settingRepo.create({ ...s, organizationId: null as any }));
  }
  console.log('  System settings seeded');
}
