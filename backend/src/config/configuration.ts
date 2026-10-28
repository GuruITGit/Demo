// ค่า secret ที่รู้กันในรีโพ/ตัวอย่าง — ห้ามใช้จริงบน production (ปลอม JWT ได้)
const KNOWN_WEAK_SECRETS = new Set([
  'dev-jwt-secret',
  'dev-refresh-secret',
  'your-super-secret-jwt-key-change-in-production',
  'your-super-secret-refresh-key-change-in-production',
  'replace-with-64-char-random-string',
  'replace-with-another-64-char-random-string',
]);

/** บน production ต้องตั้ง secret ที่ปลอดภัยจริง ไม่งั้นหยุดบูต (กันปลอม JWT เป็น SUPER_ADMIN) */
function assertStrongSecrets(nodeEnv: string) {
  if (nodeEnv !== 'production') return;
  const bad: string[] = [];
  for (const key of ['JWT_SECRET', 'JWT_REFRESH_SECRET']) {
    const v = process.env[key];
    if (!v || KNOWN_WEAK_SECRETS.has(v) || v.length < 32) bad.push(key);
  }
  if (bad.length) {
    throw new Error(
      `[SECURITY] ตั้งค่า ${bad.join(', ')} ให้เป็น secret สุ่มยาว >= 32 ตัวอักษร ` +
      `ก่อนรันบน production (ห้ามใช้ค่า default/placeholder — มิฉะนั้นผู้โจมตีปลอม token เป็นผู้ดูแลระบบสูงสุดได้)`,
    );
  }
}

export default () => {
  const nodeEnv = process.env.NODE_ENV || 'development';
  assertStrongSecrets(nodeEnv);
  return {
  nodeEnv,
  port: parseInt(process.env.PORT, 10) || 4000,
  appUrl: process.env.APP_URL || 'http://localhost:4000',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',

  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT, 10) || 5432,
    username: process.env.DB_USERNAME || 'smartgov',
    password: process.env.DB_PASSWORD || 'smartgov_password',
    database: process.env.DB_DATABASE || 'smartgov_db',
    synchronize: process.env.DB_SYNCHRONIZE === 'true',
    logging: process.env.DB_LOGGING === 'true',
    // Supabase/managed Postgres บังคับ SSL — เปิดด้วย DB_SSL=true (cert เป็น self-signed → ไม่ verify)
    ssl: process.env.DB_SSL === 'true',
  },

  jwt: {
    secret: process.env.JWT_SECRET || 'dev-jwt-secret',
    expiresIn: process.env.JWT_EXPIRES_IN || '15m',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },

  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT, 10) || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
    db: parseInt(process.env.REDIS_DB, 10) || 0,
  },

  minio: {
    endpoint: process.env.MINIO_ENDPOINT || 'localhost',
    port: parseInt(process.env.MINIO_PORT, 10) || 9000,
    useSSL: process.env.MINIO_USE_SSL === 'true',
    accessKey: process.env.MINIO_ACCESS_KEY || 'minioadmin',
    secretKey: process.env.MINIO_SECRET_KEY || 'minioadmin',
    buckets: {
      documents: process.env.MINIO_BUCKET_DOCUMENTS || 'smartgov-documents',
      avatars: process.env.MINIO_BUCKET_AVATARS || 'smartgov-avatars',
      signatures: process.env.MINIO_BUCKET_SIGNATURES || 'smartgov-signatures',
      temp: process.env.MINIO_BUCKET_TEMP || 'smartgov-temp',
    },
  },

  supabase: {
    url: process.env.SUPABASE_URL,
    anonKey: process.env.SUPABASE_ANON_KEY,
    serviceKey: process.env.SUPABASE_SERVICE_KEY,
  },

  smtp: {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT, 10) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    fromName: process.env.SMTP_FROM_NAME || 'SmartGov Office',
    fromEmail: process.env.SMTP_FROM_EMAIL || 'noreply@smartgov.local',
  },

  line: {
    notifyToken: process.env.LINE_NOTIFY_TOKEN,
    channelId: process.env.LINE_CHANNEL_ID,
    channelSecret: process.env.LINE_CHANNEL_SECRET,
    channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  },

  throttle: {
    ttl: parseInt(process.env.THROTTLE_TTL, 10) || 60000,
    limit: parseInt(process.env.THROTTLE_LIMIT, 10) || 100,
  },

  upload: {
    maxFileSizeMB: parseInt(process.env.MAX_FILE_SIZE_MB, 10) || 50,
    allowedTypes: (process.env.ALLOWED_FILE_TYPES || 'pdf,docx,xlsx,jpg,jpeg,png,zip').split(','),
  },

  initialAdmin: {
    username: process.env.INITIAL_ADMIN_USERNAME || 'admin',
    email: process.env.INITIAL_ADMIN_EMAIL || 'admin@smartgov.local',
    password: process.env.INITIAL_ADMIN_PASSWORD || 'ChangeMe@Local1',
  },
  };
};
