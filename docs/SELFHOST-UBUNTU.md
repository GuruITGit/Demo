# SmartGov — Self-Host บน Ubuntu (INET Server)

รันทั้งระบบบนเซิร์ฟเวอร์เดียวด้วย Docker Compose — **ไม่ต้องพึ่ง Supabase / Render / Vercel**
ทุก service อยู่ใน `infrastructure/docker-compose.yml`:

```
nginx (80/443)  ──┬── frontend  (Next.js, :3000)
                  └── /v1, /ws ── backend (NestJS, :4000)
                                     ├── postgres (:5432)   ← ฐานข้อมูล
                                     ├── redis    (:6379)
                                     └── /app/.storage      ← ไฟล์/รูป/ลายเซ็น (volume backend_storage)
+ cloudflared (Cloudflare Tunnel)  + backup (สำรองข้อมูลทุกคืน 02:30)
```

> เปิดออกเน็ตเฉพาะ **80/443** ผ่าน nginx เท่านั้น — postgres/redis อยู่ในเครือข่าย docker ภายใน

> ### 🔴 อัปเดต 7 ก.ย. 2569 — **ถอด MinIO ออกแล้ว**
> เดิมใช้ MinIO เก็บไฟล์ แต่บน prod มัน auth ไม่ผ่าน (`SignatureDoesNotMatch`) มาตลอดจนไม่เคยเก็บไฟล์ได้จริง
> แล้วโค้ด fallback ไปเขียนดิสก์เงียบ ๆ ทำให้ **รูปทั้งระบบหายตอน deploy** (เพราะไม่ได้ mount volume)
>
> ตอนนี้ใช้ **filesystem ตรง ๆ**: `STORAGE_DRIVER=fs` + volume `backend_storage:/app/.storage`
> **ข้ามหัวข้อที่พูดถึง `MINIO_*` ทั้งหมดในเอกสารนี้ได้เลย** — ไม่ต้องตั้งค่าอะไรเพิ่ม (compose ตั้งให้แล้ว)
> ⚠️ อย่าลืมว่า `/app/.storage` **ต้องเป็น named volume เสมอ** ไม่งั้นไฟล์หายทุกครั้งที่สร้างคอนเทนเนอร์ใหม่

> **⚡ เครื่องเล็ก (1 core / 2GB เช่น INET ขั้นต่ำ)?** → อ่าน [ภาคผนวก A](#ภาคผนวก-a--เครื่องเล็ก-1-core--2gb) ก่อน
> ใช้ `docker-compose.lean.yml` (ตัด redis/minio ที่ไม่ได้ใช้จริงออก) + ต้องเปิด swap + ควร build นอกเครื่อง

---

## 1. เตรียมเซิร์ฟเวอร์ (ครั้งเดียว)

**สเปคแนะนำ:** Ubuntu 22.04/24.04 · RAM ≥ 4GB · Disk ≥ 20GB
(เครื่อง 2GB ก็รันได้ด้วย lean profile + swap — ดูภาคผนวก A)

```bash
sudo apt update && sudo apt install -y git
curl -fsSL https://get.docker.com | sh        # Docker Engine + Compose plugin
sudo usermod -aG docker $USER                  # ใช้ docker ไม่ต้อง sudo (ต้อง logout/login ใหม่)
```

ตรวจสอบ:
```bash
docker --version && docker compose version
```

**Firewall / Security Group ของ INET:** เปิดเข้า **TCP 80 และ 443** เท่านั้น
(ห้ามเปิด 5432/6379/9000 ออกสาธารณะ)

**โดเมน:** ชี้ A record ของโดเมนมาที่ public IP ของ INET server
(ยังไม่มีโดเมนก็ทดสอบด้วย IP + self-signed cert ไปก่อนได้ — ดูข้อ 4)

---

## 2. โค้ด + ไฟล์ตั้งค่า

repo เป็น **private** → ต้อง auth ก่อน clone วิธีที่ง่ายสุดคือ GitHub CLI (`gh`)
อย่าใช้รหัสผ่าน GitHub ปกติ (เลิกรองรับแล้ว) และ **อย่าวาง Personal Access Token ลงในไฟล์/แชต**

```bash
# ลง GitHub CLI (วิธีทางการ — ถ้า `sudo apt install -y gh` มีอยู่แล้วก็ใช้อันนั้นได้)
curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg \
  | sudo dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg
sudo chmod go+r /usr/share/keyrings/githubcli-archive-keyring.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" \
  | sudo tee /etc/apt/sources.list.d/github-cli.list > /dev/null
sudo apt update && sudo apt install -y gh

# login (เลือก GitHub.com → HTTPS → Yes → Login with a web browser → ใส่ code ในเบราว์เซอร์)
gh auth login

# clone (หลัง login จะไม่ถาม password อีก)
git clone https://github.com/GuruITGit/smartgov.git && cd smartgov
```

สร้าง `backend/.env` (คัดลอกจากตัวอย่างแล้วแก้ค่า):

```bash
cp backend/.env.example backend/.env
nano backend/.env
```

ค่าที่ **ต้องแก้** สำหรับ self-host:

```ini
NODE_ENV=production
PORT=4000
APP_URL=https://your-domain.example       # โดเมนจริง (ใช้สร้าง URL ไฟล์แนบ)
FRONTEND_URL=https://your-domain.example  # โดเมนเดียวกัน (ใช้กับ CORS)

# Database — ชื่อ host = ชื่อ service ใน compose
DB_HOST=postgres
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=<ตั้งรหัสแข็งแรง>             # ต้องตรงกับ DB_PASS ใน compose (ดูข้อ 3)
DB_DATABASE=smartgov
DB_SYNCHRONIZE=false
DB_SSL=false                              # postgres ภายใน docker ไม่ต้องใช้ SSL

# JWT — สร้างใหม่ทั้งคู่
JWT_SECRET=<64 chars>
JWT_REFRESH_SECRET=<64 chars>

# Redis
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=<ตั้งรหัส>                  # ต้องตรงกับ REDIS_PASSWORD ใน compose

# Storage = ดิสก์ในเครื่อง (compose ตั้ง STORAGE_DRIVER=fs ให้แล้ว ไม่ต้องใส่อะไรตรงนี้)
# อย่าตั้ง SUPABASE_* และไม่ต้องตั้ง MINIO_* — ถอด MinIO ออกแล้ว

# เปิด seed ครั้งแรกครั้งเดียว (สร้างผังองค์กร+ผู้ใช้ตัวอย่าง) แล้วค่อยลบออกหลังรันรอบแรก
SEED_ON_START=true
INITIAL_ADMIN_USERNAME=admin
INITIAL_ADMIN_PASSWORD=<รหัส admin ที่ต้องการ>
```

> สร้าง secret 64 ตัวอักษร: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
> ถ้าไม่มี node บนเครื่อง: `openssl rand -hex 32`

สร้างไฟล์ `infrastructure/.env` (ตั้งรหัส infra ให้ **ตรง** กับ `backend/.env`):

```ini
DB_NAME=smartgov
DB_USER=postgres
DB_PASS=<รหัสเดียวกับ DB_PASSWORD>
REDIS_PASSWORD=<รหัสเดียวกับใน backend/.env>
```

---

## 3. SSL Certificate (nginx บังคับ HTTPS)

nginx อ่าน cert จาก `infrastructure/nginx/ssl/cert.pem` และ `key.pem`

### ก. โดเมนจริง — Let's Encrypt (แนะนำ)
```bash
sudo apt install -y certbot
sudo certbot certonly --standalone -d your-domain.example   # ต้องหยุด service ที่ใช้ port 80 ชั่วคราว
mkdir -p infrastructure/nginx/ssl
sudo cp /etc/letsencrypt/live/your-domain.example/fullchain.pem infrastructure/nginx/ssl/cert.pem
sudo cp /etc/letsencrypt/live/your-domain.example/privkey.pem   infrastructure/nginx/ssl/key.pem
sudo chown $USER: infrastructure/nginx/ssl/*.pem
```
> cert หมดอายุทุก 90 วัน — ตั้ง cron `certbot renew` แล้ว copy ทับ + `docker compose restart nginx`

### ข. ทดสอบเร็ว ๆ — Self-signed (เบราว์เซอร์จะเตือน ไม่ปลอดภัย)
```bash
mkdir -p infrastructure/nginx/ssl
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout infrastructure/nginx/ssl/key.pem \
  -out    infrastructure/nginx/ssl/cert.pem \
  -subj "/CN=your-domain.example"
```

### ค. Cloudflare Tunnel — **วิธีที่ใช้จริงกับ INET** ⭐

**ทำไมต้องใช้:** เซิร์ฟเวอร์ INET อยู่หลัง NAT (IP จริงในเครื่องคือ `172.24.6.209` ไม่ใช่ public IP)
และ **พอร์ต 443 ขาเข้าจาก Cloudflare ถูกบล็อกที่ขอบเน็ตเวิร์กของ INET** — พิสูจน์แล้วด้วย tcpdump
(พอร์ต 80 เข้าได้ แต่ 443 ไม่มี SYN มาถึงเครื่องเลย → Cloudflare ขึ้น Error 522)

Tunnel แก้ตรงจุด เพราะ **เซิร์ฟเวอร์เป็นฝ่ายต่อออก**ไปหา Cloudflare (ขาออกไม่ถูกบล็อก) ผลพลอยได้:
- ได้ cert จริงของ Cloudflare — เลิกใช้ self-signed
- ปิดพอร์ต 80/443 จากอินเทอร์เน็ตได้เลย ไม่มีใครยิงตรงเข้า IP ได้อีก
- ไม่ต้องขอ INET เปิดพอร์ต / ไม่ต้องต่ออายุ cert

**ขั้นตอน**

1) **สร้าง tunnel ใน Cloudflare** → [one.dash.cloudflare.com](https://one.dash.cloudflare.com) → Networks → Tunnels → Create a tunnel → เลือก **Cloudflared** → ตั้งชื่อ (เช่น `smartgov`) → **คัดลอก token** (สตริงยาวหลัง `--token`)

2) **ตั้ง Public hostname** ในหน้าเดียวกัน (แท็บ Published application routes):

   | ช่อง | ค่า |
   |---|---|
   | Subdomain | เว้นว่าง (หรือ `www` ถ้าจะทำอีกอัน) |
   | Domain | `sao-lamnangrong.com` |
   | Type | **HTTPS** |
   | URL | `nginx:443` |
   | Additional application settings → TLS → **No TLS Verify** | **เปิด** ← จำเป็น เพราะ cert ใน nginx เป็น self-signed |

3) **ใส่ token บนเซิร์ฟเวอร์**
```bash
cd infrastructure
echo "TUNNEL_TOKEN=<token ที่คัดลอกมา>" >> .env
docker compose -f docker-compose.lean.yml --profile tunnel up -d cloudflared
docker compose -f docker-compose.lean.yml logs -f cloudflared    # ต้องเห็น "Registered tunnel connection"
```
> ทุกครั้งที่สั่ง `up -d` ทั้ง stack ต้องใส่ `--profile tunnel` ด้วย ไม่งั้น cloudflared จะไม่ถูกสตาร์ท

4) **ลบ DNS record แบบ A ทิ้ง** — Cloudflare สร้าง CNAME ของ tunnel ให้เองแล้ว
   (DNS → Records → ลบ `A @ 203.154.140.209` และ `A www ...` ถ้ามี)

5) **แก้ URL ในระบบให้เป็นโดเมนใหม่** — `backend/.env`
```bash
APP_URL=https://sao-lamnangrong.com
FRONTEND_URL=https://sao-lamnangrong.com
```
   - `APP_URL` = ต้นทางของ signed URL ไฟล์แนบ/สลิป **ถ้าไม่แก้ รูปจะชี้กลับไป IP เดิม เปิดไม่ขึ้น**
   - `FRONTEND_URL` = allowlist ของ CORS **ถ้าไม่แก้ frontend เรียก API ไม่ได้**
```bash
docker compose -f docker-compose.lean.yml up -d backend
```

6) **ปิดพอร์ตขาเข้า** (ทำได้หลังยืนยันว่า tunnel ใช้งานได้แล้ว) — ลบ `ports:` ของ service `nginx`
   ใน compose แล้ว `up -d nginx` เว็บจะเข้าได้ทางโดเมนอย่างเดียว ยิงตรงเข้า IP ไม่ได้อีก

**IP จริงของผู้ใช้:** `nginx.conf` ตั้ง `real_ip_header CF-Connecting-IP` ไว้แล้ว และ backend ตั้ง
`trust proxy` — ถ้าไม่มีสองอย่างนี้ ทุก request จะกลายเป็น IP เดียวกันหมด ทำให้ rate limit
ฝั่งประชาชนบล็อกคนที่ 9 ของนาทีนั้นทั้งที่ยังไม่ได้ทำอะไรผิด และประวัติล็อกอินบันทึก IP ผิด

---

## 4. Build + รัน

```bash
cd infrastructure
docker compose build          # build backend + frontend image (รอบแรก ~5-10 นาที)
docker compose up -d          # สตาร์ททั้งหมด
docker compose ps             # เช็คว่าทุกตัว healthy
docker compose logs -f backend   # ดู log — migration จะรันอัตโนมัติก่อนสตาร์ท
```

ตอน backend สตาร์ทรอบแรกจะ:
1. รัน migration ที่ค้างทั้งหมด (ถ้า fail → container exit เพื่อกัน schema เพี้ยน)
2. seed ข้อมูลตั้งต้น (เพราะตั้ง `SEED_ON_START=true`)

**หลังรอบแรกสำเร็จ** → แก้ `backend/.env` เอา `SEED_ON_START=true` ออก (หรือเป็น `false`) แล้ว `docker compose up -d` ใหม่ เพื่อไม่ให้ seed ซ้ำทุกครั้งที่ restart

**ข้อมูลตัวอย่างรายงานสรุปประจำเดือน** (ตัวเลือก — สารบรรณย้อนหลัง ~23 เดือนสำหรับสาธิต, idempotent รันซ้ำไม่เบิ้ล):
```bash
docker compose -f docker-compose.lean.yml exec backend node dist/database/seeds/run-demo-monthly.js
```

---

## 5. ทดสอบ

```bash
curl -k https://your-domain.example/health     # ควรได้ {"status":"ok",...}
```
เปิดเบราว์เซอร์ → `https://your-domain.example` → login `admin / <รหัสที่ตั้ง>`
ลองอัปโหลดไฟล์ในสารบรรณ → ไฟล์จะถูกเก็บบนดิสก์ (volume backend_storage) และเสิร์ฟผ่าน `/v1/storage/files/...`

---

## 6. งานดูแลประจำ

```bash
# อัปเดตโค้ดใหม่
git pull && cd infrastructure && docker compose build && docker compose up -d

# ดู log
docker compose logs -f [backend|frontend|nginx|backup]

# รัน migration เองนอกรอบ (ปกติรันอัตโนมัติตอนสตาร์ทอยู่แล้ว)
docker compose exec backend node dist/run-migrations.js
```

**ข้อมูลทั้งหมดอยู่ใน docker volume** (`postgres_data`, `redis_data`, `backend_uploads`, **`backend_storage`** ← ไฟล์แนบ/รูปทั้งหมด **ห้ามลบ**)
→ อย่าลบด้วย `docker compose down -v` ถ้าไม่ตั้งใจล้างข้อมูล

### 6.1 สำรอง/กู้คืนข้อมูล (backup อัตโนมัติ)

lean stack มี service `backup` ในตัว — **สำรองอัตโนมัติทุกคืน 02:30 น.** (ฐานข้อมูล `pg_dump -Fc` + ไฟล์แนบทั้งหมด `tar.gz`) เก็บไว้ที่ `infrastructure/backups/` บนเครื่อง ย้อนหลัง 14 วัน และสำรองทันที 1 รอบทุกครั้งที่ container สตาร์ท (ปรับเวลา/จำนวนวันได้ที่ env `BACKUP_TIME` / `BACKUP_KEEP_DAYS` ใน compose)

```bash
# ตรวจว่า backup ทำงาน (ดูรอบล่าสุด)
docker compose -f docker-compose.lean.yml logs backup | tail -5
cat backups/last-success.txt && ls -lh backups/

# สั่งสำรองเดี๋ยวนี้ (นอกรอบ)
docker compose -f docker-compose.lean.yml exec backup sh /backup.sh once
```

### 6.2 วิธีใช้ไฟล์ backup (กู้คืน 3 สถานการณ์)

> ⚠️ **ก่อนกู้ทุกครั้ง ให้สำรองสภาพปัจจุบันเก็บไว้ก่อนเสมอ** — การกู้คือถอยทั้งฐานข้อมูลกลับไป ณ เวลาที่ backup ข้อมูลที่กรอก**หลัง**เวลานั้นจะหายด้วย (เช่น กู้ dump ของตี 2:30 ตอนบ่าย 3 → งานเช้า-บ่ายวันนั้นหาย)
> ```bash
> docker compose -f docker-compose.lean.yml exec backup sh /backup.sh once
> ```

**สถานการณ์ 1 — ข้อมูลใน DB เสีย/ถูกลบผิด** (เจอบ่อยสุด เช่น ลบสารบรรณ/ผู้ใช้ผิด อยากย้อนกลับไปเมื่อคืน) → ใช้ไฟล์ `db-*.dump`:
```bash
cd ~/smartgov/infrastructure
ls backups/                     # เลือกชุดวันที่ต้องการย้อนกลับไป

docker compose -f docker-compose.lean.yml stop backend   # กันคนเขียนข้อมูลระหว่างกู้
cat backups/db-YYYYMMDD-HHMMSS.dump | docker compose -f docker-compose.lean.yml exec -T postgres \
  pg_restore -U postgres -d smartgov --clean --if-exists
docker compose -f docker-compose.lean.yml start backend
```

**สถานการณ์ 2 — ไฟล์แนบ/รูปหาย** → ใช้ไฟล์ `files-*.tar.gz` แตกกลับเข้า volume:
```bash
docker run --rm -v smartgov_backend_storage:/data/storage -v smartgov_backend_uploads:/data/uploads \
  -v "$PWD/backups:/backups" alpine sh -c "cd /data && tar -xzf /backups/files-YYYYMMDD-HHMMSS.tar.gz"
```

**สถานการณ์ 3 — เครื่องพังทั้งลูก / ย้ายเครื่องใหม่** — ขอแค่มีไฟล์ 2 ตัว (db + files) อยู่ในมือ ระบบเกิดใหม่ได้ครบ:
1. เครื่องใหม่: ติดตั้งตามคู่มือนี้ตั้งแต่ข้อ 1 (git clone → ตั้ง `.env` → `docker compose up -d --build`) โดย**ไม่ต้องเปิด SEED**
2. คัดลอกไฟล์ backup เข้า `infrastructure/backups/`
3. รันคำสั่งสถานการณ์ 1 + สถานการณ์ 2 → ข้อมูล ผู้ใช้ ไฟล์แนบ กลับมาครบ

💡 **แนะนำให้ซ้อมกู้ 1 ครั้งตอนยังเป็นข้อมูล demo** — จะได้มั่นใจว่าถึงเวลาจริงทำเป็น (พลาดตอนนี้ก็แค่ `seed:reset` ใหม่ ไม่มีอะไรเสีย)

> ⚠️ **สำรองในเครื่องอย่างเดียวยังไม่พอ** — ไฟล์ backup ที่อยู่บนเครื่องที่พังไปด้วยช่วยอะไรไม่ได้ ควรตั้ง cron บนเครื่องอื่น (เช่นคอมที่ออฟฟิศ) ดึงสำเนาออกไปเก็บรายวัน:
> ```bash
> # crontab ของเครื่องสำรอง — ดึงทุกวัน 6 โมงเช้า
> 0 6 * * * rsync -az user@SERVER:~/smartgov/infrastructure/backups/ ~/smartgov-backups/
> ```
> หรือใช้ `rclone` ส่งขึ้น Google Drive/S3

---

## หมายเหตุ / Troubleshooting

- **ที่เก็บไฟล์:** ดิสก์ในเครื่อง (volume `backend_storage`) — ฐานข้อมูล + ไฟล์อยู่บนเครื่องนี้ทั้งหมด
- **502 Bad Gateway:** backend ยัง build/migrate ไม่เสร็จ → `docker compose logs backend`
- **เปลี่ยนโดเมน:** แก้ `APP_URL`/`FRONTEND_URL` ใน `backend/.env` แล้ว `docker compose up -d backend`
  - frontend ยิง API แบบ relative `/v1` ผ่าน nginx อยู่แล้ว จึง **ไม่ต้อง rebuild** เมื่อเปลี่ยนโดเมน
  - ยกเว้นจะ hardcode โดเมนเต็ม: `docker compose build --build-arg NEXT_PUBLIC_API_URL=https://your-domain/v1 frontend`
- **CORS error:** `FRONTEND_URL` ใน `backend/.env` ต้องตรงกับโดเมนที่เปิดเว็บ

---

## ภาคผนวก A — เครื่องเล็ก (1 core / 2GB)

สแตกเต็มยังมี redis ที่ **โค้ดไม่ได้ใช้จริง** (Cache/Throttler เป็น in-memory) — ส่วน minio ถอดออกจากทั้งสองคอมโพสแล้ว
จึงมีไฟล์ `infrastructure/docker-compose.lean.yml` ที่ตัด 2 ตัวนี้ออก เหลือ **postgres + backend + frontend + nginx**
RAM idle ~400-450MB → พอดีกับ 2GB

### A.1 เปิด swap (จำเป็น — กัน OOM ตอน build/gen PDF)
```bash
sudo fallocate -l 4G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile && sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab   # ให้ swap กลับมาหลัง reboot
free -h
```

### A.2 Build image (เลือกทางใดทางหนึ่ง)
Next.js build กิน RAM ~2GB → บนเครื่อง 2GB **ต้องมี swap** (A.1) ถึงจะ build ไหว แต่ช้า (1 core)

**ทาง ก. (แนะนำ) build บนเครื่องแรง แล้วส่ง image ไป** — ไม่ต้อง build บน server:
```bash
# บนเครื่อง dev (มี docker):
docker compose -f infrastructure/docker-compose.lean.yml build
docker save smartgov_backend smartgov_frontend | gzip > smartgov-images.tar.gz
scp smartgov-images.tar.gz user@inet-server:~/
# บน server:
gunzip -c smartgov-images.tar.gz | docker load
```
> ชื่อ image จะตาม `container_name`/project — ถ้าโหลดแล้วชื่อไม่ตรง ใช้ `docker images` เช็ค แล้วปรับ `image:` ใน compose ให้ตรง หรือ build บน server ตามทาง ข.

**ทาง ข. build บน server** (มี swap แล้วเท่านั้น):
```bash
cd infrastructure && docker compose -f docker-compose.lean.yml build   # ช้า ~15-25 นาที
```

### A.3 รัน (ใช้ไฟล์ lean ทุกคำสั่ง)
```bash
cd infrastructure
docker compose -f docker-compose.lean.yml up -d
docker compose -f docker-compose.lean.yml ps
docker compose -f docker-compose.lean.yml logs -f backend
```
ขั้นตอนตั้งค่า `.env` / SSL / seed เหมือนข้อ 2-3 ของคู่มือหลักทุกอย่าง
(ใน `infrastructure/.env` ไม่ต้องใส่ `REDIS_PASSWORD`/`MINIO_*` แล้ว — ไม่ได้ใช้)

### A.4 ข้อควรรู้
- **ไฟล์แนบเก็บลงดิสก์** ที่ volume `backend_storage` (โหมด filesystem) แทน MinIO — backup ด้วย `docker run --rm -v infrastructure_backend_storage:/d -v $PWD:/b alpine tar czf /b/files-backup.tgz -C /d .`
- **PDF/รายงาน** จะพีค RAM ชั่วคราว (~300-400MB จาก chromium) — swap รองรับให้ ถ้าใช้หนักพร้อมกันหลายคนอาจหน่วง
- หมายเหตุ: `docker-compose.yml` ตัวหลักถอด minio ออกแล้วเช่นกัน (เหลือ redis ไว้)