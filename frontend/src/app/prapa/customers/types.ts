export type Customer = {
  id: string;
  customerCode: string;
  fullName: string;
  villageNo: number | null;
  phone?: string;
  address?: string;
  nationalId?: string;
  meterSerial?: string;
  meterLastReading?: number | null;
  usageStatus?: string | null;
  collectionRoute?: string;
  outstanding?: number;
  unpaidCount?: number;
  soi?: string;
  road?: string;
  meterSizeCode?: string;
  meterDigits?: number | null;
  bankAccount?: string;
  bankName?: string;
  walkOrder?: number | null;
  unitPrice?: string | number | null;
};

export type Bill = {
  id: string;
  periodYear: number;
  periodMonth: number;
  periodRound?: string;
  prevReading: number;
  currReading: number;
  units: number;
  totalAmount: string;
  status: string;
  paidAt?: string | null;
  editHistory?: {
    by?: string;
    at: string;
    prevReading: number;
    currReading: number;
  }[] | null;
};

export type Detail = Customer & {
  soi?: string;
  road?: string;
  note?: string;
  meterSizeCode?: string;
  meterDigits?: number | null;
  feeRate?: string;
  garbageFee?: string;
  wastewaterFee?: string;
  payMethod?: string;
  applyDate?: string | null;
  gps?: string;
  outstanding?: number;
  unpaidCount?: number;
  bills?: Bill[];
};