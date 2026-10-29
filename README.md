# SmartGov — ระบบบริหารงานราชการอิเล็กทรอนิกส์สำหรับ อบต.

ระบบ e-Government สำหรับ **องค์การบริหารส่วนตำบล (อบต.)** ของไทย ใช้งานจริงที่ อบต.ลำนางรอง จ.บุรีรัมย์
UI เป็นภาษาไทยเกือบทั้งหมด · ออกแบบให้ **1 ระบบรองรับหลาย อบต.** (multi-tenant แยกด้วย `organizationId`)

> ## 👉 คนที่เพิ่งมารับงานต่อ อ่าน **[`HANDOVER.md`](HANDOVER.md)** ก่อนเลย
> ในนั้นมีครบ: ความเป็นมา · สถานะจริงของแต่ละส่วน · ขั้นตอน deploy · **กับดักที่เคยทำระบบพังจริง** · งานที่ค้าง · ของที่ต้องรับมอบ
>
> ไฟล์นี้ = ภาพรวมทางเทคนิค · [`AGENTS.md`](AGENTS.md) = คู่มือสำหรับ AI · [`docs/`](docs/) = เอกสารเชิงลึก

---

## 1. ระบบนี้ทำอะไรได้บ้าง (โมดูลหลัก)

| โมดูล | หน้าที่ |
|---|---|
| **สารบรรณ** (หัวใจของระบบ) | รับ-ส่งหนังสือราชการ, workflow อนุมัติ (เจ้าหน้าที่ → ปลัด → นายก), เลขหนังสือออกอัตโนมัติต่อกอง, ชั้นความลับ, รายงานสรุปประจำเดือน |
| **ประปา** (`/prapa`) | จดมิเตอร์, คิดค่าน้ำ, ออกบิล/ใบเสร็จ, รับชำระเงิน, หนังสือแจ้งค้างชำระ, รายงาน ป.17/ป.32, แผนที่มาตร (GIS) — สร้างมาแทนระบบ vendor เดิม |
| **บริการประชาชน** (`/citizen`, `/checkbill`) | เช็คบิลค่าน้ำ + จ่าย QR, แจ้งเรื่อง/ร้องเรียน |
| **HR / การลา** | ทะเบียนบุคลากร, ยื่น-อนุมัติการลา, ตัดโควตา |
| **โครงการ / ประชุม / บำรุงรักษา** | แบบฟอร์มราชการ, บันทึกการประชุม, งานซ่อมบำรุง |
| **ผู้ใช้ / สิทธิ์ (RBAC)** | บทบาท + สิทธิ์รายโมดูล, override รายคน |

โครงหลังบ้านแบ่งเป็นโมดูล NestJS: `correspondence` (สารบรรณ), `water` (ประปา), `citizen-report`, `hr`, `leave`, `projects`, `meetings`, `maintenance`, `rbac`, `users`, `organizations`, `storage`, `pdf`, `notifications`, `dashboard` ฯลฯ

---

## 2. สถาปัตยกรรม (ใช้เทคโนโลยีอะไร)

```
┌─────────────┐   HTTPS    ┌──────────────┐   TypeORM   ┌────────────┐
│  Frontend   │ ─────────▶ │   Backend    │ ──────────▶ │ PostgreSQL │
│ Next.js 16  │  /v1 API   │  NestJS      │             └────────────┘
│ React 19    │            │  port 4000   │   ┌─────────┐
│ Tailwind v4 │            │              │──▶│  Redis  │ (cache/queue)
│ port 3000   │            │              │   └─────────┘
└─────────────┘            │              │   ┌──────────────────────┐
                           │              │──▶│ MinIO (local) /       │
                           └──────────────┘   │ Supabase (prod)       │ ไฟล์แนบ/รูป/ลายเซ็น
                                               └──────────────────────┘
```

| ส่วน | เทคโนโลยี | หมายเหตุสำคัญ |
|---|---|---|
| Frontend | Next.js 16 (App Router) + React 19 + Tailwind v4 | โฟลเดอร์ `frontend/` · รันที่ **port 3000** · **อ่าน `frontend/AGENTS.md` ก่อนเขียนโค้ด** (เวอร์ชันใหม่ ต่างจากที่คุ้นเคย) |
| Backend | NestJS + TypeORM | โฟลเดอร์ `backend/` · รันที่ **port 4000 · prefix `/v1`** · Swagger ที่ `/docs` |
| Database | PostgreSQL 16 | `synchronize: false` → **ต้องเขียน migration เอง** ไม่ auto-sync schema |
| Cache/Queue | Redis 7 | cache + งาน background (bull) |
| Storage | **ดิสก์ (filesystem)** `/app/.storage` | `STORAGE_DRIVER=fs` · **ต้อง mount volume `backend_storage` เสมอ** ไม่งั้นไฟล์หายตอน deploy · MinIO/Supabase **ถอดออกแล้ว** |
| Deploy | **Docker Compose self-host บน INET** | ดู `docs/SELFHOST-UBUNTU.md` · คลาวด์ (Vercel/Render/Supabase) เลิกใช้แล้ว |

---

## 3. ติดตั้งบนเครื่อง dev (ครั้งแรก)

**ต้องมีก่อน:** Node.js 20+, PostgreSQL 16, Redis (ไม่บังคับตอน dev), Docker (สำหรับ MinIO)

```bash
# 1) clone
git clone git@github.com:GuruITGit/smartgov.git      # หรือ https://github.com/GuruITGit/smartgov.git
cd smartgov

# 2) Backend
cd backend
cp .env.example .env            # แล้วแก้ค่า DB/JWT/MinIO ให้ตรงเครื่อง
npm install
npm run migration:run           # สร้าง schema (จำเป็น! เพราะไม่ auto-sync)
npm run seed:run                # ใส่ข้อมูลตัวอย่าง (idempotent) — ครั้งแรกเท่านั้น
npm run start:dev               # รัน backend (watch) ที่ http://localhost:4000/v1 · Swagger /docs

# 3) Frontend (อีก terminal)
cd frontend
echo "NEXT_PUBLIC_API_URL=http://localhost:4000/v1" > .env.local   # ชี้ backend
npm install
npm run dev                     # รัน frontend ที่ http://localhost:3000

# 4) MinIO (เก็บไฟล์แนบ local) — ถ้าต้องอัปโหลดไฟล์
# ใช้ docker หรือสคริปต์ start-minio.ps1 (Windows)
```

**บัญชีทดสอบ (local เท่านั้น):** รหัสตั้งผ่าน env — `INITIAL_ADMIN_PASSWORD` (admin/SUPER_ADMIN) และ `SEED_DEMO_PASSWORD` (ผู้ใช้สมมติ)
> ⚠️ **ห้าม commit รหัสจริงลง repo** · prod ใช้บัญชีจริงของ อบต. (สร้างผ่าน `npm run rework:rbac:prod`)

---

## 4. คำสั่งที่ใช้บ่อย

### Backend (`cd backend`)
```bash
npm run build                # nest build → dist/
npm run start:prod           # node dist/main (port 4000)
npm run migration:run        # รัน migration ที่ค้าง (จำเป็นหลังเพิ่ม/แก้คอลัมน์)
npm run migration:generate   # gen migration จาก entity ที่เปลี่ยน
npm run seed:run             # seed ข้อมูล (idempotent)
npm run seed:reset           # TRUNCATE ทุกตาราง + seed ใหม่ (ใช้ได้ทั้ง local/prod)
npm run seed:water-admin     # สร้างบัญชีแอดมินระบบประปาต่อ อบต.
```

### Frontend (`cd frontend`)
```bash
npm run build                # next build
npm start                    # next start (port 3000)
```

---

## 5. Deploy ขึ้น production (self-host บน INET)

Deploy จริงเป็นแบบ **self-host ด้วย Docker Compose บน Ubuntu (INET server)** — ทำ **manual** โดยคนดูแล

```bash
# บนเซิร์ฟเวอร์ INET
cd ~/smartgov
git pull                                              # ดึงโค้ดล่าสุดจาก main
cd infrastructure
docker compose build backend frontend && docker compose up -d
```

- **Migration รันอัตโนมัติตอนสตาร์ท** — `Dockerfile` CMD = `node dist/run-migrations.js && node dist/main.js`
  → ไม่ต้องรัน migration เองบน prod แค่ push ขึ้น main แล้ว build ใหม่
  → ⚠️ ถ้า migration fail → container exit → **ทั้งเว็บล่ม (502)** ต้องเทสต์ migration ให้จำลองสภาพ prod ก่อน push
- Services ใน compose (7 ตัว): `postgres` · `redis` · `backend` · `frontend` · `nginx` · `cloudflared` (Cloudflare Tunnel) · `backup` (สำรองข้อมูลทุกคืน 02:30 เก็บ 14 วัน)
- ⚠️ **ห้ามใส่ `--remove-orphans`** ถ้าไม่แน่ใจ และ **อย่าแก้ `docker-compose.yml` บนเซิร์ฟเวอร์โดยตรง** (ทำให้ `git pull` ชน)
- โดเมนออกผ่าน **Cloudflare Tunnel** (ไม่ต้องเปิด port ที่ firewall)
- **backup อัตโนมัติ** (pg_dump + ไฟล์แนบ) — ดู `docs/SELFHOST-UBUNTU.md` §6

📖 คู่มือติดตั้งเต็ม (เตรียมเซิร์ฟเวอร์ → SSL → build → backup/restore): **[`docs/SELFHOST-UBUNTU.md`](docs/SELFHOST-UBUNTU.md)**

### หมายเหตุ: prod ดึงโค้ดจาก GitHub ผ่าน SSH deploy key (port 443)
เครือข่าย INET บล็อก outbound port 22 → ตั้ง SSH ให้วิ่งผ่าน `ssh.github.com:443` ใน `~/.ssh/config`
และใช้ **deploy key แบบอ่านอย่างเดียว** (ไม่ผูกบัญชีบุคคล) เพื่อ `git pull` — ดูวิธีใน `docs/SELFHOST-UBUNTU.md`

---

## 6. Convention / กติกาที่ต้องรู้ก่อนแก้โค้ด

- **UI ภาษาไทย** — ข้อความที่ผู้ใช้เห็นเขียนไทยเสมอ (ยึดสำนวนจากหน้าที่มีอยู่)
- **Migration เขียนเอง** — DB ไม่ auto-sync · migration ต้อง idempotent + timestamp 13 หลักถูกต้อง (เรียงผิด = prod พัง)
- **ห้าม hardcode ชื่อ/ที่อยู่/ผู้ลงนามของ อบต.** ใด อบต. หนึ่ง — ต้องดึงจาก DB/หน้าตั้งค่า (ระบบขายหลาย อบต.)
- **เลขสารบรรณมี prefix ไทยต่อกอง** (บร/ปล/กค/กช/สป...)
- **อักษรไทยใน HTTP header ไม่ได้** (เช่น filename) → ใช้ `filename*=UTF-8''<encoded>`
- คอมมิตเป็นภาษาไทย · ยืนยัน workflow สารบรรณเดิมยังทำงานครบทุกครั้งที่แตะโมดูลสารบรรณ

---

## 7. โครงสร้างโฟลเดอร์

```
smartgov/
├── backend/            NestJS API (port 4000, /v1)
│   ├── src/modules/    โมดูลธุรกิจ (correspondence, water, hr, ...)
│   ├── src/database/   migrations/ + seeds/ + entities/
│   └── .env.example
├── frontend/           Next.js 16 (port 3000) — อ่าน frontend/AGENTS.md ก่อน
│   └── src/app/        App Router (สารบรรณ, /prapa, /citizen, /checkbill, ...)
├── infrastructure/     docker-compose.yml + nginx + backup + selfhost-setup.sh
├── docs/               SELFHOST-UBUNTU · DEPLOY-ROLLBACK · QUICKSTART ·
│                       USER-GUIDE · PRESENTATION-SCRIPT · rework/
├── HANDOVER.md         📋 เอกสารส่งมอบงาน (คนรับงานต่ออ่านอันนี้ก่อน)
├── AGENTS.md           คู่มือ AI/นักพัฒนา (สถาปัตยกรรม + gotchas ละเอียด)
└── README.md           ← ไฟล์นี้
```

---

## 8. อ่านต่อ

| ต้องการ | อ่านที่ |
|---|---|
| **รับงานต่อ / เข้าใจโปรเจกต์ทั้งหมด** | **`HANDOVER.md`** |
| ติดตั้ง self-host ตั้งแต่ต้นจนจบ | `docs/SELFHOST-UBUNTU.md` |
| Deploy + ถอยกลับเมื่อพัง | `docs/DEPLOY-ROLLBACK.md` |
| เริ่มเร็ว (dev) | `docs/QUICKSTART.md` |
| คู่มือผู้ใช้งาน (สอน อบต.) | `docs/USER-GUIDE.md` |
| สคริปต์นำเสนอขาย | `docs/PRESENTATION-SCRIPT.md` |
| รายละเอียดเชิงลึก + ข้อควรระวัง (gotchas) | `AGENTS.md` |
| ฟรอนต์เอนด์ (Next 16 ต่างจาก training) | `frontend/AGENTS.md` |

> โครงสร้างฐานข้อมูล: ยึด **TypeORM entities** (`backend/src/database/entities/`) + **migrations** เป็นความจริง — ไม่มีเอกสาร schema แยก (เคยมีแต่ล้าสมัยจนลบทิ้ง)
```
#   D e m o  
 