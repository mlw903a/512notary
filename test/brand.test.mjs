import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {activeZones,brandAsset} from '../server/brand.mjs';
import {handleApi} from '../server/api.mjs';
import {openDatabase} from '../scripts/local-db.mjs';
import {epoch,HOUR} from '../server/schedule.mjs';

test('Haas branding is reversible and preserves the original assets',()=>{
 const html=readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
 assert.equal(brandAsset(html,{}),html);
 const haas=brandAsset(html,{PILOT_BRAND:'haas'});
 assert.match(haas,/haasnotary.com home/);assert.match(haas,/>haas<\/span>/);
 assert.match(haas,/data-zip="78621"/);assert.doesNotMatch(haas,/78732|Northwest Austin|512notary/);
 assert.deepEqual(Object.keys(activeZones({PILOT_BRAND:'haas'})),['78602','78621','78653']);
 assert.deepEqual(Object.keys(activeZones({PILOT_BRAND:'512'})),['78602','78653','78732']);
});

test('Haas shares Haydn capacity and legacy appointments survive a switch back',async t=>{
 const DB=openDatabase();t.after(()=>DB.close());
 const now=epoch('2026-09-16',6),start=epoch('2026-09-17',10);
 const call=async(path,data,brand='haas')=>{
  const r=await handleApi(new Request('https://test.invalid'+path,{method:data?'POST':'GET',headers:{Origin:'https://test.invalid','Content-Type':'application/json','oai-authenticated-user-id':'brand-test'},...(data?{body:JSON.stringify(data)}:{})}),{DB,PILOT_BRAND:brand},now);
  return {status:r.status,data:await r.json()};
 };
 const details={id:crypto.randomUUID(),zip:'78621',start,name:'Haas example',email:'haas@example.com',address:'123 Example Lane\nElgin, TX 78621',quantity:1,ready:true};
 assert.equal((await call('/api/bookings',{...details,zip:'78732'})).status,400);
 const saved=await call('/api/bookings',details);assert.equal(saved.status,201);assert.equal(saved.data.booking.provider,'haydn');
 for(const zip of ['78602','78621','78653'])assert.equal((await call('/api/availability?zip='+zip)).data.slots.find(s=>s.start===start).available,false);
 assert.equal((await call('/api/bookings/'+details.id,undefined,'512')).status,200);
 assert.equal((await call('/api/availability?zip=78621&exclude='+details.id,undefined,'512')).status,200);
 assert.equal((await call('/api/bookings/'+details.id,{action:'reschedule',version:1,start:start+3*HOUR},'512')).status,200);
 assert.equal((await call('/api/bookings/'+details.id,{action:'cancel',version:2},'512')).status,200);
 assert.equal((await call('/api/availability?zip=78602')).data.slots.find(s=>s.start===start).available,true);
 const config=(await call('/api/config')).data;
 assert.equal(config.zones['78732'].provider,'mark');assert.equal(config.activeZones['78732'],undefined);
});
