import { api } from './api';

export interface UploadedFile {
  id: string;
  originalName: string;
  url: string;
  thumbnailUrl?: string;
  caption?: string;
  category?: string;
  mimeType: string;
  fileSize: number;
  refType?: string;
  refId?: string;
  createdAt?: string;
}

export interface UploadOpts {
  bucket?: string;
  refType?: string;
  refId?: string;
  caption?: string;
  category?: string;
}

/** อัปโหลดไฟล์เดียวไปยัง Storage ผ่าน backend */
export async function uploadFile(file: File, opts: UploadOpts = {}): Promise<UploadedFile> {
  const form = new FormData();
  form.append('file', file);
  const params: Record<string, string> = { bucket: opts.bucket ?? 'documents' };
  if (opts.refType) params.refType = opts.refType;
  if (opts.refId) params.refId = opts.refId;
  if (opts.caption) params.caption = opts.caption;
  if (opts.category) params.category = opts.category;
  const { data } = await api.post('/storage/upload', form, {
    params,
    // ปล่อยให้เบราว์เซอร์/axios กำหนด multipart boundary เอง (ไม่ใช้ application/json เริ่มต้น)
    headers: { 'Content-Type': undefined as unknown as string },
  });
  return data.data;
}

/** อัปโหลดหลายไฟล์ตามลำดับ */
export async function uploadFiles(files: File[], opts: UploadOpts = {}): Promise<UploadedFile[]> {
  const out: UploadedFile[] = [];
  for (const f of files) out.push(await uploadFile(f, opts));
  return out;
}

/** รายการไฟล์แนบของรายการหนึ่ง (refType + refId) */
export async function listFilesByRef(refType: string, refId: string): Promise<UploadedFile[]> {
  const { data } = await api.get('/storage/files', { params: { refType, refId } });
  return data.data ?? [];
}

/** ลบไฟล์ */
export async function deleteUploadedFile(id: string): Promise<void> {
  await api.delete(`/storage/${id}`);
}

/** แปลงขนาดไฟล์เป็นข้อความอ่านง่าย */
export function formatFileSize(bytes?: number): string {
  if (!bytes) return '0 KB';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
