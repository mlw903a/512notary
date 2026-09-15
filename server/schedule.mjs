export const HOUR = 3600000;
export const ZONES = Object.freeze({
  '78732': { name: 'Northwest Austin', provider: 'mark' },
  '78653': { name: 'Manor', provider: 'haydn' },
  '78602': { name: 'Bastrop', provider: 'haydn' }
});
export const RULES = Object.freeze({timeZone:'America/Chicago',open:8,close:18,days:[1,2,3,4,5,6],durationMinutes:60,travelBufferMinutes:60,leadHours:2,horizonDays:28,totalCents:7500,maxNotarizations:5});
export function centralParts(time) {
  return Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:RULES.timeZone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(time)).map(p=>[p.type,p.value]));
}
export function centralDate(time) { const p=centralParts(time);return `${p.year}-${p.month}-${p.day}`; }
export function epoch(date,hour) {
  const [y,m,d]=date.split('-').map(Number);
  let estimate=Date.UTC(y,m-1,d,hour);
  for(let i=0;i<3;i++) {
    const p=centralParts(estimate);
    estimate+=Date.UTC(y,m-1,d,hour)-Date.UTC(+p.year,+p.month-1,+p.day,+p.hour,+p.minute);
  }
  return estimate;
}
export function scheduledSlots(now=Date.now()) {
  const today=centralDate(now).split('-').map(Number), slots=[];
  for(let offset=0;offset<RULES.horizonDays;offset++) {
    const day=new Date(Date.UTC(today[0],today[1]-1,today[2]+offset,12));
    if(!RULES.days.includes(day.getUTCDay()))continue;
    const date=day.toISOString().slice(0,10);
    for(let hour=RULES.open;hour<RULES.close;hour++) {
      const start=epoch(date,hour);
      if(start<now+RULES.leadHours*HOUR)continue;
      slots.push({date,hour,start,end:start+HOUR,label:new Intl.DateTimeFormat('en-US',{timeZone:RULES.timeZone,hour:'numeric',minute:'2-digit'}).format(new Date(start))});
    }
  }
  return slots;
}
export function validSlot(start,now=Date.now()) {return scheduledSlots(now).find(slot=>slot.start===start)??null;}
export function occupiedTimes(start) {return [start,start+HOUR];}
export function formatWhen(start) {return new Intl.DateTimeFormat('en-US',{timeZone:RULES.timeZone,weekday:'short',month:'short',day:'numeric',hour:'numeric',minute:'2-digit',timeZoneName:'short'}).format(new Date(start));}
