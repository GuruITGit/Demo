import { AxiosError, type AxiosAdapter, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios';
import { dispatch } from './core';
import './handlers';

/** axios adapter ที่ตอบจากข้อมูลจำลองในเบราว์เซอร์แทนการยิงไป backend */
export const demoAdapter: AxiosAdapter = async (config: InternalAxiosRequestConfig) => {
  let body: any = config.data;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { /* ส่งเป็นข้อความ */ } }
  const auth = (config.headers?.Authorization ?? (config.headers as any)?.get?.('Authorization')) as string | undefined;
  const token = auth ? String(auth).replace(/^Bearer\s+/i, '') : null;

  await new Promise((r) => setTimeout(r, 60 + Math.random() * 90)); // หน่วงนิดหน่อยให้รู้สึกเหมือนระบบจริง
  const out = await dispatch(config.method || 'get', config.url || '', config.params, body, token);

  const response: AxiosResponse = {
    data: out.body, status: out.status, statusText: String(out.status),
    headers: out.headers, config, request: {},
  };
  if (out.status >= 200 && out.status < 300) return response;
  throw new AxiosError(`Request failed with status code ${out.status}`, AxiosError.ERR_BAD_REQUEST, config, {}, response);
};
