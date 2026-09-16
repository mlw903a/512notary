import {database} from './database.mjs';
import {deliverNotifications} from './email.mjs';
import {guestToken,guestOwner,managementUrl,throttle} from './guest.mjs';
import {operator,calendar,changeBlock,blockedHours} from './admin.mjs';
import {ZONES,RULES,HOUR,scheduledSlots,validSlot,occupiedTimes,formatWhen} from './schedule.mjs';

const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status});};
const json=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
const requireOwner=request=>request.headers.get('oai-authenticated-user-id')||fail('Sign in with ChatGPT to save or manage a test request.',401);
const requireOperator=request=>{requireOwner(request);if(!['mark@oceanbags.com','mlw903@gmail.com'].includes((request.headers.get('oai-authenticated-user-email')||'').toLowerCase()))fail('Only the pilot operator can make appointment decisions.',403);};
function text(value,label,max=200){if(typeof value!=='string'||!value.trim()||value.length>max)fail(`Enter a valid ${label}.`);return value.trim();}
function email(value){const v=text(value,'email',160);if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v))fail('Enter a valid email.');return v;}
function id(value){if(typeof value!=='string'||!/^[a-zA-Z0-9-]{8,80}$/.test(value))fail('Invalid request identifier.');return value;}
function source(value={}){const result={};for(const key of ['utm_source','utm_medium','utm_campaign','utm_term','utm_content'])if(typeof value?.[key]==='string')result[key]=value[key].slice(0,160);return JSON.stringify(result);}
async function body(request){
  if(!request.headers.get('content-type')?.startsWith('application/json'))fail('Use JSON for this request.',415);
  if(request.headers.get('origin')!==new URL(request.url).origin)fail('Request origin does not match this site.',403);
  const raw=await request.text();if(raw.length>16000)fail('Request is too large.',413);
  let value;try{value=JSON.parse(raw);}catch{fail('Invalid request data.');}
  if(!value||typeof value!=='object'||Array.isArray(value))fail('Invalid request data.');return value;
}
async function fingerprint(value){const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(value)));return Array.from(new Uint8Array(bytes),x=>x.toString(16).padStart(2,'0')).join('');}
function publicBooking(b){const {owner,fingerprint,...safe}=b;return {...safe,source:JSON.parse(b.source),mode:'test',chargedCents:0,paymentStatus:'not_requested',messagesSent:false};}
const owned=(db,bookingId,owner)=>db.sql('SELECT * FROM bookings WHERE id = ? AND owner = ?',bookingId,owner).first();
async function noteStatements(db,b,kind,now){
  const ref=`512-${b.id.slice(0,8).toUpperCase()}`;
  const label=b.status==='declined'?'Request declined':kind==='confirmation'?'Appointment confirmed for testing':kind==='cancellation'?'Cancelled test request':b.status==='pending_confirmation'?'Appointment request awaiting confirmation':'Test appointment';
  const message=`${label} ${ref}\n${ZONES[b.zip].name} · ${formatWhen(b.start)}\n${b.address}\nTravel + up to 5 notarizations for one signer: $75.00\nThis is a private test. No real service is scheduled. No payment is collected.\nReview and decide (operator sign-in required): https://512notary.com/?booking=${encodeURIComponent(b.id)}&operator=1`;
  const insert=(type,due,subject)=>db.sql('INSERT INTO notifications (id, booking_id, owner, kind, recipient, subject, body, due_at, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',crypto.randomUUID(),b.id,b.owner,type,db.notificationRecipient||b.email,subject,`${message}\nName: ${b.name}\nContact email: ${b.email}\nRequested notarizations: ${b.quantity}`,due,db.notificationRecipient&&type!=='reminder'?'queued':'preview');
  const result=[insert(kind,now,`${ref} — ${kind}`)];
  if(db.customerEmail&&b.owner.startsWith('guest:')){
    const link=await managementUrl(db.env,b);
    const customerBody=`${label} ${ref}\n${ZONES[b.zip].name} · ${formatWhen(b.start)}\n${b.address}\nTravel + up to 5 notarizations for one signer: $75.00\n${b.status==='pending_confirmation'?'Your request is awaiting confirmation. It is not a confirmed appointment.':''}\nFAMILY AND FRIENDS TEST: No real service is scheduled. No payment is collected.\nView, cancel, or reschedule using your private link (do not share):\n${link}\nQuestions? Reply to this email.`;
    result.push(db.sql('INSERT INTO notifications (id, booking_id, owner, kind, recipient, subject, body, due_at, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',crypto.randomUUID(),b.id,b.owner,`customer_${kind}`,b.email,`${ref} — ${label}`,customerBody,now,'queued'));
  }
  if(!['cancellation','confirmation','decline'].includes(kind)&&b.status==='test_confirmed')result.push(insert('reminder',Math.max(now,b.start-2*HOUR),`${ref} — appointment reminder`));
  return result;
}
async function readBooking(db,bookingId,owner){const b=await owned(db,bookingId,owner);if(!b)fail('Appointment not found.',404);return b;}
async function createBooking(db,owner,data,now){
  const bookingId=id(data.id),zone=ZONES[data.zip];
  if(!zone)fail('This address needs a coverage review before booking.');
  const details={name:text(data.name,'name',100),email:email(data.email),address:text(data.address,'meeting address'),quantity:Number(data.quantity)};
  if(!Number.isInteger(details.quantity)||details.quantity<1||details.quantity>5)fail('Choose between one and five notarizations.');
  if(data.ready!==true)fail('Confirm that your documents, identification, and witnesses are ready.');
  const digest=await fingerprint({zip:data.zip,start:data.start,...details});
  const previous=await owned(db,bookingId,owner);
  if(previous){if(previous.fingerprint!==digest)fail('That checkout request was already used for different details.',409);return {booking:publicBooking(previous),duplicate:true};}
  const slot=validSlot(data.start,now);if(!slot)fail('That time is outside the available schedule. Choose another time.',409);
  const b={id:bookingId,owner,provider:zone.provider,zip:data.zip,start:slot.start,end:slot.end,status:'pending_confirmation',...details};
  const statements=[db.sql('INSERT INTO bookings (id, owner, provider, zip, start, end, name, email, address, quantity, total, status, version, fingerprint, source, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',b.id,owner,b.provider,b.zip,b.start,b.end,b.name,b.email,b.address,b.quantity,7500,'pending_confirmation',1,digest,source(data.source),now),
    ...occupiedTimes(b.start).map(t=>db.sql('INSERT INTO slot_locks (provider, slot, booking_id) VALUES (?, ?, ?)',b.provider,t,b.id)),
    ...await noteStatements(db,b,'request_received',now)];
  try{await db.batch(statements);}catch(error){
    const repeated=await owned(db,bookingId,owner);
    if(repeated?.fingerprint===digest)return {booking:publicBooking(repeated),duplicate:true};
    if(/UNIQUE|constraint|calendar conflict/i.test(error.message))fail('That appointment was just reserved or blocked. Please choose another time.',409);
    throw error;
  }
  return {booking:publicBooking(await owned(db,b.id,owner)),duplicate:false};
}
async function changeBooking(db,owner,bookingId,data,now){
  const b=await readBooking(db,bookingId,owner);
  if(data.action==='cancel'&&b.status==='cancelled')return {booking:publicBooking(b)};
  if(!['test_confirmed','pending_confirmation'].includes(b.status))fail('Only active test appointments can be changed.',409);
  if(data.version!==b.version)fail('This appointment changed. Reload it before trying again.',409);
  let sql,updated;
  if(data.action==='reschedule'){
    const slot=validSlot(data.start,now);if(!slot)fail('Choose a time within the available schedule.',409);
    updated={...b,start:slot.start,end:slot.end,status:'pending_confirmation'};
    sql=db.sql("UPDATE bookings SET start = ?, end = ?, status = 'pending_confirmation', version = CASE WHEN version = ? AND status IN ('test_confirmed', 'pending_confirmation') THEN version + 1 ELSE NULL END WHERE id = ? AND owner = ?",slot.start,slot.end,b.version,b.id,owner);
  }else if(data.action==='cancel'){
    updated={...b,status:'cancelled'};
    sql=db.sql("UPDATE bookings SET status = 'cancelled', version = CASE WHEN version = ? AND status IN ('test_confirmed', 'pending_confirmation') THEN version + 1 ELSE NULL END WHERE id = ? AND owner = ?",b.version,b.id,owner);
  }else fail('Unknown appointment action.');
  const statements=[sql,db.sql('DELETE FROM slot_locks WHERE booking_id = ?',b.id),
    ...(data.action==='reschedule'?occupiedTimes(updated.start).map(t=>db.sql('INSERT INTO slot_locks (provider, slot, booking_id) VALUES (?, ?, ?)',b.provider,t,b.id)):[]),
    db.sql("UPDATE notifications SET status = 'superseded' WHERE booking_id = ? AND kind = 'reminder' AND status = 'preview'",b.id),
    ...await noteStatements(db,updated,data.action==='cancel'?'cancellation':'reschedule',now)];
  try{await db.batch(statements);}catch(error){if(/constraint|UNIQUE|calendar conflict/i.test(error.message))fail('The appointment changed or that time was taken. Your previous reservation is preserved; reload to see its latest status.',409);throw error;}
  return {booking:publicBooking(await owned(db,b.id,owner))};
}

async function routeApi(request,env,now=Date.now()){
  const url=new URL(request.url),path=url.pathname;
  try{
    if(request.method==='GET'&&path==='/api/config')return json({mode:'test',rules:RULES,zones:ZONES,payments:'not_requested',email:env.RESEND_API_KEY&&env.NOTIFICATION_EMAIL==='mlw903@gmail.com'?(env.CUSTOMER_EMAIL_ENABLED==='true'?'customer_and_operator_test_email':'operator_test_email'):'preview_only'});
    const db=database(env);
    if(path==='/api/operator/calendar'||path==='/api/operator/blocks'){
      operator(request);
      if(request.method==='GET'&&path.endsWith('/calendar'))return json(await calendar(db,url.searchParams.get('date')));
      if(request.method==='POST'&&path.endsWith('/blocks'))return json(await changeBlock(db,await body(request),now));
      fail('Method not allowed.',405);
    }
    if(request.method==='POST'&&path==='/api/guest-access'){
      await body(request);await throttle(db,request,'guest',20,now);
      const bookingId=crypto.randomUUID();return json({id:bookingId,token:await guestToken(env,bookingId,now+60*86400000)});
    }
    if(request.method==='GET'&&path==='/api/availability'&&!url.searchParams.has('exclude')){
      const zip=url.searchParams.get('zip'),zone=ZONES[zip];if(!zone)fail('Coverage review required.');
      const locks=await db.sql('SELECT slot FROM slot_locks WHERE provider = ? AND slot >= ?',zone.provider,now-HOUR).all();
      const occupied=new Set([...locks.results.map(x=>x.slot),...await blockedHours(db,zone.provider,now)]);
      return json({zone,zip,rules:RULES,slots:scheduledSlots(now).map(slot=>({...slot,available:occupiedTimes(slot.start).every(t=>!occupied.has(t))}))});
    }
    const guest=await guestOwner(request,env,now);
    const owner=guest||requireOwner(request);
    if(guest&&request.method==='POST')await throttle(db,request,'writes',60,now);
    const operatorMatch=path.match(/^\/api\/operator\/bookings\/([a-zA-Z0-9-]{8,80})$/);
    if(operatorMatch){
      requireOperator(request);
      let b=await db.sql('SELECT * FROM bookings WHERE id = ?',operatorMatch[1]).first();if(!b)fail('Appointment not found.',404);
      if(request.method==='POST'){
        const data=await body(request);
        if(!['confirm','decline','retry_email'].includes(data.action))fail('Unknown operator action.');
        if(data.action!=='retry_email'){
          const target=data.action==='confirm'?'test_confirmed':'declined';
          if(b.status!==target){
            if(b.status!=='pending_confirmation'||b.version!==data.version)fail('This request changed. Reload before deciding.',409);
            if(data.action==='confirm'&&b.start<=now)fail('This appointment time has passed. Choose a new time before confirming.',409);
            const updated={...b,status:target};
            const statements=[db.sql("UPDATE bookings SET status = ?, version = CASE WHEN version = ? AND status = 'pending_confirmation' THEN version + 1 ELSE NULL END WHERE id = ?",target,b.version,b.id),
              ...(target==='declined'?[db.sql('DELETE FROM slot_locks WHERE booking_id = ?',b.id)]:[]),
              ...await noteStatements(db,updated,target==='declined'?'decline':'confirmation',now)];
            try{await db.batch(statements);}catch(error){if(/constraint/i.test(error.message))fail('This request changed. Reload before deciding.',409);throw error;}
          }
        }
        try{await deliverNotifications(db,env,b.id,b.owner,now);}catch{console.error('Decision saved; email status unavailable.');}
        b=await db.sql('SELECT * FROM bookings WHERE id = ?',b.id).first();
      }else if(request.method!=='GET')fail('Method not allowed.',405);
      const notes=await db.sql('SELECT kind, recipient, subject, body, due_at, status FROM notifications WHERE booking_id = ? ORDER BY due_at',b.id).all();
      return json({booking:publicBooking(b),notifications:notes.results,operator:true});
    }
    if(request.method==='GET'&&path==='/api/availability'){
      const zip=url.searchParams.get('zip'),zone=ZONES[zip];if(!zone)fail('Coverage review required.');
      const exclude=url.searchParams.get('exclude');if(exclude)await readBooking(db,exclude,owner);
      const locks=await db.sql('SELECT slot FROM slot_locks WHERE provider = ? AND slot >= ? AND booking_id != ?',zone.provider,now-HOUR,exclude??'').all();
      const occupied=new Set([...locks.results.map(x=>x.slot),...await blockedHours(db,zone.provider,now)]);
      return json({zone,zip,rules:RULES,slots:scheduledSlots(now).map(slot=>({...slot,available:occupiedTimes(slot.start).every(t=>!occupied.has(t))}))});
    }
    if(request.method==='GET'&&path==='/api/bookings'){
      const b=await db.sql('SELECT * FROM bookings WHERE owner = ? ORDER BY created_at DESC LIMIT 100',owner).all();
      const inquiries=await db.sql('SELECT * FROM inquiries WHERE owner = ? ORDER BY created_at DESC LIMIT 50',owner).all();
      const counts=await db.sql('SELECT name, COUNT(*) AS count FROM events WHERE owner = ? GROUP BY name',owner).all();
      return json({bookings:b.results.map(publicBooking),inquiries:inquiries.results,events:counts.results,mode:'test'});
    }
    const bookingMatch=path.match(/^\/api\/bookings\/([a-zA-Z0-9-]{8,80})$/);
    if(request.method==='GET'&&bookingMatch){
      const b=await readBooking(db,bookingMatch[1],owner);
      const notes=await db.sql('SELECT kind, recipient, subject, body, due_at, status FROM notifications WHERE booking_id = ? AND owner = ? ORDER BY due_at',b.id,owner).all();
      return json({booking:publicBooking(b),notifications:guest?notes.results.filter(n=>n.kind.startsWith('customer_')):notes.results});
    }
    if(request.method==='POST'){
      const data=await body(request);
      if(path==='/api/bookings'){
        if(guest&&data.id!==guest.slice(6))fail('Invalid request identifier.',403);
        if(guest&&!await owned(db,data.id,owner)){
          await throttle(db,request,'bookings',5,now);
          const recent=await db.sql('SELECT COUNT(*) AS n FROM bookings WHERE email = ? AND created_at > ?',email(data.email),now-86400000).first();
          if(recent.n>=3)fail('This email has reached the daily test request limit.',429);
        }
        return json(await createBooking(db,owner,data,now),201);
      }
      if(bookingMatch){if(data.action==='retry_email')return json({booking:publicBooking(await readBooking(db,bookingMatch[1],owner))});return json(await changeBooking(db,owner,bookingMatch[1],data,now));}
      if(path==='/api/inquiries'){
        const requestId=id(data.id),kind=['coverage','time'].includes(data.kind)?data.kind:fail('Invalid request type.');
        const zip=text(data.zip,'ZIP code',5);if(!/^\d{5}$/.test(zip))fail('Invalid ZIP code.');
        const detail=text(data.detail,'request detail',500),recipient=email(data.email);
        await db.sql('INSERT INTO inquiries (id, owner, kind, zip, detail, email, created_at) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO NOTHING',requestId,owner,kind,zip,detail,recipient,now).run();
        return json({id:requestId,saved:true,mode:'test',messagesSent:false},201);
      }
      if(path==='/api/events'){
        const allowed=['landing_view','coverage_checked','slot_selected','details_completed','checkout_viewed','booking_saved'];
        if(!allowed.includes(data.name))fail('Invalid event.');
        await db.sql('INSERT INTO events (id, owner, name, zip, source, created_at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO NOTHING',id(data.id),owner,data.name,/^\d{5}$/.test(data.zip??'')?data.zip:null,source(data.source),now).run();
        return json({saved:true});
      }
    }
    return json({error:'Not found.'},404);
  }catch(error){
    if(!error.status)console.error('Booking API unavailable:',error.name);
    return json({error:error.status?error.message:'Booking storage is unavailable. Your details have not been cleared; please try again.'},error.status??503);
  }
}

export async function handleApi(request,env,now=Date.now()){
  const response=await routeApi(request,env,now);
  if(request.method==='POST'&&response.ok&&/^\/api\/bookings(?:\/[^/]+)?$/.test(new URL(request.url).pathname)){
    const result=await response.clone().json();
    if(result.booking)try{await deliverNotifications(database(env),env,result.booking.id,await guestOwner(request,env,now)||requireOwner(request),now);}catch{console.error('Email delivery status unavailable; booking preserved.');}
  }
  return response;
}
