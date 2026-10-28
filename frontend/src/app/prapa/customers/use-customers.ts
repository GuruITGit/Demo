import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, getErrorMessage } from '@/lib/water-api';
import { toast } from '@/hooks/use-toast';
import type { Customer, Detail } from './types';

export function useVillages() {
  return useQuery({
    queryKey: ['water-villages'],
    queryFn: async () => (await api.get('/water/customers/villages')).data.data as { villageNo: number; count: number }[],
  });
}

export type NextCodeGroup = { prefix: string; lastCode: string; nextCode: string; count: number };

/** แนะนำรหัสผู้ใช้น้ำถัดไป (แยกตามกลุ่มคำนำหน้า) — เรียกเฉพาะตอนเปิดฟอร์ม "เพิ่มใหม่" (enabled) */
export function useNextCustomerCode(enabled: boolean) {
  return useQuery({
    queryKey: ['water-next-customer-code'],
    queryFn: async () => (await api.get('/water/customers/next-code')).data.data as { groups: NextCodeGroup[] },
    enabled,
  });
}

export function useCustomersList(params: { page: number; search: string; villageNo: string; status: string; overdue: string }) {
  return useQuery({
    queryKey: ['prapa-customers', params.page, params.search, params.villageNo, params.status, params.overdue],
    queryFn: async () => (await api.get('/water/customers', {
      params: {
        page: params.page, limit: 20,
        search: params.search || undefined,
        villageNo: params.villageNo || undefined,
        status: params.status || undefined,
        overdue: params.overdue || undefined,
      },
    })).data,
    placeholderData: (p) => p,
  });
}

/** บันทึกลูกค้า (เพิ่ม/แก้ไข) — `editing` มาจาก state ของหน้าเรียก ณ ตอน render ล่าสุดเสมอ */
export function useSaveCustomer(editing: Partial<Customer> | null, onSaved: () => void) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => {
      const e = editing || {};
      const body: any = {
        customerCode: e.customerCode, fullName: e.fullName, villageNo: e.villageNo || undefined,
        phone: e.phone?.trim() || undefined, address: e.address?.trim() || undefined,
        nationalId: e.nationalId?.trim() || undefined, meterSerial: e.meterSerial?.trim() || undefined,
        meterLastReading: e.meterLastReading ?? undefined, meterSizeCode: e.meterSizeCode?.trim() || undefined,
        collectionRoute: e.collectionRoute?.trim() || undefined, usageStatus: e.usageStatus || undefined,
        walkOrder: e.walkOrder != null ? Number(e.walkOrder) : undefined,
        bankAccount: e.bankAccount?.trim() || undefined, bankName: e.bankName?.trim() || undefined,
        unitPrice: e.unitPrice === '' || e.unitPrice == null ? null : Number(e.unitPrice),
      };
      return e.id ? api.put(`/water/customers/${e.id}`, body) : api.post('/water/customers', body);
    },
    onSuccess: () => {
      toast.success(editing?.id ? 'บันทึกแล้ว' : 'เพิ่มผู้ใช้น้ำแล้ว');
      onSaved();
      qc.invalidateQueries({ queryKey: ['prapa-customers'] });
      qc.invalidateQueries({ queryKey: ['water-villages'] });
      qc.invalidateQueries({ queryKey: ['prapa-customer'] });
      qc.invalidateQueries({ queryKey: ['water-next-customer-code'] });
    },
    onError: (e) => toast.error(getErrorMessage(e, 'บันทึกไม่สำเร็จ')),
  });
}

export function useRemoveCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/water/customers/${id}`),
    onSuccess: (res) => {
      toast.success(res.data.data?.message || 'ลบแล้ว');
      qc.invalidateQueries({ queryKey: ['prapa-customers'] });
      qc.invalidateQueries({ queryKey: ['water-next-customer-code'] });
    },
    onError: (e) => toast.error(getErrorMessage(e, 'ลบไม่สำเร็จ')),
  });
}

export function useBulkRate(onDone: () => void) {
  return useMutation({
    mutationFn: (input: { unitPrice: number | null; scope: 'all' | 'village'; villageNo?: number }) =>
      api.put('/water/customers/bulk-rate', input),
    onSuccess: (res) => { toast.success(`ตั้งราคาแล้ว ${res.data.data?.updated ?? 0} ราย`); onDone(); },
    onError: (e) => toast.error(getErrorMessage(e, 'ตั้งราคาไม่สำเร็จ')),
  });
}

export function useCustomerDetail(id: string) {
  return useQuery({
    queryKey: ['prapa-customer', id],
    queryFn: async () => (await api.get(`/water/customers/${id}`)).data.data as Detail,
  });
}

/** ตัวเลือกจากข้อมูลพื้นฐาน (master) เช่น สถานะการใช้งาน/ขนาดมิเตอร์/เส้นทางเก็บเงิน */
export function useMasterOptions(type: string) {
  return useQuery({
    queryKey: ['water-master', type],
    queryFn: async () => (await api.get('/water/master', { params: { type } })).data.data as { code?: string; name: string }[],
  }).data || [];
}
