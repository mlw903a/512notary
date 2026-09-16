import {epoch,centralDate,HOUR} from './schedule.mjs';
const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status});};
export function operator(request){
 if(!request.headers.get('oai-authenticated-user-id'))fail('Sign in to open the admin calendar.',401);
 if(!['mlw903@gmail.com','mark@oceanbags.com'].includes((request.headers.get('oai-authenticated-user-email')||'').toLowerCase()))fail('This account is not authorized for the admin calendar.',403);
}
export async function blockedHours(db,provider,now){
 const rows=await db.sql('SELECT start, end FROM calendar_blocks WHERE provider = ? AND end > ? AND start < ?',provider,now-HOUR,now+30*86400000).all();
 return rows.results.flatMap(b=>Array.from({length:(b.end-b.start)/HOUR},(_,i)=>b.start+i*HOUR));
}
export async function calendar(db,date){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date||''))fail('Choose a valid date.');
 const start=epoch(date,0);if(centralDate(start)!==date)fail('Choose a valid date.');
 const last=new Date(date+'T12:00:00Z');last.setUTCDate(last.getUTCDate()+7);const end=epoch(last.toISOString().slice(0,10),0);
 const bookings=await db.sql('SELECT id, provider, zip, start, end, name, email, address, quantity, status, version FROM bookings WHERE start >= ? AND start < ? ORDER BY start',start,end).all();
 const blocks=await db.sql('SELECT * FROM calendar_blocks WHERE end > ? AND start < ? ORDER BY start',start,end).all();
 const pending=await db.sql("SELECT COUNT(*) AS count FROM bookings WHERE status = 'pending_confirmation'").first();
 return {bookings:bookings.results,blocks:blocks.results,pendingTotal:pending.count,date,timeZone:'America/Chicago'};
}
export async function changeBlock(db,data,now){
 if(data.action==='remove'){
   if(typeof data.id!=='string'||!/^[-a-f0-9]{36}$/.test(data.id))fail('Invalid block.');
   await db.sql('DELETE FROM calendar_blocks WHERE id = ?',data.id).run();return {removed:true};
 }
 const {provider,date}=data,startHour=Number(data.startHour),endHour=Number(data.endHour);
 if(!['mark','haydn'].includes(provider)||!/^\d{4}-\d{2}-\d{2}$/.test(date||'')||!Number.isInteger(startHour)||!Number.isInteger(endHour)||startHour<8||endHour>19||startHour>=endHour)fail('Choose a provider and a valid time range (8 a.m.–7 p.m.).');
 const start=epoch(date,startHour),end=epoch(date,endHour);
 if(centralDate(start)!==date||start<now-86400000||start>now+366*86400000)fail('Choose a date between today and one year from now.');
 if(typeof data.reason!=='string'||!data.reason.trim()||data.reason.length>160)fail('Enter a short private reason.');
 const id=crypto.randomUUID();
 try{await db.sql('INSERT INTO calendar_blocks (id, provider, start, end, reason, created_at) VALUES (?, ?, ?, ?, ?, ?)',id,provider,start,end,data.reason.trim(),now).run();}
 catch(error){if(/calendar conflict/i.test(error.message))fail('That block overlaps an appointment, its travel buffer, or another block. Nothing was changed.',409);throw error;}
 return {id,saved:true};
}
