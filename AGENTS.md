# SmartGov / Smart SAO — คู่มือสำหรับ AI Agent

ระบบบริหารงานราชการอิเล็กทรอนิกส์สำหรับ **อบต. (องค์การบริหารส่วนตำบล)** ของไทย
ใช้งานจริงที่ **อบต.ลำนางรอง จ.บุรีรัมย์** (ลูกค้าจริง 39 ผู้ใช้ · ทะเบียนน้ำ 2,739 ราย) — ไม่ใช่ระบบทดลอง
UI เป็นภาษาไทย ~100% — **ข้อความที่ผู้ใช้เห็นให้เขียนเป็นไทยเสมอ** (ยึดสำนวนจากหน้าที่มีอยู่)

> 📋 **งานส่งมอบ/ภาพรวมทั้งโปรเจกต์อยู่ที่ [`HANDOVER.md`](HANDOVER.md)** — ถ้าเพิ่งเข้ามาให้อ่านนั่นก่อน

## ระบบมี 4 เว็บในโค้ดชุดเดียว (ล็อกอินคนละชุด)

| เส้นทาง | ใคร | auth |
|---|---|---|
| `/login` → `/dashboard` | เจ้าหน้าที่ อบต. (สารบรรณ/HR/โครงการ/ประชุม/ลา) | JWT ระบบหลัก (`users` + RBAC) |
| `/prapa/*` | เจ้าหน้าที่ประปา | JWT แยก (`water_users` + caps, `WaterAuthGuard`) |
| `/citizen`, `/checkbill` | ประชาชน | ไม่ล็อกอิน / ยืนยันด้วยเบอร์+รหัสผู้ใช้น้ำ |
| `/hub`, `/hub/login` | **เจ้าของระบบ/ผู้ขาย** จัดการทุก อบต. | `POST /v1/auth/hub-login` เฉพาะ `SUPER_ADMIN` |

⚠️ **ห้ามเอาหน้าจัดการหลาย อบต. กลับไปแทรกในแอปสารบรรณอีก** — ลูกค้าท้วงมาแล้ว มันคือคอนโซลของผู้ขาย ไม่ใช่เมนูของ อบต.
`/khaya` (ขยะ) ยัง mock + ยังฝังชื่อลำนางรอง — ยังไม่พร้อมใช้
`/citizen/market` (ค่าแผงตลาด: ค่าเช่า+ขยะแผง) และ `/citizen/waste` (ค่าขยะบ้านที่ค้าง) = หน้า static vanilla TS (ย้ายมาจากโปรเจกต์ lamplaimat) · ซอร์ส `frontend/citizen-pay/{market,waste,shared}` → `npm run build:pay` (tsc outFile รวม shared เข้า `public/citizen-pay/<หน้า>/app.js` · `build` รันให้) · rewrite ใน `next.config.ts` · ข้อมูลยังเป็น demo ยังไม่ต่อ backend · ชำระเงิน `shared/payment.ts`: QR พร้อมเพย์ฝั่งเบราว์เซอร์ (โค้ดเดียวกับ `water/promptpay-qr.ts`) / แอปธนาคาร / เงินสด — บัญชีรับเงิน `shared/payment-config.ts` ชั่วคราว · สถานะเก็บ localStorage

## สถาปัตยกรรม
| ส่วน | เทคโนโลยี | หมายเหตุ |
|---|---|---|
| Frontend | Next.js 16 (App Router) + React 19 + Tailwind v4 | `frontend/` — **ดู `frontend/AGENTS.md` ก่อนเขียนโค้ด** (เวอร์ชันนี้ต่างจาก training) |
| Backend | NestJS + TypeORM | `backend/` — รันที่ **port 4000 prefix `/v1`** (ไม่ใช่ 3000) Swagger: `/docs` |
| Database | PostgreSQL | `synchronize:false` → **ต้องเขียน migration เอง** (60 ตัว · 66 entities) |
| ไฟล์แนบ/รูป | **ดิสก์ (filesystem)** `/app/.storage` | `STORAGE_DRIVER=fs` · **ต้อง mount volume `backend_storage` เสมอ** · MinIO/Supabase **ถอดออกแล้ว** |
| Deploy | self-host Docker Compose บน INET | `docs/SELFHOST-UBUNTU.md` · คลาวด์ (Vercel/Render/Supabase) **เลิกใช้แล้ว** |

**Multi-tenant:** ฐานข้อมูลเดียว แยกด้วย `organization_id` ทุกตาราง · รู้ว่าเป็น อบต. ไหนจาก **โดเมน** (`organizations.hostnames` เป็น text[]) → ผู้ใช้ไม่ต้องกรอกรหัสองค์กร · บทบาท (`roles`) เป็น global ใช้ร่วมทุก org
**1 อบต. = 1 โดเมนของตัวเอง** (ซื้อให้ตอนขาย) — ไม่ทำโดเมนกลาง/subdomain

## คำสั่ง dev
```bash
# Backend (cwd: backend/)
npm run build           # nest build → dist/
node dist/main          # หรือ npm run start:prod (port 4000)
npm run migration:run   # รัน migration (จำเป็นหลังเพิ่มคอลัมน์)
npm run seed:run        # seed ข้อมูล (idempotent)
npm run seed:reset      # TRUNCATE ทุกตาราง + reseed
npm run seed:super-admin     # สร้างบัญชีเจ้าของระบบ (SUPER_ADMIN) จาก env
npm run migration:run:prod   # รัน migration บน build (Dockerfile รันให้อัตโนมัติตอน deploy)
node scripts/smoke-saraban-v4.mjs   # regression สารบรรณ v4 (ให้ backend รันอยู่ก่อน)
npm run sync:prapa -- --dry  # ซิงก์ประปาจากระบบเดิม (Prapa On Mobile) — env LEGACY_ORG/USER/PASSWORD · --verify ตรวจอย่างเดียว · ห้ามใช้ import-prapa-legacy (ลบทั้งก้อน)

# Frontend (cwd: frontend/)
npm run build && npm start   # port 3000
```
**บัญชีทดสอบ (local):** รหัสจาก env `INITIAL_ADMIN_PASSWORD` (admin) และ `SEED_DEMO_PASSWORD` — **ไม่เก็บรหัสจริงลง repo**

## โดเมนหลัก: สารบรรณ (Correspondence Ticket)
หัวใจของระบบ — ทุกงานเริ่มจากสารบรรณ (Rework 2.x ยุบ ร้องเรียน/เสนอเซ็น/คำขอ เข้ามารวม)

- **Entities:** `correspondence_tickets` + `correspondence_ticket_departments` (หลายกอง) · ไฟล์แนบ reuse `file_uploads` (refType=`ticket`) · ไทม์ไลน์ reuse `document_workflow_logs` (docType=`TICKET`) · เลขออก atomic ต่อกองผ่าน `document_number_sequences`
- **Workflow (ห้ามเปลี่ยนลำดับ):** `รอดำเนินการ → กำลังดำเนินการ → รอปลัด → รอนายก → เสร็จสิ้น` (+ ส่งกลับแก้ไข, ยกเลิก) — เมื่อนายกตีกลับแล้วกอง resubmit จะ **ข้ามปลัดไปรอนายก** (เพราะ clerkSignedAt ตั้งแล้ว)
- **สิทธิ์:** subject `Ticket` actions `read/create/update/approve_clerk/approve_mayor/delete/summary` · เจ้าหน้าที่/หัวหน้ากองเห็นเฉพาะกองตน · ปลัด(CLERK)/นายก(MAYOR)/admin เห็นหมด
- **รายงานสรุปประจำเดือน:** endpoint `summary/years|:year/months|:year/:month` (guard action `summary`) · aggregate scope ด้วย `buildVisibleQuery` เสมอ · user relation ต้องเลือกคอลัมน์/sanitize (ห้าม joinAndSelect ทั้ง entity — passwordHash หลุด)
- **ชั้นความลับ** (`confidentiality`): จำกัดสิทธิ์จริง — เรื่อง >= 'ลับ' เห็นเฉพาะ privileged + ผู้สร้าง/ผู้รับผิดชอบ/ผู้ถูก assign/หัวหน้ากองที่เกี่ยว (`applyConfidentiality`/`canSeeConfidential` ใน `ticket.service.ts`)
- ไฟล์หลัก: `backend/src/modules/correspondence/ticket.{service,controller}.ts`, `dto/ticket.dto.ts` · `frontend/src/app/(main)/correspondence/tickets/**`

## เปิด-ปิดโมดูลราย อบต. (feature flags)
- เก็บที่ `organizations.metadata.disabledModules` (string[]) — ค่าเริ่มต้น = เปิดหมด โมดูลใหม่โผล่อัตโนมัติ
- ทะเบียนโมดูล 11 ตัว = `backend/src/common/modules/module-registry.ts` (**แหล่งความจริงเดียว**) แมป path→โมดูลด้วย longest-prefix
- บังคับใช้ 2 ชั้น: ซ่อนเมนู (`frontend/src/hooks/use-modules.ts` → sidebar + command palette) + **บล็อก API** (`module-access.interceptor.ts` เป็น APP_INTERCEPTOR รันหลัง auth guard → 403)
- ตั้งค่าที่หน้า `/hub` แท็บ "โมดูล" · endpoints: `GET modules/catalog` · `GET current/modules` · `GET/PUT :id/modules`

## คอนเวนชัน UI (สไตล์ PEAK)
- **เลย์เอาต์:** แถบ gradient ด้านบน (`top-nav.tsx`) + sidebar ซ้าย (`sidebar.tsx`, responsive) · `(main)/layout.tsx`
- **ธีมสี:** ใช้ Tailwind `blue-*` เป็น accent แล้ว override ตัวแปร `--color-blue-*` ตาม `[data-theme]` (ดู `globals.css` + `accessibility.context.tsx`) — ค่าเริ่มต้น `emerald`
- **ฟอนต์:** ผู้ใช้เลือกได้ (`[data-font]`) — Sarabun(default)/IBM Plex/Anuphan/Noto · โหลดผ่าน next/font ใน `layout.tsx`
- **มุมโค้ง:** `globals.css` override `rounded-lg/xl/2xl` ให้เหลี่ยมขึ้น **แต่คง `rounded-full`**
- **โหมดมืด:** `[data-mode='dark']` override สีใน globals.css
- Badge รวมศูนย์ที่ `components/shared/status-badge.tsx`
- **ชื่อแท็บ/ไอคอนเว็บ (รวมใน Google) + ชื่อมุมซ้ายบน = ชื่อ/โลโก้ อบต. ตามโดเมน** (`lib/org-brand.server.ts` → `generateMetadata` ใน `app/layout.tsx` + `/favicon.ico` route) — ตั้งที่ `/hub` (อัปโหลดโลโก้ได้) หรือ `/settings` · ไม่มีโลโก้ = Smart SAO สำรอง (`public/brand/`) · **ห้ามวาง `icon.png` ไว้ที่ `app/` อีก** (ไอคอนแบบไฟล์ทับค่าจาก DB) · frontend ต้องมี env `INTERNAL_API_URL` (ตั้งใน docker-compose แล้ว)
- ทุกหน้าใน `(main)` ใช้ `<Header title>` แล้วใส่เนื้อหาใน `flex-1 overflow-y-auto p-6`
- **ห้าม AI-slop**: ไม่เอา gradient/glow/เงาหนัก/มุมโค้งเกิน/emoji เป็นไอคอน — เอาแบบ enterprise เรียบ ๆ reuse design system เดิม

## ข้อควรระวัง (Gotchas — เคยทำพังจริงทุกข้อ)
- 🔴 **ไฟล์แนบ/รูปต้องอยู่บน named volume เสมอ** — เคยหายทั้งระบบ (5 ก.ย. 2569) เพราะ MinIO auth พังแล้วโค้ด fallback ไปเขียน `/app/.storage` ที่ไม่ได้ mount → สร้าง container ใหม่ = ไฟล์หายเกลี้ยง · **ห้าม fallback storage เงียบ ๆ บน production**
- 🔴 **Migration รันอัตโนมัติตอน deploy** (Dockerfile CMD = `node dist/run-migrations.js && node dist/main.js`) — ถ้า migration fail → container exit → **ทั้งเว็บ 502**
- 🔴 **ถอนฟีเจอร์ที่ deploy ไป prod แล้ว = ต้องเขียน migration ลบตาราง** อย่าลบแค่ไฟล์ migration ออกจาก repo — ตารางบน prod ไม่หายตาม พอชื่อซ้ำ `CREATE TABLE IF NOT EXISTS` จะข้ามเงียบแล้วไปตายตอน `CREATE INDEX` (เกิดจริง 5 ส.ค. 2569 ดู `1700000028000`)
- 🔴 **class name migration ต้อง timestamp 13 หลักถูกต้อง** ผิดตัวเดียว = เรียงผิดทั้งชุด = prod พัง
- 🔴 **ทดสอบ migration ต้องจำลองสภาพ prod ให้ตรง** ทั้งสคีมาที่ค้าง **และแถวในตาราง `migrations`**
- 🟠 **อย่าแก้ `docker-compose.yml` บนเซิร์ฟเวอร์โดยตรง** — ทำให้ `git pull` ชนและเคยมี container `backup` ลอยนอกคอมโพส (เผลอ `docker compose down` = ระบบสำรองหายเงียบ) · **ห้ามใส่ `--remove-orphans`** ถ้าไม่แน่ใจ
- 🟠 **Cloudflare แคช 404 นาน 4 ชม.** — แก้บั๊กรูปเสร็จแล้วยังเห็นแตกเป็นเรื่องปกติ ให้ `Ctrl+Shift+R` และเทียบด้วย `curl`
- 🟡 **อักษรไทยใน HTTP header ไม่ได้** (เช่น Content-Disposition filename) → ใช้ `filename*=UTF-8''<encoded>` + ASCII fallback
- 🟡 **axios ห้ามตั้ง Content-Type json ทับ FormData** — เคยทำอัปโหลดไฟล์พังทั้งระบบ (แก้ที่ `frontend/src/lib/api.ts` แล้ว)
- 🟡 **ห้าม hardcode ชื่อ/ที่อยู่/ผู้ลงนาม ของ อบต.** — ต้องดึงจาก DB/หน้าตั้งค่า (ขายหลาย อบต.) · ประปาใช้ `loadOrgIdentity()` ใน `backend/src/modules/water/org-identity.ts`
- 🟡 **เลขสารบรรณมี prefix ไทย** (บร/ปล/กค/กช/สป...) ตามกอง
- 🟡 Shell บน Windows เป็น Git Bash — ส่ง JSON ไทยทาง `curl -d` inline อาจเพี้ยน ให้เขียนไฟล์ UTF-8 แล้ว `--data-binary @file` · ตัวแปร bash `UID` เป็น readonly อย่าใช้ชื่อนี้

## การทำงาน
- คอมมิตเป็นภาษาไทย (ตามประวัติ) ลงท้ายด้วย `Co-Authored-By: Claude ...`
- **ยืนยัน workflow เดิมยังทำงานครบทุกครั้งที่แตะโมดูลสารบรรณ**
- **ทดสอบบนเว็บจริง (prod) ไม่ใช่แค่ local** — คนละฐานข้อมูล เคยพลาดมาแล้ว
- deploy เป็นแบบ manual: push ขึ้น main แล้วผู้ดูแลไป `git pull` + `docker compose build/up` บนเซิร์ฟเวอร์เอง
- มี memory ที่ `~/.claude/projects/d--claude-SmartGov/memory/` — **อ่าน `MEMORY.md` เป็นดัชนีก่อน** (มีบันทึกเหตุการณ์/ข้อตกลงกับลูกค้าย้อนหลัง)
