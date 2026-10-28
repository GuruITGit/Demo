#!/bin/sh
# ─────────────────────────────────────────────────────────────
# สำรองข้อมูล SmartGov อัตโนมัติ
#   1) ฐานข้อมูล PostgreSQL → db-YYYYmmdd-HHMMSS.dump (pg_dump -Fc บีบอัดในตัว)
#   2) ไฟล์แนบ/อัปโหลด (/data ที่ mount มา) → files-YYYYmmdd-HHMMSS.tar.gz
# รันเป็นลูปทุกวันเวลา BACKUP_TIME · เก็บย้อนหลัง BACKUP_KEEP_DAYS วัน
# รันมือครั้งเดียว:  docker compose -f docker-compose.lean.yml exec backup sh /backup.sh once
# กู้คืน: ดู docs/SELFHOST-UBUNTU.md หัวข้อ "สำรอง/กู้คืนข้อมูล"
# ─────────────────────────────────────────────────────────────
set -u

BACKUP_DIR="${BACKUP_DIR:-/backups}"
KEEP_DAYS="${BACKUP_KEEP_DAYS:-14}"
AT="${BACKUP_TIME:-02:30}"

do_backup() {
  ts=$(date +%Y%m%d-%H%M%S)
  echo "[backup] $(date '+%F %T') เริ่มสำรองข้อมูล..."

  # 1) ฐานข้อมูล — ถ้า dump ล้มเหลว ลบไฟล์ครึ่ง ๆ ทิ้งกันสับสนตอนกู้คืน
  if pg_dump -Fc -f "$BACKUP_DIR/db-$ts.dump"; then
    echo "[backup] ✓ db-$ts.dump ($(du -h "$BACKUP_DIR/db-$ts.dump" | cut -f1))"
  else
    echo "[backup] ❌ pg_dump ล้มเหลว"
    rm -f "$BACKUP_DIR/db-$ts.dump"
    return 1
  fi

  # 2) ไฟล์แนบ (โหมด filesystem) — mount ไว้ที่ /data แบบ read-only
  if [ -d /data ] && [ -n "$(ls -A /data 2>/dev/null)" ]; then
    if tar -czf "$BACKUP_DIR/files-$ts.tar.gz" -C /data .; then
      echo "[backup] ✓ files-$ts.tar.gz ($(du -h "$BACKUP_DIR/files-$ts.tar.gz" | cut -f1))"
    else
      echo "[backup] ⚠️ tar ไฟล์แนบมีปัญหา (ฐานข้อมูลสำรองสำเร็จแล้ว)"
    fi
  fi

  # 3) ลบสำรองเก่าเกินกำหนด
  find "$BACKUP_DIR" -maxdepth 1 -type f \( -name 'db-*.dump' -o -name 'files-*.tar.gz' \) -mtime +"$KEEP_DAYS" -delete 2>/dev/null

  date '+%F %T' > "$BACKUP_DIR/last-success.txt"
  echo "[backup] เสร็จ — เก็บย้อนหลัง $KEEP_DAYS วัน ($(ls "$BACKUP_DIR" | grep -c '^db-') ชุด)"
}

if [ "${1:-}" = "once" ]; then
  do_backup
  exit $?
fi

echo "[backup] scheduler เริ่มทำงาน — สำรองทุกวันเวลา $AT (TZ=${TZ:-UTC}) เก็บ $KEEP_DAYS วัน"
# สำรองทันทีหนึ่งรอบตอนสตาร์ท เพื่อพิสูจน์ว่า config ถูกต้อง (ถ้าพังจะเห็นใน log ทันที)
do_backup || echo "[backup] ⚠️ รอบแรกล้มเหลว — ตรวจการเชื่อมต่อฐานข้อมูล"

while :; do
  # คำนวณวินาทีถึงรอบถัดไปด้วย awk (เลี่ยงปัญหา octal ของเลขมีศูนย์นำใน sh)
  wait_sec=$(awk -v at="$AT" 'BEGIN {
    split(at, t, ":"); tgt = t[1]*3600 + t[2]*60;
    cmd = "date +%H:%M:%S"; cmd | getline n; close(cmd);
    split(n, c, ":"); now = c[1]*3600 + c[2]*60 + c[3];
    d = tgt - now; if (d <= 0) d += 86400; print d;
  }')
  echo "[backup] รอบถัดไปในอีก $wait_sec วินาที"
  sleep "$wait_sec"
  do_backup || echo "[backup] ⚠️ รอบนี้ล้มเหลว จะลองใหม่รอบหน้า"
done
