# Smart SAO — Quick Start (สำหรับนักพัฒนา)

คู่มือเริ่มต้นสำหรับรัน/พัฒนาระบบ · deploy ขึ้นเซิร์ฟเวอร์จริงดู **[SELFHOST-UBUNTU.md](SELFHOST-UBUNTU.md)**

## ต้องมี
- Node.js 22+
- Docker + Docker Compose
- Git

---

## วิธีที่ 1 — รันทั้งระบบด้วย Docker (ง่ายสุด, เหมือน prod)

```bash
cd infrastructure
# ตั้งค่า env ก่อน: สร้าง backend/.env (คัดจาก backend/.env.example) + infrastructure/.env
docker compose -f docker-compose.lean.yml up -d --build
```
- เว็บ: ผ่าน nginx ที่ `http://localhost` (หรือ `https://localhost` ถ้าตั้ง cert)
- lean stack = postgres + backend + frontend + nginx (ตัด redis/minio ที่ไม่ได้ใช้ ใช้ filesystem เก็บไฟล์)
- รายละเอียดครบใน **[SELFHOST-UBUNTU.md](SELFHOST-UBUNTU.md)**

---

## วิธีที่ 2 — รันแยก (สำหรับพัฒนา)

**1) Infra สำหรับ dev (postgres/redis/minio/mailhog/pgadmin)**
```bash
docker compose -f infrastructure/docker-compose.dev.yml up -d
```

**2) Backend** (port **4000**, prefix `/v1`)
```bash
cd backend
cp .env.example .env        # แก้ DB/JWT ตามเครื่อง (dev: DB_HOST=localhost)
npm install
npm run migration:run       # สร้างตาราง
npm run seed:run            # seed บทบาท/สิทธิ์/ผังองค์กร/ผู้ใช้ตัวอย่าง (idempotent)
npm run seed:demo-monthly   # (ตัวเลือก) สารบรรณตัวอย่างย้อนหลัง ~23 เดือน สำหรับรายงานสรุปประจำเดือน
npm run start:prod          # หรือ: npm run build && node dist/main
```
- API: `http://localhost:4000/v1` · Swagger (เฉพาะ non-production): `http://localhost:4000/docs`

**3) Frontend** (Next.js, port 3000)
```bash
cd frontend
npm install
# ชี้ไป backend:
echo "NEXT_PUBLIC_API_URL=http://localhost:4000/v1" > .env.local
npm run dev
```
เปิด `http://localhost:3000`

---

## บัญชีทดสอบ (local หลัง seed)

รหัสผ่านของบัญชี seed ตั้งผ่าน environment variable — **ไม่เก็บรหัสจริงไว้ใน repo**

| Username | Password | บทบาท |
|---|---|---|
| `admin` | env `INITIAL_ADMIN_PASSWORD` | SUPER_ADMIN |
| `mayor`, `clerk`, `dir_*`, `off_*`, ... | env `SEED_DEMO_PASSWORD` | ผู้ใช้สมมติตามตำแหน่ง |

> ดูรายชื่อ/บทบาททั้งหมดใน `backend/src/database/seeds/seed-initial-org.ts`
> ⚠️ บัญชีตัวอย่างเหล่านี้ใช้เฉพาะ local — **prod ใช้บัญชีจริงของ อบต.** (สร้างผ่าน `npm run rework:rbac:prod`)

---

## คำสั่งที่ใช้บ่อย (Makefile)
```bash
make dev            # start dev infra
make prod           # start full stack (docker-compose.yml)
make migrate        # รัน migration ใน container
make seed           # seed ใน container
make ssl-gen        # สร้าง self-signed cert
make logs-backend   # ดู log backend
```

---

## regression check (สารบรรณ)
ให้ backend รันอยู่ก่อน แล้ว:
```bash
API_BASE=http://localhost:4000/v1 ADMIN_PW="$INITIAL_ADMIN_PASSWORD" node backend/scripts/smoke-saraban.mjs
```
ทดสอบ workflow + permission + export ของสารบรรณครบเส้น (ต้องได้ ผ่าน/ไม่ผ่าน = 0)

---

## โครงสร้างโปรเจกต์
```
SmartGov/
├── AGENTS.md, CLAUDE.md         # คู่มือสำหรับ AI agent (อ่านก่อนแก้โค้ด)
├── Makefile
├── docs/                        # เอกสารทั้งหมด (คู่มือ/สเปค/ออกแบบ)
├── backend/                     # NestJS API (port 4000, /v1)
│   ├── src/{modules,database,common,config}
│   └── scripts/                 # smoke-saraban.mjs, seed-sample-projects.mjs
├── frontend/                    # Next.js 16 (App Router) + Tailwind v4
│   └── src/{app,components,lib,hooks,stores}
└── infrastructure/              # docker-compose (lean/full/dev) + nginx
```

## โมดูลหลัก
สารบรรณ (แกนหลัก) · ลายเซ็นดิจิทัล · คลังเอกสาร · การประชุม · บุคลากร · การลา · โครงการ · แจ้งเตือน · จัดการผู้ใช้ · ประวัติกิจกรรม · ตั้งค่าระบบ
> คู่มือผู้ใช้งานปลายทาง: **[USER-GUIDE.md](USER-GUIDE.md)**
