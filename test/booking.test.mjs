import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {handleApi} from '../server/api.mjs';
import {openDatabase} from '../scripts/local-db.mjs';
import {epoch,HOUR,scheduledSlots,validSlot,centralParts} from '../server/schedule.mjs';
const now=epoch('2026-09-14',6),start=epoch('2026-09-15',8);
const input=(zip='78732',time=start)=>({id:crypto.randomUUID(),zip,start:time,name:'Test Customer',email:'alex@example.com',address:'123 Example Lane',quantity:5,ready:true,total:1,source:{utm_source:'test'}});
test('public review exposes availability but not saved records or operator actions',async t=>{
 const DB=openDatabase();t.after(()=>DB.close());
 const availability=await call(DB,'/api/availability?zip=78732',undefined,null);assert.equal(availability.status,200);assert.ok(availability.data.slots.length);assert.equal(availability.data.bookings,undefined);
 assert.equal((await call(DB,'/api/bookings',undefined,null)).status,401);
 assert.equal((await call(DB,'/api/bookings',input(),null)).status,401);
 assert.equal((await call(DB,'/api/availability?zip=78732&exclude=not-owned',undefined,null)).status,401);
 assert.equal((await call(DB,'/api/operator/bookings/not-owned',{action:'confirm',version:1},null)).status,401);
});
async function call(DB,path='/api/bookings',data,owner='tester',extra={}){const request=new Request(`https://test.invalid${path}`,{method:data?'POST':'GET',headers:{...(owner?{'oai-authenticated-user-id':owner}:{}),...(data?{'Content-Type':'application/json',Origin:'https://test.invalid'}:{}),...extra},...(data?{body:JSON.stringify(data)}:{})});const response=await handleApi(request,{DB},now);return {status:response.status,data:await response.json()};}
test('schedule is Mon–Sat, 8–18 Central; last start 17; two-hour lead',()=>{
  const slots=scheduledSlots(now);assert.ok(slots.length>200);
  for(const slot of slots){assert.notEqual(new Date(`${slot.date}T12:00:00Z`).getUTCDay(),0);assert.ok(slot.hour>=8&&slot.hour<=17);assert.equal(slot.end-slot.start,HOUR);assert.ok(slot.start>=now+2*HOUR);}
  assert.equal(validSlot(epoch('2026-09-15',18),now),null);assert.equal(validSlot(epoch('2026-09-20',8),now),null);
  assert.equal(validSlot(epoch('2026-09-14',8),epoch('2026-09-14',7)),null);
  assert.equal(centralParts(validSlot(epoch('2026-09-15',17),now).end).hour,'18');
});
test('Central Time handles both daylight-saving transitions',()=>{
  assert.equal(new Date(epoch('2026-03-07',8)).toISOString(),'2026-03-07T14:00:00.000Z');
  assert.equal(new Date(epoch('2026-03-09',8)).toISOString(),'2026-03-09T13:00:00.000Z');
  assert.equal(new Date(epoch('2026-10-31',8)).toISOString(),'2026-10-31T13:00:00.000Z');
  assert.equal(new Date(epoch('2026-11-02',8)).toISOString(),'2026-11-02T14:00:00.000Z');
});
test('booking persists with server price, five included, no actual charge or messages',async t=>{
  const DB=openDatabase();t.after(()=>DB.close());const r=await call(DB,undefined,input());assert.equal(r.status,201);assert.equal(r.data.booking.total,7500);assert.equal(r.data.booking.quantity,5);assert.equal(r.data.booking.status,'pending_confirmation');assert.equal(r.data.booking.paymentStatus,'not_requested');assert.equal(r.data.booking.chargedCents,0);assert.equal(r.data.booking.messagesSent,false);assert.equal(r.data.booking.owner,undefined);
  const read=await call(DB,`/api/bookings/${r.data.booking.id}`);assert.equal(read.data.notifications.length,1);assert.ok(read.data.notifications.every(n=>n.status==='preview'));
});
test('concurrent duplicate checkout is idempotent and mismatched reuse fails',async t=>{
  const DB=openDatabase();t.after(()=>DB.close());const data=input();const results=await Promise.all([call(DB,undefined,data),call(DB,undefined,data)]);assert.ok(results.every(r=>r.status===201));assert.ok(results.some(r=>r.data.duplicate));assert.equal((await call(DB)).data.bookings.length,1);
  assert.equal((await call(DB,undefined,{...data,quantity:2})).status,409);
});
test('concurrent contenders: one slot, one booking, no orphan confirmation',async t=>{
  const DB=openDatabase();t.after(()=>DB.close());const results=await Promise.all([call(DB,undefined,input()),call(DB,undefined,input(),'other')]);assert.deepEqual(results.map(r=>r.status).sort(),[201,409]);assert.equal((await DB.prepare('SELECT COUNT(*) AS n FROM bookings').first()).n,1);assert.equal((await DB.prepare('SELECT COUNT(*) AS n FROM notifications').first()).n,1);
});
test('Manor and Bastrop share Haydn plus travel gap; Mark can book simultaneously',async t=>{
  const DB=openDatabase();t.after(()=>DB.close());assert.equal((await call(DB,undefined,input('78653'))).status,201);
  assert.equal((await call(DB,undefined,input('78602'))).status,409);assert.equal((await call(DB,undefined,input('78602',start+HOUR))).status,409);
  assert.equal((await call(DB,undefined,input('78732'))).status,201);assert.equal((await call(DB,undefined,input('78602',start+2*HOUR))).status,201);
  const availability=await call(DB,'/api/availability?zip=78602');assert.equal(availability.data.slots.find(s=>s.start===start).available,false);
});
test('failed reschedule rolls back; success changes locks; stale version rejected',async t=>{
  const DB=openDatabase();t.after(()=>DB.close());const a=(await call(DB,undefined,input())).data.booking;await call(DB,undefined,input('78732',start+3*HOUR));
  assert.equal((await call(DB,`/api/bookings/${a.id}`,{action:'reschedule',version:1,start:start+3*HOUR})).status,409);
  const old=await call(DB,`/api/bookings/${a.id}`);assert.equal(old.data.booking.start,start);assert.equal(old.data.notifications.length,1);
  const changed=await call(DB,`/api/bookings/${a.id}`,{action:'reschedule',version:1,start:start+6*HOUR});assert.equal(changed.status,200);assert.equal(changed.data.booking.version,2);
  assert.equal((await call(DB,`/api/bookings/${a.id}`,{action:'cancel',version:1})).status,409);assert.equal((await call(DB,undefined,input())).status,201);
});
test('concurrent modifications preserve a single valid reservation and outbox',async t=>{
  const DB=openDatabase();t.after(()=>DB.close());const b=(await call(DB,undefined,input())).data.booking;
  const results=await Promise.all([call(DB,`/api/bookings/${b.id}`,{action:'reschedule',version:1,start:start+3*HOUR}),call(DB,`/api/bookings/${b.id}`,{action:'reschedule',version:1,start:start+6*HOUR})]);assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);const current=(await call(DB,`/api/bookings/${b.id}`)).data;assert.equal(current.booking.version,2);assert.equal(current.notifications.length,2);assert.equal((await DB.prepare('SELECT COUNT(*) AS n FROM slot_locks').first()).n,2);
});
test('cancellation frees slots; pending requests have no reminders; retry is safe',async t=>{
  const DB=openDatabase();t.after(()=>DB.close());const b=(await call(DB,undefined,input())).data.booking;const cancel={action:'cancel',version:1};assert.equal((await call(DB,`/api/bookings/${b.id}`,cancel)).status,200);assert.equal((await call(DB,`/api/bookings/${b.id}`,cancel)).status,200);
  const r=await call(DB,`/api/bookings/${b.id}`);assert.equal(r.data.notifications.length,2);assert.equal(r.data.notifications.some(n=>n.kind==='reminder'),false);assert.equal((await call(DB,undefined,input())).status,201);
});
test('identity, ownership, same-origin, coverage, quantity and readiness are enforced',async t=>{
  const DB=openDatabase();t.after(()=>DB.close());assert.equal((await call(DB,'/api/bookings',undefined,null)).status,401);
  assert.equal((await call(DB,undefined,input(),'tester',{Origin:'https://evil.invalid'})).status,403);
  const b=(await call(DB,undefined,input())).data.booking;assert.equal((await call(DB,`/api/bookings/${b.id}`,undefined,'other')).status,404);
  assert.equal((await call(DB,`/api/availability?zip=78732&exclude=${b.id}`,undefined,'other')).status,404);
  for(const overrides of [{quantity:0},{quantity:6},{ready:false},{zip:'78733'}])assert.equal((await call(DB,undefined,{...input(),...overrides})).status,400);
});
test('inquiries and campaign events save without delivery; event id deduplicates',async t=>{
  const DB=openDatabase();t.after(()=>DB.close());assert.equal((await call(DB,'/api/inquiries',{id:crypto.randomUUID(),kind:'coverage',zip:'78733',detail:'Example nearby address',email:'alex@example.com'})).status,201);
  const event={id:crypto.randomUUID(),name:'landing_view',source:{utm_source:'test'}};await call(DB,'/api/events',event);await call(DB,'/api/events',event);const r=await call(DB);assert.equal(r.data.inquiries.length,1);assert.equal(r.data.events[0].count,1);
});
test('saved bookings survive database close/reopen and migration replay',async()=>{
  const folder=await mkdtemp(join(tmpdir(),'512notary-test-'));let DB;
  try{DB=openDatabase(join(folder,'test.sqlite'));const b=(await call(DB,undefined,input())).data.booking;DB.close();DB=openDatabase(join(folder,'test.sqlite'));assert.equal((await call(DB,`/api/bookings/${b.id}`)).data.booking.id,b.id);}finally{DB?.close();await rm(folder,{recursive:true,force:true});}
});
