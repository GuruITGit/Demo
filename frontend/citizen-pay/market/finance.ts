type ChargePeriod = 'daily' | 'monthly';

function dateParts(isoDate:string){
  const match=/^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if(!match)throw new RangeError('วันที่ต้องอยู่ในรูปแบบ YYYY-MM-DD');
  const year=Number(match[1]),month=Number(match[2]),day=Number(match[3]);
  const daysInMonth=daysInCalendarMonth(year,month);
  if(month<1||month>12||day<1||day>daysInMonth)throw new RangeError('วันที่ไม่ถูกต้อง');
  return {year,month,day,daysInMonth};
}

function daysInCalendarMonth(year:number,month:number){const lastDay=new Date(0);lastDay.setUTCFullYear(year,month,0);return lastDay.getUTCDate()}
function calendarDaysInMonth(isoDate:string){return dateParts(isoDate).daysInMonth}
function dailyWasteRate(monthlyWasteRate:number,isoDate:string){return monthlyWasteRate/calendarDaysInMonth(isoDate)}

function calculateFirstCharge(rentRate:number,monthlyWasteRate:number,period:ChargePeriod,startDate:string,durationDays=1){
  if(!Number.isFinite(rentRate)||rentRate<0||!Number.isFinite(monthlyWasteRate)||monthlyWasteRate<0)throw new RangeError('อัตราค่าบริการต้องเป็นตัวเลขตั้งแต่ 0 ขึ้นไป');
  if(period!=='daily'&&period!=='monthly')throw new RangeError('รอบเก็บเงินไม่ถูกต้อง');
  const start=dateParts(startDate);
  if(!Number.isInteger(durationDays)||durationDays<1||durationDays>365)throw new RangeError('จำนวนวันเช่าต้องอยู่ระหว่าง 1–365 วัน');
  if(period==='monthly')return Math.round((rentRate+monthlyWasteRate)*(start.daysInMonth-start.day+1)/start.daysInMonth);

  let remainingDays=durationDays,year=start.year,month=start.month,day=start.day,wasteTotal=0;
  while(remainingDays>0){
    const daysInMonth=daysInCalendarMonth(year,month);
    const chargedDays=Math.min(remainingDays,daysInMonth-day+1);
    wasteTotal+=monthlyWasteRate*chargedDays/daysInMonth;
    remainingDays-=chargedDays;
    day=1;
    if(month===12){year++;month=1}else month++;
  }
  return Math.round(rentRate*durationDays+wasteTotal);
}
