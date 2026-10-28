import { Injectable, InternalServerErrorException, Logger, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FileUpload } from '../../database/entities/file-upload.entity';
import { SettingsService } from '../settings/settings.service';
import { v4 as uuidv4 } from 'uuid';
import { extname, join, resolve, sep } from 'path';
import { promises as fsp, createReadStream } from 'fs';
import { createHmac, timingSafeEqual } from 'crypto';
import { AttachmentAccessRegistry } from './attachment-access.registry';

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly supabase: SupabaseClient;
  private readonly useSupabase: boolean;

  // bucket ที่เก็บข้อมูลลับ → ต้องเป็น private และเข้าถึงผ่าน signed URL เท่านั้น
  // signatures = ลายเซ็นดิจิทัล (เสี่ยงปลอมแปลง) จึงเป็น private ด้วย
  // หมายเหตุ: ลายเซ็นส่วนใหญ่เก็บเป็น base64 imageData ในตาราง ไม่ได้ใช้ไฟล์ใน bucket
  // เฉพาะลายเซ็นที่อัปโหลดเป็นรูปจะได้ signed URL อายุ 1 ชม. (เปิดหน้าใหม่จะได้ URL ใหม่)
  // avatars ยังเป็น public เพราะเป็นรูปโปรไฟล์ที่ render เป็น <img> ทั่วระบบ
  private readonly privateBuckets = new Set([
    'smartgov-documents',
    'smartgov-temp',
    'smartgov-signatures',
  ]);
  // bucket ที่รู้จักเท่านั้น — ใช้ตรวจก่อนนำ bucket ไปต่อ path/URL (กัน path traversal ผ่านชื่อ bucket)
  private readonly allowedBuckets = new Set([
    'smartgov-documents',
    'smartgov-avatars',
    'smartgov-signatures',
    'smartgov-temp',
  ]);
  private readonly SIGNED_URL_TTL = 3600; // 1 ชั่วโมง

  // MinIO fallback (local dev)
  private minioClient: any;
  /** เก็บไฟล์บนดิสก์ (local dev เมื่อไม่มี Supabase และ MinIO เข้าไม่ได้) — ใช้ได้จริงโดยไม่ต้องพึ่ง infra */
  private fsMode = false;
  /**
   * โหมดเก็บไฟล์ที่ "ระบุชัด" ผ่าน env STORAGE_DRIVER = fs | supabase | (ว่าง = auto)
   * ตั้ง fs บน prod เพื่อกันสลับโหมดเอง — เคยเกิดจริง 05/09/2569: MinIO ตอบ SignatureDoesNotMatch
   * ระบบเลย fallback ไป filesystem เงียบๆ ทำให้ไฟล์ถูกเขียนคนละที่กับที่ตั้งใจ แล้วหายตอนสร้างคอนเทนเนอร์ใหม่
   */
  private readonly driver = (process.env.STORAGE_DRIVER || '').trim().toLowerCase();
  private readonly fsRoot = process.env.STORAGE_FS_ROOT || join(process.cwd(), '.storage');

  constructor(
    private configService: ConfigService,
    @InjectRepository(FileUpload) private fileRepo: Repository<FileUpload>,
    private settings: SettingsService,
    private accessRegistry: AttachmentAccessRegistry,
  ) {
    // โหมดบังคับ: ใช้ดิสก์อย่างเดียว ไม่แตะ MinIO/Supabase → โหมดไม่มีทางสลับเองกลางทาง
    if (this.driver === 'fs') {
      this.fsMode = true;
      this.useSupabase = false;
      this.logger.log(`Storage: filesystem ที่ ${this.fsRoot} (บังคับด้วย STORAGE_DRIVER=fs)`);
      this.logger.warn(`⚠️ path ${this.fsRoot} ต้องถูก mount เป็น volume ถาวร ไม่งั้นไฟล์หายเมื่อสร้างคอนเทนเนอร์ใหม่`);
      return;
    }

    const supabaseUrl = configService.get<string>('supabase.url');
    const supabaseKey = configService.get<string>('supabase.serviceKey');
    this.useSupabase = !!(supabaseUrl && supabaseKey);

    if (this.useSupabase) {
      this.supabase = createClient(supabaseUrl, supabaseKey);
      this.ensureSupabaseBuckets();
      this.logger.log('Storage: Supabase Storage');
    } else {
      this.initMinio();
      this.logger.log('Storage: MinIO (local)');
    }
  }

  private async ensureSupabaseBuckets() {
    const buckets = ['smartgov-documents', 'smartgov-avatars', 'smartgov-signatures', 'smartgov-temp'];
    for (const bucket of buckets) {
      const isPublic = !this.privateBuckets.has(bucket);
      const { error } = await this.supabase.storage.createBucket(bucket, { public: isPublic });
      if (error && !error.message.includes('already exists')) {
        this.logger.warn(`Bucket ${bucket}: ${error.message}`);
      }
      // ถ้า bucket มีอยู่แล้วและเคยถูกตั้งเป็น public → บังคับให้เป็น private สำหรับ bucket ลับ
      if (!isPublic) {
        await this.supabase.storage
          .updateBucket(bucket, { public: false })
          .catch((e) => this.logger.warn(`updateBucket ${bucket}: ${e?.message}`));
      }
    }
  }

  /** URL สำหรับเข้าถึงไฟล์: private bucket → signed URL (อายุจำกัด), public bucket → public URL */
  private async getAccessUrl(bucket: string, objectKey: string): Promise<string> {
    if (this.privateBuckets.has(bucket)) {
      const { data, error } = await this.supabase.storage
        .from(bucket)
        .createSignedUrl(objectKey, this.SIGNED_URL_TTL);
      if (error || !data) {
        this.logger.warn(`createSignedUrl ${bucket}/${objectKey}: ${error?.message}`);
        return '';
      }
      return data.signedUrl;
    }
    const { data } = this.supabase.storage.from(bucket).getPublicUrl(objectKey);
    return data.publicUrl;
  }

  private initMinio() {
    try {
      const Minio = require('minio');
      this.minioClient = new Minio.Client({
        endPoint: this.configService.get('minio.endpoint'),
        port: this.configService.get('minio.port'),
        useSSL: this.configService.get('minio.useSSL'),
        accessKey: this.configService.get('minio.accessKey'),
        secretKey: this.configService.get('minio.secretKey'),
      });
      // ตรวจว่า MinIO เข้าถึงได้จริง — ถ้าไม่ได้ ใช้ filesystem แทน (แนบไฟล์ยังทำงาน)
      this.minioClient.listBuckets()
        .then(() => this.ensureMinioBuckets())
        .catch((e: any) => {
          this.fsMode = true;
          // ERROR ไม่ใช่ WARN — เคสนี้ทำไฟล์หายจริงมาแล้ว ต้องเห็นชัดในล็อก
          this.logger.error(
            `⚠️ MinIO เข้าไม่ได้ (${e?.code || e?.message}) → ตกไปใช้ filesystem ที่ ${this.fsRoot} ` +
            `— ถ้า path นี้ไม่ได้ mount เป็น volume ถาวร ไฟล์ที่อัปโหลดจะหายเมื่อสร้างคอนเทนเนอร์ใหม่ ` +
            `(บน prod ให้ตั้ง STORAGE_DRIVER=fs เพื่อไม่ให้โหมดสลับเอง)`);
        });
    } catch (e) {
      this.fsMode = true;
      this.logger.error('⚠️ MinIO ไม่พร้อม → ตกไปใช้ filesystem: ' + e.message);
    }
  }

  // ─── ความปลอดภัยในการเข้าถึงไฟล์ ───
  /** bucket ต้องเป็นชื่อที่รู้จักเท่านั้น (กัน path traversal ผ่านชื่อ bucket เช่น "..") */
  assertBucket(bucket: string) {
    if (!this.allowedBuckets.has(bucket)) throw new NotFoundException('ไม่พบไฟล์');
  }

  /** bucket ที่ต้องมี signed token จึงจะดาวน์โหลดได้ (avatars เป็นสาธารณะ เพราะ render เป็น <img> ทั่วระบบ) */
  isBucketPrivate(bucket: string): boolean {
    return this.privateBuckets.has(bucket);
  }

  private fileTokenSecret(): string {
    return this.configService.get<string>('jwt.secret') || 'dev-jwt-secret';
  }

  private signFileToken(bucket: string, objectKey: string, exp: number): string {
    return createHmac('sha256', this.fileTokenSecret())
      .update(`${bucket}\n${objectKey}\n${exp}`)
      .digest('base64url');
  }

  /** ตรวจ signed token ตอนดาวน์โหลดไฟล์ใน private bucket (self-host/MinIO) */
  verifyFileToken(bucket: string, objectKey: string, exp?: string, sig?: string): boolean {
    if (!exp || !sig) return false;
    const expNum = Number(exp);
    if (!Number.isFinite(expNum) || expNum < Date.now()) return false;
    const expected = this.signFileToken(bucket, objectKey, expNum);
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    return a.length === b.length && timingSafeEqual(a, b);
  }

  /** สร้าง URL พร้อม signed token อายุสั้นสำหรับไฟล์ใน private bucket (ใช้ตอน MinIO/filesystem) */
  private buildSignedFileUrl(bucket: string, objectKey: string): string {
    const appUrl = this.configService.get('appUrl');
    const exp = Date.now() + this.SIGNED_URL_TTL * 1000;
    const sig = this.signFileToken(bucket, objectKey, exp);
    return `${appUrl}/v1/storage/files/${bucket}/${encodeURI(objectKey)}?exp=${exp}&sig=${sig}`;
  }

  /**
   * ถ้า fileUrl เป็นไฟล์ใน private bucket ของเรา → ออก signed URL ใหม่ (อายุจำกัด), ไม่งั้นคืนค่าเดิม
   * ใช้กับโมดูลที่เก็บ URL ไฟล์ดิบไว้เอง (เช่น คลังเอกสาร doc.fileUrl) แล้ว render/ดาวน์โหลดตรงๆ
   * — โมดูลต้องตรวจสิทธิ์การเข้าถึงเอกสารก่อนเรียกเสมอ (endpoint นี้ปลอด token ยึด signature อย่างเดียว)
   */
  signUrlIfPrivate<T extends string | null | undefined>(fileUrl: T): T {
    if (!fileUrl) return fileUrl;
    const marker = '/v1/storage/files/';
    const i = fileUrl.indexOf(marker);
    if (i === -1) return fileUrl; // supabase / text:// / URL อื่น → คืนเดิม
    const rest = fileUrl.slice(i + marker.length).split('?')[0];
    const slash = rest.indexOf('/');
    if (slash === -1) return fileUrl;
    const bucket = rest.slice(0, slash);
    const objectKey = rest.slice(slash + 1);
    if (!this.privateBuckets.has(bucket)) return fileUrl;
    return this.buildSignedFileUrl(bucket, objectKey) as T;
  }

  // ─── Filesystem storage helpers (local dev fallback) ───
  private fsPath(bucket: string, objectKey: string) {
    // กัน path traversal — objectKey มาจาก URL (route เป็น @Public)
    // assertBucket การันตีว่า bucket ไม่มี ".." → bucketRoot อยู่ใต้ fsRoot เสมอ
    this.assertBucket(bucket);
    const bucketRoot = resolve(this.fsRoot, bucket);
    const full = resolve(bucketRoot, objectKey);
    // ยึด bucketRoot เป็นฐาน — ล็อก objectKey ให้อยู่ในกองของตัวเอง
    // (ถ้ายึดแค่ fsRoot จะข้ามไป bucket อื่นได้ เช่น avatars(public) → documents(private))
    if (full !== bucketRoot && !full.startsWith(bucketRoot + sep)) {
      throw new NotFoundException('ไม่พบไฟล์');
    }
    return full;
  }
  private async fsWrite(bucket: string, objectKey: string, buffer: Buffer) {
    const full = this.fsPath(bucket, objectKey);
    await fsp.mkdir(join(full, '..'), { recursive: true });
    await fsp.writeFile(full, buffer);
  }

  private async ensureMinioBuckets() {
    const buckets = ['smartgov-documents', 'smartgov-avatars', 'smartgov-signatures', 'smartgov-temp'];
    for (const bucket of buckets) {
      try {
        const exists = await this.minioClient.bucketExists(bucket).catch(() => false);
        if (!exists) {
          await this.minioClient.makeBucket(bucket);
          this.logger.log(`MinIO bucket created: ${bucket}`);
        }
      } catch (e: any) {
        this.logger.warn(`ensureMinioBuckets ${bucket}: ${e?.message}`);
      }
    }
  }

  async uploadFile(
    file: Express.Multer.File,
    bucketKey: string,
    uploadedBy: string,
    refType?: string,
    refId?: string,
    caption?: string,
    category?: string,
  ): Promise<FileUpload> {
    // บังคับขนาดไฟล์สูงสุดตามค่าตั้งค่าระบบ (file.max_size_mb) — admin ปรับได้จริง
    const maxMb = Number(await this.settings.getValue('file.max_size_mb')) || 50;
    if (file.size > maxMb * 1024 * 1024) {
      throw new BadRequestException(`ไฟล์ใหญ่เกินกำหนด (สูงสุด ${maxMb} MB)`);
    }
    const bucketMap: Record<string, string> = {
      documents: 'smartgov-documents',
      avatars: 'smartgov-avatars',
      signatures: 'smartgov-signatures',
      temp: 'smartgov-temp',
    };
    const bucket = bucketMap[bucketKey] || this.configService.get(`minio.buckets.${bucketKey}`) || 'smartgov-documents';

    const ext = extname(file.originalname);
    const storedName = `${uuidv4()}${ext}`;
    const objectKey = `${new Date().getFullYear()}/${new Date().getMonth() + 1}/${storedName}`;

    // รูปภาพ: บีบอัด (resize ≤1920) + สร้าง thumbnail อัตโนมัติ (ถ้า sharp ใช้ได้)
    let mainBuffer = file.buffer;
    let mainSize = file.size;
    let thumbnailUrl: string | undefined;
    if (this.isImage(file.mimetype, file.originalname)) {
      const { main, thumb } = await this.processImage(file.buffer, file.mimetype);
      if (main && main.length < file.buffer.length) { mainBuffer = main; mainSize = main.length; }
      if (thumb) {
        try { thumbnailUrl = await this.storeBuffer(bucket, `${objectKey}.thumb.jpg`, thumb, 'image/jpeg'); }
        catch (e: any) { this.logger.warn('thumbnail store failed: ' + e?.message); }
      }
    }

    const url = await this.storeBuffer(bucket, objectKey, mainBuffer, file.mimetype);

    return this.fileRepo.save({
      originalName: this.fixThaiFilename(file.originalname),
      storedName,
      mimeType: file.mimetype,
      fileSize: mainSize,
      bucket,
      objectKey,
      url,
      thumbnailUrl,
      caption: caption || null,
      category: category || null,
      refType,
      refId,
      uploadedBy,
      isOrphan: !refId,
    });
  }

  private isImage(mime?: string, name?: string): boolean {
    return (mime || '').toLowerCase().startsWith('image/') || /\.(png|jpe?g|gif|webp)$/i.test(name || '');
  }

  /**
   * ซ่อมชื่อไฟล์ไทยที่เพี้ยน (rework v20000) — multipart parser ถอด UTF-8 เป็น latin1
   * ทำให้ชื่อไทยกลายเป็น mojibake (เช่น "à¸«à¸±..."). ถอดกลับเฉพาะเมื่อ:
   * ชื่อยังไม่มีอักษรไทย + มีอักษรช่วง Latin-1 supplement + ถอดแล้วได้อักษรไทยจริง (กันพังชื่อที่ถูกอยู่แล้ว)
   */
  private fixThaiFilename(name?: string): string {
    const s = name || "";
    const inRange = (x: string, lo: number, hi: number) => {
      for (let i = 0; i < x.length; i++) { const c = x.charCodeAt(i); if (c >= lo && c <= hi) return true; }
      return false;
    };
    const hasThai = (x: string) => inRange(x, 0x0e00, 0x0e7f);
    const hasLatin1Supp = (x: string) => inRange(x, 0x0080, 0x00ff);
    if (hasThai(s)) return s;
    if (hasLatin1Supp(s)) {
      try {
        const fixed = Buffer.from(s, "latin1").toString("utf8");
        if (hasThai(fixed)) return fixed;
      } catch (e) { /* keep original */ }
    }
    return s;
  }

  /** บีบอัดรูป + สร้าง thumbnail — ถ้า sharp ไม่พร้อมคืนค่าว่าง (ใช้ไฟล์เดิมต่อได้) */
  private async processImage(buffer: Buffer, mime: string): Promise<{ main?: Buffer; thumb?: Buffer }> {
    let sharp: any;
    try { sharp = require('sharp'); } catch { return {}; }
    const out: { main?: Buffer; thumb?: Buffer } = {};
    try {
      let pipe: any = sharp(buffer, { failOn: 'none' }).rotate().resize({ width: 1920, height: 1920, fit: 'inside', withoutEnlargement: true });
      if (mime.includes('png')) pipe = pipe.png({ compressionLevel: 9 });
      else if (mime.includes('webp')) pipe = pipe.webp({ quality: 82 });
      else if (mime.includes('gif')) pipe = null; // ไม่บีบ gif (กันภาพเคลื่อนไหวเสีย)
      else pipe = pipe.jpeg({ quality: 82, mozjpeg: true });
      if (pipe) out.main = await pipe.toBuffer();
    } catch (e: any) { this.logger.warn('image compress failed: ' + e?.message); }
    try {
      out.thumb = await sharp(buffer, { failOn: 'none' }).rotate()
        .resize({ width: 400, height: 400, fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 70 }).toBuffer();
    } catch (e: any) { this.logger.warn('thumbnail gen failed: ' + e?.message); }
    return out;
  }

  /** เก็บ buffer ลง storage (supabase/minio/filesystem) แล้วคืน URL — ใช้ทั้งไฟล์หลักและ thumbnail */
  /**
   * เก็บไฟล์แนบที่ส่งมาจากฝั่งประชาชน (เช่น สลิปโอนเงินค่าน้ำ) — ไม่ผูกกับผู้ใช้ในระบบ
   * จึงไม่สร้างระเบียนใน file_uploads (ซึ่งบังคับ uploaded_by) แต่คืน URL ให้ผู้เรียกเก็บเอง
   * รับเฉพาะรูปภาพ และจำกัดขนาดแยกจากไฟล์ภายใน (สลิปเป็นรูปถ่าย ไม่ควรใหญ่)
   */
  async storeCitizenAttachment(buffer: Buffer, mime: string, originalName: string, folder = 'slips'): Promise<string> {
    if (!this.isImage(mime, originalName)) throw new BadRequestException('แนบได้เฉพาะไฟล์รูปภาพ');
    const maxMb = 10;
    if (buffer.length > maxMb * 1024 * 1024) throw new BadRequestException(`รูปใหญ่เกินกำหนด (สูงสุด ${maxMb} MB)`);

    let out = buffer;
    const processed = await this.processImage(buffer, mime).catch(() => null);
    if (processed?.main && processed.main.length < buffer.length) out = processed.main;

    const ext = extname(originalName) || '.jpg';
    const key = `${folder}/${new Date().getFullYear()}/${new Date().getMonth() + 1}/${uuidv4()}${ext}`;
    return this.storeBuffer('smartgov-documents', key, out, mime);
  }

  private async storeBuffer(bucket: string, objectKey: string, buffer: Buffer, mime: string): Promise<string> {
    if (this.useSupabase) {
      const { error } = await this.supabase.storage.from(bucket).upload(objectKey, buffer, { contentType: mime, upsert: true });
      if (error) { this.logger.error('Supabase upload failed', error); throw new InternalServerErrorException('ไม่สามารถอัปโหลดไฟล์ได้'); }
      return this.getAccessUrl(bucket, objectKey);
    }
    const appUrl = this.configService.get('appUrl');
    if (this.fsMode || !this.minioClient) {
      await this.fsWrite(bucket, objectKey, buffer);
      return `${appUrl}/v1/storage/files/${bucket}/${objectKey}`;
    }
    try {
      await this.minioClient.putObject(bucket, objectKey, buffer, buffer.length, { 'Content-Type': mime });
      return `${appUrl}/v1/storage/files/${bucket}/${objectKey}`;
    } catch (err: any) {
      this.logger.warn('MinIO upload failed → filesystem fallback: ' + err?.message);
      this.fsMode = true;
      await this.fsWrite(bucket, objectKey, buffer);
      return `${appUrl}/v1/storage/files/${bucket}/${objectKey}`;
    }
  }

  async getFileStream(bucket: string, objectKey: string) {
    if (this.useSupabase) {
      const { data, error } = await this.supabase.storage.from(bucket).download(objectKey);
      if (error || !data) throw new NotFoundException('ไม่พบไฟล์');
      return data.stream();
    }
    if (this.fsMode || !this.minioClient) {
      const full = this.fsPath(bucket, objectKey);
      try { await fsp.access(full); } catch { throw new NotFoundException('ไม่พบไฟล์'); }
      return createReadStream(full);
    }
    return this.minioClient.getObject(bucket, objectKey);
  }

  /** อ่านไฟล์เป็น Buffer (ใช้ตอนประทับตรา PDF — ต้องการ bytes ดิบ) */
  async getFileBuffer(bucket: string, objectKey: string): Promise<Buffer> {
    if (this.useSupabase) {
      const { data, error } = await this.supabase.storage.from(bucket).download(objectKey);
      if (error || !data) throw new NotFoundException('ไม่พบไฟล์');
      return Buffer.from(await data.arrayBuffer());
    }
    if (this.fsMode || !this.minioClient) {
      try { return await fsp.readFile(this.fsPath(bucket, objectKey)); }
      catch { throw new NotFoundException('ไม่พบไฟล์'); }
    }
    const stream = await this.minioClient.getObject(bucket, objectKey);
    const chunks: Buffer[] = [];
    for await (const c of stream) chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c));
    return Buffer.concat(chunks);
  }

  async getPublicUrl(bucket: string, objectKey: string): Promise<string | null> {
    if (this.useSupabase) {
      // private bucket → signed URL อายุจำกัด, public bucket → public URL
      return (await this.getAccessUrl(bucket, objectKey)) || null;
    }
    return null;
  }

  async deleteFile(id: string, userId: string) {
    const file = await this.fileRepo.findOne({ where: { id } });
    if (!file) return;

    const keys = [file.objectKey];
    if (file.thumbnailUrl) keys.push(`${file.objectKey}.thumb.jpg`); // ลบ thumbnail ที่คู่กันด้วย
    for (const key of keys) await this.removeObject(file.bucket, key);

    await this.fileRepo.softDelete(id);
  }

  private async removeObject(bucket: string, objectKey: string) {
    if (this.useSupabase) {
      const { error } = await this.supabase.storage.from(bucket).remove([objectKey]);
      if (error) this.logger.warn(`Supabase delete failed: ${error.message}`);
    } else if (this.fsMode || !this.minioClient) {
      await fsp.unlink(this.fsPath(bucket, objectKey)).catch((e: any) => this.logger.warn(`FS delete failed: ${e.message}`));
    } else {
      await this.minioClient.removeObject(bucket, objectKey).catch((e: any) => this.logger.warn(`MinIO delete failed: ${e.message}`));
    }
  }

  /**
   * รายการไฟล์แนบของรายการหนึ่ง (refType/refId)
   * - ส่ง `user` มา (เรียกจาก endpoint สาธารณะ /storage/files) → บังคับตรวจสิทธิ์:
   *   (ก) ตรวจสิทธิ์เห็นรายการต้นทางผ่าน AttachmentAccessRegistry ราย refType (เช่น ชั้นความลับสารบรรณ)
   *   (ข) กันดูข้ามหน่วยงาน (ไฟล์ที่ผู้อัปโหลดอยู่คนละ org)
   * - ไม่ส่ง `user` (เรียกภายในหลังตรวจสิทธิ์แล้ว เช่น ticket.findOne) → คืนทั้งหมด
   */
  async getFilesByRef(refType: string, refId: string, user?: any) {
    if (user) {
      const allowed = await this.accessRegistry.canAccess(refType, refId, user);
      if (!allowed) throw new ForbiddenException('คุณไม่มีสิทธิ์เข้าถึงไฟล์แนบของรายการนี้');
    }
    const orgId = user?.organizationId;
    const rows = await this.fileRepo.find({
      where: { refType, refId, deletedAt: null },
      relations: ['uploader'],
    });
    // กันดูข้ามหน่วยงาน — คืนเฉพาะไฟล์ที่ผู้อัปโหลดอยู่หน่วยงานเดียวกับผู้เรียก
    const files = orgId ? rows.filter((f) => f.uploader?.organizationId === orgId) : rows;

    // ออก signed URL อายุจำกัดใหม่ทุกครั้งสำหรับไฟล์ใน private bucket
    // (Supabase = signed URL ของ Supabase, MinIO/filesystem = signed token ของเราเอง)
    if (this.useSupabase) {
      return Promise.all(
        files.map(async (f) => ({
          ...f, uploader: undefined,
          url: this.privateBuckets.has(f.bucket) ? await this.getAccessUrl(f.bucket, f.objectKey) : f.url,
          thumbnailUrl: f.thumbnailUrl && this.privateBuckets.has(f.bucket)
            ? await this.getAccessUrl(f.bucket, `${f.objectKey}.thumb.jpg`)
            : f.thumbnailUrl,
        })),
      );
    }
    return files.map((f) => ({
      ...f, uploader: undefined,
      url: this.privateBuckets.has(f.bucket) ? this.buildSignedFileUrl(f.bucket, f.objectKey) : f.url,
      thumbnailUrl: f.thumbnailUrl && this.privateBuckets.has(f.bucket)
        ? this.buildSignedFileUrl(f.bucket, `${f.objectKey}.thumb.jpg`)
        : f.thumbnailUrl,
    }));
  }
}
