import * as dayjs from 'dayjs';
import 'dayjs/locale/th';
import * as buddhistEra from 'dayjs/plugin/buddhistEra';
import * as timezone from 'dayjs/plugin/timezone';
import * as utc from 'dayjs/plugin/utc';

dayjs.extend(buddhistEra);
dayjs.extend(timezone);
dayjs.extend(utc);
dayjs.locale('th');

export const THAI_TZ = 'Asia/Bangkok';

export function toThaiDate(date: Date | string): string {
  return dayjs(date).tz(THAI_TZ).locale('th').format('DD MMMM BBBB');
}

export function toThaiDateTime(date: Date | string): string {
  return dayjs(date).tz(THAI_TZ).locale('th').format('DD MMMM BBBB HH:mm น.');
}

export function getCurrentThaiYear(): number {
  return dayjs().tz(THAI_TZ).year() + 543;
}

export function formatDocNumber(prefix: string, year: number, seq: number, padLength = 4): string {
  return `${prefix}${year}/${String(seq).padStart(padLength, '0')}`;
}

export function addWorkDays(date: Date, days: number): Date {
  const d = dayjs(date).tz(THAI_TZ);
  let added = 0;
  let current = d;
  while (added < days) {
    current = current.add(1, 'day');
    const dow = current.day();
    if (dow !== 0 && dow !== 6) added++;
  }
  return current.toDate();
}

export function diffWorkDays(start: Date, end: Date): number {
  let count = 0;
  let current = dayjs(start).tz(THAI_TZ);
  const endDay = dayjs(end).tz(THAI_TZ);
  while (current.isBefore(endDay) || current.isSame(endDay, 'day')) {
    const dow = current.day();
    if (dow !== 0 && dow !== 6) count++;
    current = current.add(1, 'day');
  }
  return count;
}
