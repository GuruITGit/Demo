# เรื่องแจ้ง/ร้องเรียน + คำร้องทั่วไป + อนุมัติ 3 ผู้เซ็น — สถานะล่าสุด

> เอกสารสรุปสำหรับยกไปคุยต่อในแชทใหม่ — branch `feat/service-request-and-complaints`
> อัปเดตล่าสุด: 2026-10-07

## ภาพรวม

ขยาย "เรื่องแจ้ง/ร้องเรียน" (`citizen_reports`) จากกล่องรับเรื่องเดิมให้รองรับ 2 เรื่องใหม่:

1. **ขอใช้บริการฉุกเฉิน 4 อย่าง** (รถกู้ภัย/รถดับเพลิง/รถส่งผู้ป่วย/รถแจกน้ำ) — ฟอร์มเดิม + GPS ปักหมุด
2. **คำร้องทั่วไป** (e-Service) — แทนที่แบบฟอร์มกระดาษ "คำร้องทั่วไป" เดิม ลูกบ้านกรอกข้อมูลครบตั้งแต่
   หน้าแจ้งเรื่อง → admin เลือกกองส่งไปอนุมัติ → **ผอ.กอง → ปลัด → นายก** เซ็นเรียงกัน 3 คน (แนบรูป
   ลายเซ็นได้ ไม่บังคับ) → พิมพ์ออกมาเป็น PDF ที่หน้าตาเหมือนฟอร์มกระดาษจริง

**หลักการสำคัญที่ตกลงกันไว้: ห้ามแตะระบบสารบรรณ (`correspondence_tickets`/`ticket.service.ts`) เด็ดขาด**
— ตรวจแล้วว่า engine สารบรรณจริงซับซ้อนกว่าที่คิด (บังคับมีทั้ง "กองเจ้าของ" + "กองที่เกี่ยวข้อง" รวม
6 จุดสัมผัส ไม่ใช่ 3) การไปยุ่งเพื่อลดขั้นตอนจะเสี่ยงกับโมดูลที่ sensitive ที่สุดในระบบโดยไม่จำเป็น —
จึงสร้างกลไกอนุมัติ 3 ขั้นเป็นของตัวเองทั้งหมดในโมดูล `citizen-report` คนละ table คนละ service
คนละ endpoint กับสารบรรณ 100% (ยืนยันแล้วว่า `/correspondence/tickets` ทำงานปกติ ไม่กระทบ)

## สถานะ: เสร็จแล้ว ทดสอบผ่านจริง ยังไม่ commit/push

ทุกอย่างด้านล่างทดสอบผ่านจริงแล้ว (ยิง API ตรง + จำลองคลิกผ่านเบราว์เซอร์จริงด้วย Puppeteer) แต่
**ยังไม่ได้ commit** (ทำตามกติกาเดิม — commit เมื่อสั่งเท่านั้น) รันผ่าน `git status` ดูไฟล์ที่เปลี่ยนได้

### Backend (`backend/src/modules/citizen-report/`, `backend/src/modules/pdf/pdf.service.ts`)
- `citizen_reports` entity เพิ่มคอลัมน์: `subject`, `target_dept_id`, `dept_head_signed_by/at`,
  `clerk_signed_by/at`, `mayor_signed_by/at`, `petition_checked_at`, `dept_head_signature`,
  `clerk_signature`, `mayor_signature` (รูปลายเซ็น data URL base64)
- Endpoint ใหม่ทั้งหมดใน `citizen-report-staff.controller.ts`:
  - `PATCH :id/route` — admin เลือกกองส่งไปอนุมัติ (ตั้ง `target_dept_id` + ขยับ status → `in_progress`
    อัตโนมัติ)
  - `PATCH :id/approve` — เซ็น/อนุมัติขั้นที่ถึงตา (body รับ `signatureImage` ไม่บังคับ) ตรวจสิทธิ์แบบ
    identity-check ตรงๆ: ผอ.กองต้องตรงกับ `department.headUserId` จริง / ปลัดต้องมี role
    `CLERK`/`DEPUTY_CLERK` / นายกต้องมี role `MAYOR`/`DEPUTY_MAYOR`
  - `PATCH :id/close` — นายก/รองนายกปิดเรื่องเป็น "เสร็จสิ้น" ตรงๆ โดยไม่ผ่านกอง (endpoint แยกเพราะ
    role นายกมีแค่สิทธิ์ `complaint:read:Report` ไม่มี `complaint:manage:Report` ตาม default)
  - `GET my-queue` — คิว "รอฉันเซ็น" กรองอัตโนมัติตามกอง/role ของ user ที่ login
  - `GET :id/petition-pdf` — ออกเอกสาร PDF
- `citizen-report.service.ts`: `routeToDept`, `approveStep`, `closeAsMayor`, `myQueue`,
  `petitionPdfData` — ทุกอันคนละฟังก์ชันจาก `ticket.service.ts` ไม่แชร์โค้ดกันเลย
- `pdf.service.ts`: เพิ่ม `generatePetitionHtml()` — template คนละอันจาก `generateTicketHtml()` ของ
  สารบรรณ ไม่มีตรา/โลโก้ (ตามที่สั่ง) มีช่อง "ผู้รับรอง (ผู้ใหญ่บ้าน/กำนัน/ส.อบต.)" เว้นว่างไว้ (ไม่มี
  workflow step รองรับ) ข้อความกำกับเช็กบ็อกซ์ของ ผอ.กอง ("ทราบ/เพื่อพิจารณาดำเนินการต่อไป") ต่างจาก
  ปลัด/นายก ("ทราบ/เห็นควรให้ดำเนินการ....") ตรงตามฟอร์มกระดาษต้นฉบับ
- Migration 5 ไฟล์ (`170000006{4..8}000-*.ts`) — รันกับ local DB แล้วทั้งหมด **ยังไม่รันบน prod**

### Frontend
- `frontend/src/app/citizen/report/page.tsx` — ฟอร์มเปลี่ยนตามประเภทเรื่องที่เลือก:
  - "เรื่องทั่วไป" (ตัวเลือกแรก/default) → ฟอร์มคำร้องทั่วไปเต็ม (เรื่อง/คำนำหน้า/ชื่อ-สกุล/บ้านเลขที่/
    หมู่ที่/เบอร์โทร — **บังคับกรอกหมดยกเว้นเรื่อง** เพราะไม่งั้นเอกสารจะออกไม่ครบ) ไม่มี GPS (ไม่
    เกี่ยวกับคำร้องทั่วไป)
  - 4 บริการฉุกเฉิน → ฟอร์มเดิม (รายละเอียด + GPS ปักหมุดแบบลาก + ชื่อ/เบอร์ไม่บังคับ)
- `frontend/src/app/(main)/citizen-reports/page.tsx` (หน้า admin) — เปลี่ยนเยอะ:
  - badge "ขอใช้บริการ" สีแดงเด่นสำหรับ 4 หมวดฉุกเฉิน
  - stepper 3 จุด (ผอ.กอง→ปลัด→นายก) ในการ์ด/รายละเอียด
  - ปุ่ม "รอฉันเซ็น" + "ประวัติที่เสร็จแล้ว" บนแถบแท็บ
  - ปุ่มสถานะ: เอา "กำลังดำเนินการ" แยกออกแล้ว **แทนที่ด้วยช่องเลือกกอง + "ส่งไปกองเพื่ออนุมัติ" ที่จุด
    เดียวกัน** (กันกด 2 รอบ/สับสนว่าต้องกดอะไรก่อน) "เสร็จสิ้น" เหลือเฉพาะปุ่มที่โชว์ให้นายก/รองนายก
    เท่านั้น (คนอื่นมองไม่เห็นปุ่มเลย)
  - กดอนุมัติแต่ละขั้น → เด้ง modal ให้วาด/อัปโหลดลายเซ็น (reuse `SignatureDrawer` ตัวเดียวกับสารบรรณ)
    มีปุ่ม "ข้ามการแนบลายเซ็น" ด้วย
  - ไอคอนดินสอแก้ไขข้อมูลพื้นฐานได้จาก modal รายละเอียดเลย (ชื่อ/เบอร์/หมู่/ที่อยู่/รายละเอียด)
- `frontend/src/app/(main)/citizen-reports/[id]/petition/page.tsx` (ใหม่) — หน้าเต็มหน้าแก้ไขคำร้อง
  ทั่วไปทุกช่องว่าง (เรฟ UX จากหน้าสร้างสารบรรณ) ปุ่ม "ยืนยัน" → บันทึก + เปิด PDF + เด้งกลับ modal
  เรื่องเดิมอัตโนมัติ (ผ่าน `?open=id` แล้วล้าง query ออกจาก URL ทันทีกันเด้งซ้ำ) โชว์ "✓ เอกสารตรวจ
  สอบแล้ว" + ปุ่มแก้ไข/ดาวน์โหลดคู่กัน

## สิ่งที่ยังไม่ได้ทำ / ควรคุยต่อในแชทใหม่

1. **ยังไม่ commit/push** — รอคำสั่งชัดเจนก่อน (ตามกติกาเดิมของโปรเจกต์)
2. **ยังไม่ migrate บน production** — มี migration 5 ไฟล์ค้างอยู่ ต้อง deploy ตามขั้นตอนปกติ (push →
   `git pull` + `docker compose build/up` บนเซิร์ฟเวอร์)
3. **ไม่มีการแจ้งเตือน** เวลามีเรื่องเข้าคิว "รอฉันเซ็น" ของแต่ละคน — ต้องเข้าหน้าเองถึงจะเห็น (ไม่มี
   badge นับที่เมนู/ไม่มี noti แบบที่สารบรรณมี) — ผู้ใช้เคยถามไว้ ยังไม่ได้ทำ
4. **หน้าประชาชนหน้า `/citizen` (STEPS array)** sub-label "ติดตามสถานะ" ยังเขียนว่า "ด้วยชื่อ-เบอร์โทร"
   ทั้งที่ระบบเปลี่ยนไปค้นด้วยชื่ออย่างเดียวแล้ว (ยังไม่ได้แก้ข้อความ)
5. ฟิลด์ "ผู้รับรอง (ผู้ใหญ่บ้าน/กำนัน/ส.อบต.)" ในเอกสาร PDF ยังเว้นว่างตลอด — ถ้าลูกค้าต้องการขั้นตอน
   นี้จริง ต้องคิดเพิ่มว่าจะทำยังไง (ตอนนี้ไม่มี workflow step รองรับ)
6. ทดสอบบน production ของจริง **ยังไม่ได้ทำ** (ทดสอบแค่ local dev ทั้งหมด) — ตาม AGENTS.md ต้อง
   ทดสอบบน prod จริงก่อนเชื่อว่าใช้ได้ (คนละฐานข้อมูลกับ local)

## ไฟล์ที่เปลี่ยน (ยังไม่ commit — ดูของจริงด้วย `git status`/`git diff`)
```
backend/src/database/entities/citizen-report.entity.ts
backend/src/database/migrations/1700000064000-CitizenReportGeoVillage.ts   (ใหม่)
backend/src/database/migrations/1700000065000-CitizenReportApproval.ts    (ใหม่)
backend/src/database/migrations/1700000066000-CitizenReportSubject.ts     (ใหม่)
backend/src/database/migrations/1700000067000-CitizenReportPetitionChecked.ts (ใหม่)
backend/src/database/migrations/1700000068000-CitizenReportSignatures.ts  (ใหม่)
backend/src/modules/citizen-report/citizen-report-staff.controller.ts
backend/src/modules/citizen-report/citizen-report.controller.ts
backend/src/modules/citizen-report/citizen-report.module.ts
backend/src/modules/citizen-report/citizen-report.service.ts
backend/src/modules/citizen-report/dto/citizen-report.dto.ts
backend/src/modules/pdf/pdf.service.ts
frontend/src/app/(main)/citizen-reports/page.tsx
frontend/src/app/(main)/citizen-reports/[id]/petition/page.tsx            (ใหม่)
frontend/src/app/citizen/page.tsx
frontend/src/app/citizen/report/page.tsx
frontend/src/app/citizen/track/page.tsx
```
(`backend/src/modules/water/slip-verify.ts` ก็ขึ้นว่าแก้ไขแต่ไม่ใช่ฝีมือเรา — ไฟล์เปลี่ยนเอง/
auto-formatter เคยเช็กแล้วไม่เกี่ยว ไม่ต้องสนใจ)

## บัญชีทดสอบ local ที่ใช้อยู่
รหัสผ่านไม่เก็บลง repo — ดูจาก `backend/.env`
- admin: `admin` (รหัสจาก `INITIAL_ADMIN_PASSWORD`)
- ผอ.กอง: `dir_finance` / `dir_eng` / ฯลฯ · ปลัด: `clerk` · นายก: `mayor` (รหัสจาก `SEED_DEMO_PASSWORD` หรือค่า fallback ใน seed)
