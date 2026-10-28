'use client';
import { useRef, useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Trash2, Check, Upload, PenLine } from 'lucide-react';

interface SignatureDrawerProps {
  onSave: (dataUrl: string, type: 'drawn' | 'uploaded') => void;
  onCancel: () => void;
  /** วาดอย่างเดียว (ซ่อนแท็บอัปโหลด) — ใช้ตอนเซ็นสด กันการอัปโหลดภาพลายเซ็นเก่า */
  drawOnly?: boolean;
}

export function SignatureDrawer({ onSave, onCancel, drawOnly = false }: SignatureDrawerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);
  const [mode, setMode] = useState<'draw' | 'upload'>('draw');
  const [uploadedImg, setUploadedImg] = useState<string | null>(null);
  const lastPos = useRef<{ x: number; y: number } | null>(null);

  const getPos = (e: MouseEvent | TouchEvent, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if ('touches' in e) {
      return {
        x: (e.touches[0].clientX - rect.left) * scaleX,
        y: (e.touches[0].clientY - rect.top) * scaleY,
      };
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const startDraw = useCallback((e: MouseEvent | TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    e.preventDefault();
    setIsDrawing(true);
    lastPos.current = getPos(e, canvas);
  }, []);

  const draw = useCallback((e: MouseEvent | TouchEvent) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    e.preventDefault();
    const ctx = canvas.getContext('2d')!;
    const pos = getPos(e, canvas);
    ctx.beginPath();
    ctx.moveTo(lastPos.current!.x, lastPos.current!.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.strokeStyle = '#1a1a2e';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
    lastPos.current = pos;
    setHasDrawn(true);
  }, [isDrawing]);

  const stopDraw = useCallback(() => {
    setIsDrawing(false);
    lastPos.current = null;
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.addEventListener('mousedown', startDraw);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', stopDraw);
    canvas.addEventListener('mouseleave', stopDraw);
    canvas.addEventListener('touchstart', startDraw, { passive: false });
    canvas.addEventListener('touchmove', draw, { passive: false });
    canvas.addEventListener('touchend', stopDraw);
    return () => {
      canvas.removeEventListener('mousedown', startDraw);
      canvas.removeEventListener('mousemove', draw);
      canvas.removeEventListener('mouseup', stopDraw);
      canvas.removeEventListener('mouseleave', stopDraw);
      canvas.removeEventListener('touchstart', startDraw);
      canvas.removeEventListener('touchmove', draw);
      canvas.removeEventListener('touchend', stopDraw);
    };
  }, [startDraw, draw, stopDraw]);

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
  };

  const handleSave = () => {
    if (mode === 'upload' && uploadedImg) {
      onSave(uploadedImg, 'uploaded');
      return;
    }
    const canvas = canvasRef.current;
    if (!canvas || !hasDrawn) return;
    const dataUrl = canvas.toDataURL('image/png');
    onSave(dataUrl, 'drawn');
  };

  const [uploadErr, setUploadErr] = useState('');
  /**
   * อัปโหลดรูปลายเซ็น — ย่อให้ไม่เกิน 600×240px (PNG คงพื้นโปร่งใส) ก่อนใช้
   * รูปถ่ายจากมือถือหลาย MB จะเกินขนาดที่ API รับ (body 1MB) และทำ PDF/ประวัติหนักเกินจำเป็น
   */
  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploadErr('');
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, 600 / img.width, 240 / img.height);
        const c = document.createElement('canvas');
        c.width = Math.max(1, Math.round(img.width * scale));
        c.height = Math.max(1, Math.round(img.height * scale));
        c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
        setUploadedImg(c.toDataURL('image/png'));
      };
      img.onerror = () => setUploadErr('อ่านไฟล์รูปไม่ได้ — กรุณาใช้ไฟล์ PNG หรือ JPG');
      img.src = ev.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const canSave = mode === 'draw' ? hasDrawn : !!uploadedImg;

  return (
    <div className="space-y-4">
      {!drawOnly && (
        <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
          <button onClick={() => setMode('draw')} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${mode === 'draw' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}>
            <PenLine className="h-3.5 w-3.5" />วาดลายเซ็น
          </button>
          <button onClick={() => setMode('upload')} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${mode === 'upload' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}>
            <Upload className="h-3.5 w-3.5" />อัปโหลดรูป
          </button>
        </div>
      )}

      {mode === 'draw' ? (
        <div className="space-y-2">
          <canvas
            ref={canvasRef}
            width={500}
            height={180}
            className="sig-surface w-full border-2 border-dashed border-gray-300 rounded-xl cursor-crosshair touch-none"
            style={{ maxHeight: 180 }}
          />
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-400">วาดลายเซ็นด้วยเมาส์หรือนิ้วในกรอบด้านบน</p>
            <Button variant="outline" size="sm" onClick={clearCanvas} disabled={!hasDrawn}>
              <Trash2 className="h-3.5 w-3.5 mr-1" />ล้าง
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {uploadedImg ? (
            <div className="relative border border-gray-200 rounded-xl overflow-hidden bg-gray-50 flex items-center justify-center h-44">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={uploadedImg} alt="ลายเซ็น" className="sig-surface max-h-40 object-contain rounded-lg" />
              <button onClick={() => setUploadedImg(null)} className="absolute top-2 right-2 p-1 bg-red-100 rounded-full text-red-600 hover:bg-red-200">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <label className="flex flex-col items-center justify-center h-44 border-2 border-dashed border-gray-300 rounded-xl bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors">
              <Upload className="h-8 w-8 text-gray-400 mb-2" />
              <span className="text-sm text-gray-500">คลิกเพื่อเลือกรูปลายเซ็น</span>
              <span className="text-xs text-gray-400 mt-0.5">PNG, JPG (แนะนำพื้นหลังขาว)</span>
              <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={handleUpload} />
            </label>
          )}
        </div>
      )}

      {mode === 'upload' && uploadErr && <p className="text-xs text-red-600">{uploadErr}</p>}

      <div className="flex gap-2 justify-end">
        <Button variant="outline" onClick={onCancel}>ยกเลิก</Button>
        <Button onClick={handleSave} disabled={!canSave}>
          <Check className="h-4 w-4 mr-1" />บันทึกลายเซ็น
        </Button>
      </div>
    </div>
  );
}
