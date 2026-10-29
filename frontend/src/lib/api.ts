import axios, { AxiosError } from 'axios';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/v1';

export const api = axios.create({
  baseURL: API_BASE,
  // ไม่ตั้ง Content-Type default เป็น application/json:
  // axios 1.x ถ้า default เป็น json + body เป็น FormData จะแปลง FormData เป็น JSON (ไฟล์กลายเป็น {})
  // ทำให้อัปโหลดไฟล์ผ่านเบราว์เซอร์พัง — ปล่อยให้ axios ใส่ json เองเมื่อ body เป็น object,
  // และใส่ multipart/form-data (พร้อม boundary) เองเมื่อ body เป็น FormData
  timeout: 60000,
});

// เดโม่ (Vercel): ตอบจากข้อมูลจำลองในเบราว์เซอร์แทน backend — ตัวแปรนี้ถูกแทนค่าตอน build
// จึงไม่ติดไปกับ build จริงของ อบต. (ดู lib/demo/)
if (process.env.NEXT_PUBLIC_DEMO_MODE === '1') {
  api.defaults.adapter = (config) => import('./demo/adapter').then((m) => m.demoAdapter(config));
}

// กัน refresh ชนกัน: เมื่อ 401 หลายคำขอพร้อมกัน ให้ยิง /auth/refresh แค่ครั้งเดียว
// แล้วทุกคำขอรอ promise เดียวกัน (backend หมุน+เพิกถอน refresh token ทุกครั้ง ถ้ายิงซ้ำจะถูก revoke → หลุด login)
let refreshPromise: Promise<string> | null = null;

function runRefresh(): Promise<string> {
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    const refreshToken = localStorage.getItem('refresh_token');
    if (!refreshToken) throw new Error('no refresh token');
    const { data } = await axios.post(`${API_BASE}/auth/refresh`, { refreshToken });
    const newToken = data.data.accessToken;
    localStorage.setItem('access_token', newToken);
    if (data.data.refreshToken) localStorage.setItem('refresh_token', data.data.refreshToken);
    return newToken;
  })();
  // เคลียร์ทิ้งหลังเสร็จ (สำเร็จหรือไม่ก็ตาม) ให้รอบหน้าเริ่มใหม่ได้
  // (.catch กัน unhandled rejection จาก promise ที่ .finally สร้าง — ผู้เรียกจัดการ error เองอยู่แล้ว)
  refreshPromise.finally(() => { refreshPromise = null; }).catch(() => {});
  return refreshPromise;
}

api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('access_token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  async (err: AxiosError) => {
    const original = err.config as any;
    // 401 จากการล็อกอินเอง = รหัสผิด ไม่ใช่เซสชันหมด → ไม่ต่ออายุ/ไม่โหลดหน้าใหม่ ให้ฟอร์มแสดงข้อความผิดพลาด
    const isAuthCall = /\/auth\/(login|hub-login|refresh)$/.test(original?.url || '');
    if (err.response?.status === 401 && original && !original._retry && !isAuthCall) {
      original._retry = true;
      try {
        const newToken = await runRefresh();
        original.headers.Authorization = `Bearer ${newToken}`;
        return api(original);
      } catch {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        // เซสชันเจ้าหน้าที่หมด → ฟอร์มเข้าระบบเจ้าหน้าที่ · อยู่หน้าประชาชนไม่ต้องเด้งไปไหน
        if (!/^\/(citizen|checkbill)(\/|$)/.test(window.location.pathname)) window.location.href = '/login?staff=1';
      }
    }
    return Promise.reject(err);
  }
);

/**
 * ดึงข้อความ error ที่อ่านรู้เรื่องออกจาก error ของ axios
 * backend ตอบรูปแบบ `{ success:false, error:{ code, message, details? } }` (http-exception.filter)
 * — ห้ามอ่าน `data.message` ตรงๆ เพราะไม่มีฟิลด์นี้ ผู้ใช้จะเห็นแต่ข้อความ fallback กลางๆ
 */
export function getErrorMessage(err: unknown, fallback = 'เกิดข้อผิดพลาด'): string {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as any;
    const message: string | undefined = data?.error?.message || data?.message;
    // ข้อผิดพลาดจาก class-validator → message = "ข้อมูลไม่ถูกต้อง" + details รายฟิลด์
    const details: Array<{ message?: string }> | undefined = data?.error?.details;
    if (message && details?.length) {
      const first = details.map((d) => d?.message).filter(Boolean)[0];
      return first ? `${message} (${first})` : message;
    }
    if (message) return message;
    if (!err.response) return 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ — ตรวจสอบอินเทอร์เน็ตแล้วลองใหม่';
    return fallback;
  }
  if (err instanceof Error) return err.message;
  return fallback;
}
