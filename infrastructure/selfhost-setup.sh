#!/usr/bin/env bash
# SmartGov — สคริปต์ติดตั้ง self-host (lean stack) แบบรวดเดียว
#
# ใช้หลัง git clone แล้ว:
#   bash infrastructure/selfhost-setup.sh <SERVER_IP> [ADMIN_PASSWORD]
# เช่น:
#   bash infrastructure/selfhost-setup.sh 203.154.140.209
#
# สคริปต์จะ: สร้างรหัสลับใหม่ (DB/JWT) + เขียน backend/.env & infrastructure/.env
#            + ทำ self-signed cert + build + รัน docker compose (lean)
# ปลอดภัยกับการรันซ้ำ: ถ้ามี backend/.env หรือ cert อยู่แล้วจะไม่ทับ
set -euo pipefail

cd "$(dirname "$0")/.."   # ไป repo root

IP="${1:-}"
ADMIN_PW="${2:-}"
[ -z "$IP" ] && read -rp "Server IP (เช่น 203.154.140.209): " IP
[ -z "$ADMIN_PW" ] && read -rp "รหัส admin ที่ต้องการ: " ADMIN_PW

DB_PASS="$(openssl rand -hex 16)"
JWT="$(openssl rand -hex 32)"
JWT_REFRESH="$(openssl rand -hex 32)"

# ตั้งค่า key=value (แทนที่ถ้ามี / เพิ่มถ้าไม่มี)
setenv() {
  local k="$1" v="$2" f="$3"
  if grep -q "^${k}=" "$f"; then
    sed -i "s|^${k}=.*|${k}=${v}|" "$f"
  else
    echo "${k}=${v}" >> "$f"
  fi
}

if [ -f backend/.env ]; then
  echo "==> backend/.env มีอยู่แล้ว — อัปเดตเฉพาะค่าที่จำเป็น (ไม่ generate รหัสใหม่ทับ)"
  setenv APP_URL "https://${IP}" backend/.env
  setenv FRONTEND_URL "https://${IP}" backend/.env
else
  cp backend/.env.example backend/.env
  setenv NODE_ENV production backend/.env
  setenv PORT 4000 backend/.env
  setenv APP_URL "https://${IP}" backend/.env
  setenv FRONTEND_URL "https://${IP}" backend/.env
  setenv DB_HOST postgres backend/.env
  setenv DB_USERNAME postgres backend/.env
  setenv DB_PASSWORD "$DB_PASS" backend/.env
  setenv DB_DATABASE smartgov backend/.env
  setenv JWT_SECRET "$JWT" backend/.env
  setenv JWT_REFRESH_SECRET "$JWT_REFRESH" backend/.env
  setenv SEED_ON_START true backend/.env
  setenv INITIAL_ADMIN_USERNAME admin backend/.env
  setenv INITIAL_ADMIN_PASSWORD "$ADMIN_PW" backend/.env
  printf 'DB_NAME=smartgov\nDB_USER=postgres\nDB_PASS=%s\n' "$DB_PASS" > infrastructure/.env
  echo "==> สร้าง backend/.env + infrastructure/.env (รหัส DB/JWT generate ใหม่แล้ว)"
fi

# self-signed cert (ทำครั้งเดียว)
mkdir -p infrastructure/nginx/ssl
if [ ! -f infrastructure/nginx/ssl/cert.pem ]; then
  openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout infrastructure/nginx/ssl/key.pem \
    -out    infrastructure/nginx/ssl/cert.pem \
    -subj "/CN=${IP}"
  echo "==> สร้าง self-signed cert สำหรับ ${IP}"
fi

echo "==> build + start (lean) ... รอบแรกนานหน่อย"
cd infrastructure
docker compose -f docker-compose.lean.yml up -d --build

echo ""
echo "================== เสร็จ =================="
echo "รอ ~1 นาทีให้ migration+seed เสร็จ แล้วเช็ค:"
echo "  docker compose -f docker-compose.lean.yml ps"
echo "  curl -k https://localhost/health"
echo "เข้าเว็บ: https://${IP}  (login: admin / รหัสที่ตั้ง)"
echo "หลังเข้าได้ครั้งแรก ปิด seed:"
echo "  sed -i 's/^SEED_ON_START=.*/SEED_ON_START=false/' ../backend/.env && docker compose -f docker-compose.lean.yml up -d"
echo "==========================================="
