import test from 'node:test';
import assert from 'node:assert/strict';
import {handleApi} from '../server/api.mjs';
import {openDatabase} from '../scripts/local-db.mjs';
import {epoch,HOUR} from '../server/schedule.mjs';
test('admin calendar authorization and manual blocks preserve reservations atomically',async t=>{
 const DB=openDatabase();t.after(()=>DB.close());const now=epoch('2026-09-16',6),start=epoch('2026-09-17',10);
 const call=async(path,data,role='operator',origin='https://test.invalid')=>{const r=await handleApi(new Request('https://test.invalid'+path,{method:data?'POST':'GET',headers:{Origin:origin,'Content-Type':'application/json',...(role==='anonymous'?{}:{'oai-authenticated-user-id':role,'oai-authenticated-user-email':role==='operator'?'mlw903@gmail.com':'other@example.com'})},...(data?{body:JSON.stringify(data)}:{})}),{DB},now);return {status:r.status,data:await r.json()};};
 const url='/api/operator/calendar?date=2026-09-16';
 assert.equal((await call(url,undefined,'anonymous')).status,401);assert.equal((await call(url,undefined,'other')).status,403);assert.equal((await call(url)).status,200);
 const block={provider:'haydn',date:'2026-09-17',startHour:10,endHour:12,reason:'Private commitment'};
 assert.equal((await call('/api/operator/blocks',block,'other')).status,403);assert.equal((await call('/api/operator/blocks',block,'operator','https://evil.invalid')).status,403);
 const saved=await call('/api/operator/blocks',block);assert.equal(saved.status,200);
 for(const zip of ['78653','78602']){const slots=(await call('/api/availability?zip='+zip,undefined,'anonymous')).data.slots;for(const h of [-1,0,1])assert.equal(slots.find(s=>s.start===start+h*HOUR).available,false);assert.equal(slots.find(s=>s.start===start+2*HOUR).available,true);}
 assert.equal((await call('/api/availability?zip=78732',undefined,'anonymous')).data.slots.find(s=>s.start===start).available,true);
 const input={id:crypto.randomUUID(),zip:'78653',start,name:'Admin test',email:'test@example.com',address:'Example',quantity:1,ready:true};
 assert.equal((await call('/api/bookings',input,'customer')).status,409);
 assert.equal((await DB.prepare('SELECT COUNT(*) n FROM bookings').first()).n,0);
 await call('/api/operator/blocks',{action:'remove',id:saved.data.id});
 const created=await call('/api/bookings',input,'customer');assert.equal(created.status,201);
 assert.equal((await call('/api/operator/blocks',{...block,startHour:11})).status,409);
 const view=await call(url);assert.equal(view.data.bookings.length,1);assert.equal(view.data.blocks.length,0);assert.equal(view.data.bookings[0].owner,undefined);
 const next=await call('/api/operator/blocks',{...block,startHour:13,endHour:14});assert.equal(next.status,200);
 assert.equal((await call('/api/bookings/'+input.id,{action:'reschedule',version:1,start:start+3*HOUR},'customer')).status,409);
 assert.equal((await call('/api/bookings/'+input.id,undefined,'customer')).data.booking.start,start);
});
