import test from 'node:test';
import assert from 'node:assert/strict';
import {handleApi} from '../server/api.mjs';
import {openDatabase} from '../scripts/local-db.mjs';
import {epoch} from '../server/schedule.mjs';
test('appointment email lifecycle, failure retry, and safe recipient',async t=>{
 const DB=openDatabase();t.after(()=>DB.close());const original=globalThis.fetch;t.after(()=>globalThis.fetch=original);
 const sent=[];let fail=false;globalThis.fetch=async(url,options)=>{sent.push({url,key:options.headers['Idempotency-Key'],body:JSON.parse(options.body)});return Response.json(fail?{error:'test'}:{id:'email-id'},{status:fail?503:200});};
 const env={DB,RESEND_API_KEY:'fake-test-only',NOTIFICATION_EMAIL:'mlw903@gmail.com'},now=epoch('2026-09-14',6),id=crypto.randomUUID();
 const call=async(path,data)=>{const r=await handleApi(new Request(`https://test.invalid${path}`,{method:'POST',headers:{Origin:'https://test.invalid','Content-Type':'application/json','oai-authenticated-user-id':'tester'},body:JSON.stringify(data)}),env,now);assert.ok(r.ok);return r.json();};
 const input={id,zip:'78732',start:epoch('2026-09-15',8),name:'Email Test',email:'never-send@example.com',address:'Sample address',quantity:5,ready:true};
 await call('/api/bookings',input);await call('/api/bookings',input);assert.equal(sent.length,1);assert.deepEqual(sent[0].body.to,['mlw903@gmail.com']);
 fail=true;await call(`/api/bookings/${id}`,{action:'reschedule',version:1,start:epoch('2026-09-15',11)});
 assert.equal((await DB.prepare("SELECT COUNT(*) AS n FROM notifications WHERE status='email_failed'").first()).n,1);
 fail=false;await call(`/api/bookings/${id}`,{action:'retry_email'});assert.equal(sent[1].key,sent[2].key);
 await call(`/api/bookings/${id}`,{action:'cancel',version:2});assert.equal(sent.length,4);assert.match(sent[3].body.subject,/cancellation/);
 assert.equal((await DB.prepare("SELECT COUNT(*) AS n FROM notifications WHERE status='accepted_by_email_service'").first()).n,3);
});
