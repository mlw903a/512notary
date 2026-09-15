'use strict';

// Entirely in-browser. No payment, messaging, analytics, or data APIs.
const ZONES = Object.freeze({
  '78732': { name: 'Northwest Austin', provider: 'mark' },
  '78653': { name: 'Manor', provider: 'haydn' },
  '78602': { name: 'Bastrop', provider: 'haydn' }
});
const SAMPLE_TIMES = ['9:00 AM', '11:00 AM', '2:00 PM', '4:00 PM'];
const state = {step:1,zip:'',zone:null,date:'',time:'',booking:null,editing:false,events:[],details:{name:'Alex Taylor',email:'alex@example.com',address:'123 Example Lane',ready:false}};
const content = document.querySelector('#booking-content');
const escapeText = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const record = name => state.events.push({name,zone:state.zone?.name??null,at:new Date().toISOString()});
function sampleDates() {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:'America/Chicago',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date()).map(part=>[part.type,part.value]));
  return [1,2,3].map(offset=>{
    const date=new Date(Date.UTC(Number(parts.year),Number(parts.month)-1,Number(parts.day)+offset,12));
    return {id:date.toISOString().slice(0,10),day:new Intl.DateTimeFormat('en-US',{weekday:'short',timeZone:'UTC'}).format(date),label:new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric',timeZone:'UTC'}).format(date)};
  });
}
function dateLabel(value) {
  const p=value.split('-').map(Number);
  return new Intl.DateTimeFormat('en-US',{weekday:'short',month:'short',day:'numeric',timeZone:'UTC'}).format(new Date(Date.UTC(p[0],p[1]-1,p[2],12)));
}
function title(text){return `<h2 id="booking-title" tabindex="-1">${text}</h2>`;}
function back(target){return `<button class="back" type="button" data-back="${target}"><span aria-hidden="true">←</span> Back</button>`;}
function row(label,value,extra=''){return `<div class="summary-row ${extra}"><span>${escapeText(label)}</span><span>${escapeText(value)}</span></div>`;}
function setView(html,step){
  state.step=step;
  document.querySelector('#step-count').textContent=step>4?'PREVIEW COMPLETE':`STEP ${step} OF 4`;
  document.querySelector('#progress-fill').style.width=`${Math.min(step,4)*25}%`;
  content.innerHTML=html;
  document.querySelector('#booking-title')?.focus({preventScroll:true});
}
function renderLocation(){
  setView(`${title('Where should we meet?')}<p class="form-intro">Start with the ZIP code where you need a notary.</p><form id="zip-form"><label for="zip">Appointment ZIP code</label><input id="zip" name="zip" inputmode="numeric" autocomplete="postal-code" pattern="[0-9]{5}" maxlength="5" placeholder="e.g. 78732" value="${escapeText(state.zip)}" required><p id="zip-feedback" class="helper" aria-live="polite">Try 78732, 78653, or 78602 in this preview.</p><button class="primary" type="submit">Check availability <span aria-hidden="true">→</span></button></form><div class="card-note">You’ll see the complete price before checkout.</div>`,1);
}
function chooseLocation(zip){
  if(!/^\d{5}$/.test(zip))throw new Error('Enter a five-digit ZIP code.');
  state.zip=zip;state.zone=ZONES[zip]??null;state.date='';state.time='';state.editing=false;state.booking=null;
  record('coverage_checked');
  state.zone?renderTimes():renderOutside();
  return {zip,coverage:state.zone?'pilot_zone':'address_review_required',zone:state.zone?.name??null,testMode:true};
}
function renderOutside(){
  const typo=state.zip==='78563';
  setView(`${back(1)}${title(typo?'Looking for Manor?':'Let’s check your area.')}<p class="form-intro">${typo?'Manor’s ZIP code is 78653. Choose it below to try the Manor booking preview.':`We haven’t set online coverage for ${escapeText(state.zip)}. Nearby addresses around 78732 will need a coverage check before booking.`}</p>${typo?'<button class="primary" type="button" data-correct-manor>Use Manor · 78653</button>':'<button class="primary" type="button" data-request="coverage">Preview a coverage request</button>'}<button class="secondary" type="button" data-back="1">Try another ZIP code</button><div class="notice">This is a preview. No coverage request will be sent.</div>`,1);
}
function renderTimes(){
  if(!state.zone){renderLocation();return;}
  const dates=sampleDates();
  if(!dates.some(date=>date.id===state.date)){state.date=dates[0].id;state.time='';}
  setView(`${back(state.editing?5:1)}<span class="pill">${escapeText(state.zone.name)} · ${escapeText(state.zip)}</span>${title(state.editing?'Choose another time.':'A time that works for you.')}<p class="form-intro">These are sample appointments. Actual hours for each pilot area are still being set.</p><div class="field-label" id="date-label">Date</div><div class="date-grid" role="group" aria-labelledby="date-label">${dates.map(date=>`<button class="choice" type="button" data-date="${date.id}" aria-pressed="${date.id===state.date}">${date.day}<small>${date.label}</small></button>`).join('')}</div><div class="field-label" id="time-label">Arrival time <span class="small-print">· Central Time</span></div><div class="time-grid" role="group" aria-labelledby="time-label">${SAMPLE_TIMES.map(time=>`<button class="choice" type="button" data-time="${time}" aria-pressed="${time===state.time}">${time}</button>`).join('')}</div><button class="primary" type="button" data-next-details ${state.time?'':'disabled'}>${state.editing?'Review new time':'Continue'} <span aria-hidden="true">→</span></button><button class="no-times" type="button" data-request="time">Need a different time?</button>`,2);
}
function renderDetails(){
  if(!state.zone||!state.time){renderTimes();return;}
  setView(`${back(2)}${title('A few details. Then you’re set.')}<p class="form-intro">Sample information is filled in so you can try the complete experience. No personal details are needed.</p><form id="details-form"><label for="name">Name</label><input id="name" name="name" maxlength="100" required value="${escapeText(state.details.name)}" autocomplete="off"><label for="email">Email</label><input id="email" name="email" type="email" maxlength="160" required value="${escapeText(state.details.email)}" autocomplete="off"><label for="address">Meeting address</label><input id="address" name="address" maxlength="200" required value="${escapeText(state.details.address)}" autocomplete="off"><p class="helper">${escapeText(state.zone.name)}, TX ${escapeText(state.zip)} · Example address only</p><div class="notice">Standard pilot visit: one acknowledgment for one signature. Documents must already be prepared; any required witnesses must be arranged.</div><label class="checkbox-row"><input type="checkbox" name="ready" required ${state.details.ready?'checked':''}><span>For this example, I have the document instructions, suitable identification, and any required witnesses ready.</span></label><p id="details-error" class="helper error" role="alert"></p><button class="primary" type="submit">Review appointment <span aria-hidden="true">→</span></button></form>`,3);
}
function saveDetails(form){
  const name=String(form.get('name')??'').trim(),email=String(form.get('email')??'').trim(),address=String(form.get('address')??'').trim();
  if(!name||!address||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw new Error('Please enter a name, a valid email, and a meeting address.');
  if(!form.get('ready'))throw new Error('Confirm the preparation checklist to continue.');
  state.details={name,email,address,ready:true};record('details_completed');renderReview();
}
function renderReview(message=''){
  if(!state.zone||!state.time||!state.details.ready){renderDetails();return;}
  setView(`${back(state.editing?2:3)}${title(state.editing?'Review your new time.':'Everything, up front.')}<p class="form-intro">${state.editing?'Your existing demo payment stays the same.':'Check the appointment details and the full price.'}</p>${row('Area',`${state.zone.name} · ${state.zip}`)}${row('When',`${dateLabel(state.date)}, ${state.time} CT`)}${row('Where',state.details.address)}${row('Mobile visit','$65.00')}${row('One acknowledgment','$10.00')}${row('Total','$75.00','total')}<div class="payment-demo"><span class="payment-icon">DEMO</span><div>Sample payment method<small>Simulation only · No card details collected</small></div></div>${message?`<p class="helper error" role="alert">${escapeText(message)}</p>`:''}<button class="primary" type="button" data-pay>${state.editing?'Update demo appointment':'Simulate $75 payment'}</button><p class="small-print">This action creates a confirmation preview only. No charge is made, no time is reserved, and no email or text is sent. Refreshing clears the example.</p>`,4);
  record('checkout_viewed');
}
function completeDemo(){
  if(state.step!==4||!state.zone||!state.time||!state.details.ready)throw new Error('Complete the appointment details before the payment simulation.');
  if(!sampleDates().some(date=>date.id===state.date)||!SAMPLE_TIMES.includes(state.time))throw new Error('Please select a current sample appointment.');
  const editing=state.editing;
  state.booking={id:state.booking?.id??`DEMO-${crypto.randomUUID().slice(0,8).toUpperCase()}`,status:'confirmed',zip:state.zip,zone:state.zone.name,date:state.date,time:state.time,total:75};
  state.editing=false;record(editing?'demo_rescheduled':'demo_payment_completed');renderConfirmation();
  return {id:state.booking.id,status:'demo_confirmed',amount:75,charged:false,messagesSent:false};
}
function renderConfirmation(){
  if(!state.booking){renderLocation();return;}
  const cancelled=state.booking.status==='cancelled';
  setView(`<div class="success-icon" aria-hidden="true">${cancelled?'−':'✓'}</div>${title(cancelled?'Demo appointment cancelled.':'Your confirmation preview.')}<p class="form-intro">${cancelled?'The example appointment is cancelled. There was no real booking or payment to refund.':'This is what a successful booking could look like. No real appointment has been booked.'}</p><div class="confirmation-id">${escapeText(state.booking.id)} · ${cancelled?'CANCELLED':'DEMO ONLY'}</div><div class="confirmation-summary">${row('Area',`${state.booking.zone} · ${state.booking.zip}`)}${row('When',`${dateLabel(state.booking.date)}, ${state.booking.time} CT`)}${row('Meeting address',state.details.address)}${row('Example total','$75.00')}${row('Actual charge','$0.00')}</div>${cancelled?'':`<div class="notice">Confirmation would go to ${escapeText(state.details.email)}. No message was sent.</div><button class="primary" type="button" data-reschedule>Try rescheduling</button><button class="secondary" type="button" data-cancel>Try cancellation</button>`}<button class="inline-link" type="button" data-reset>Start another example</button>`,5);
}
function renderCancel(){setView(`${back(5)}${title('Cancel this example?')}<p class="form-intro">This cancels only the demo appointment shown on this page. No real payment or reservation is affected.</p><button class="primary" type="button" data-confirm-cancel>Cancel demo appointment</button><button class="secondary" type="button" data-back="5">Keep demo appointment</button>`,5);}
function renderRequest(kind){
  record(kind==='time'?'alternate_time_requested':'coverage_review_requested');
  setView(`${back(kind==='time'?2:1)}${title(kind==='time'?'Tell us your preferred time.':'Check a nearby address.')}<p class="form-intro">${kind==='time'?'Preview how a customer could request an appointment outside the displayed times.':'Addresses near 78732 need a coverage review. Enter example details to try the request flow.'}</p><form id="request-form"><label for="request-detail">${kind==='time'?'Preferred day and time':'Meeting area or address'}</label><input id="request-detail" name="detail" required maxlength="200" placeholder="${kind==='time'?'e.g. Friday after 5 PM':'e.g. an address near 78732'}"><label for="request-email">Email</label><input id="request-email" name="email" type="email" required value="alex@example.com"><div class="notice">Use example details. This request stays on this page and will not be sent.</div><button class="primary" type="submit">Preview request confirmation</button></form>`,kind==='time'?2:1);
}
function reset(){state.zip='';state.zone=null;state.date='';state.time='';state.booking=null;state.editing=false;state.details={name:'Alex Taylor',email:'alex@example.com',address:'123 Example Lane',ready:false};renderLocation();}
content.addEventListener('submit',event=>{
  event.preventDefault();
  if(event.target.id==='zip-form'){try{chooseLocation(new FormData(event.target).get('zip').trim());}catch(error){const el=document.querySelector('#zip-feedback');el.textContent=error.message;el.classList.add('error');}}
  if(event.target.id==='details-form'){try{saveDetails(new FormData(event.target));}catch(error){document.querySelector('#details-error').textContent=error.message;}}
  if(event.target.id==='request-form'){record('demo_request_completed');setView(`<div class="success-icon" aria-hidden="true">✓</div>${title('Request preview complete.')}<p class="form-intro">A live service would acknowledge the request and confirm whether the address or time can be accommodated.</p><div class="notice">No request was saved or sent. This example does not reserve an appointment.</div><button class="primary" type="button" data-reset>Try a pilot-area booking</button>`,5);}
});
content.addEventListener('click',event=>{
  const b=event.target.closest('button');if(!b)return;
  if(b.dataset.back){const target=Number(b.dataset.back);if(target===1)renderLocation();if(target===2)renderTimes();if(target===3)renderDetails();if(target===5)renderConfirmation();}
  if(b.hasAttribute('data-correct-manor'))chooseLocation('78653');
  if(b.dataset.date){state.date=b.dataset.date;state.time='';renderTimes();}
  if(b.dataset.time){state.time=b.dataset.time;renderTimes();}
  if(b.hasAttribute('data-next-details')){record('sample_slot_selected');state.editing?renderReview():renderDetails();}
  if(b.dataset.request)renderRequest(b.dataset.request);
  if(b.hasAttribute('data-pay')){b.disabled=true;try{completeDemo();}catch(error){renderReview(error.message);}}
  if(b.hasAttribute('data-reschedule')){state.editing=true;renderTimes();}
  if(b.hasAttribute('data-cancel'))renderCancel();
  if(b.hasAttribute('data-confirm-cancel')){if(state.booking)state.booking.status='cancelled';record('demo_cancelled');renderConfirmation();}
  if(b.hasAttribute('data-reset'))reset();
});
document.querySelectorAll('[data-zip]').forEach(button=>button.addEventListener('click',()=>{chooseLocation(button.dataset.zip);document.querySelector('.booking-card').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});}));

// Same coverage action for a supporting browser agent; never books or charges.
const modelContext=document.modelContext;
if(modelContext?.registerTool){
  const lifecycle=new AbortController();
  try{Promise.resolve(modelContext.registerTool({
    name:'start_notary_booking_preview',title:'Check pilot coverage',
    description:'Check a five-digit ZIP and open its simulated booking step. Does not book, charge, or send a message.',
    inputSchema:{type:'object',properties:{zip:{type:'string',pattern:'^[0-9]{5}$'}},required:['zip'],additionalProperties:false},
    annotations:{readOnlyHint:false,untrustedContentHint:false},
    execute(input){if(!input||typeof input.zip!=='string'||Object.keys(input).some(key=>key!=='zip'))throw new Error('Provide only a five-digit zip string.');return chooseLocation(input.zip);}
  },{signal:lifecycle.signal})).catch(()=>{});}catch{}
  addEventListener('pagehide',()=>lifecycle.abort(),{once:true});
}
