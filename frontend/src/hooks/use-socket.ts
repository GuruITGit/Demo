'use client';
import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '@/stores/auth.store';
import { useNotificationStore } from '@/stores/notification.store';
import { toast } from '@/hooks/use-toast';

export function useSocket() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const incrementUnread = useNotificationStore((s) => s.incrementUnread);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    // เดโม่ไม่มีเซิร์ฟเวอร์เรียลไทม์ — แจ้งเตือนใช้การดึงข้อมูลเป็นระยะแทน
    if (process.env.NEXT_PUBLIC_DEMO_MODE === '1') return;
    if (!isAuthenticated || !accessToken) {
      socketRef.current?.disconnect();
      socketRef.current = null;
      return;
    }

    // already connected with same token → skip
    if (socketRef.current?.connected) return;

    // NEXT_PUBLIC_API_URL อาจเป็น absolute URL (คลาวด์ FE/BE คนละโดเมน) หรือ relative '/v1' (self-host ผ่าน nginx)
    // ถ้าเป็น relative หรือไม่ได้ตั้งค่า ต้องอิง origin ปัจจุบันของหน้าเว็บ ห้าม fallback เป็น localhost เด็ดขาด
    // (จะกลายเป็นยิง ws://localhost:4000 ตรง ๆ จากเบราว์เซอร์ผู้ใช้จริง โดนบล็อกด้วย CSP ทันที)
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || '/v1';
    const baseUrl = apiUrl.startsWith('http')
      ? apiUrl.replace(/\/v1\/?$/, '')
      : window.location.origin;

    const socket = io(`${baseUrl}/ws`, {
      auth: { token: accessToken },
      transports: ['websocket'],
      reconnection: true,
      reconnectionDelay: 3000,
      reconnectionAttempts: 10,
    });

    socketRef.current = socket;

    socket.on('notification:new', (data: { title: string; body: string }) => {
      incrementUnread();
      toast(data.title, { description: data.body });
    });

    return () => {
      socket.off('notification:new');
      socket.disconnect();
      socketRef.current = null;
    };
  }, [isAuthenticated, accessToken]); // eslint-disable-line react-hooks/exhaustive-deps
}
