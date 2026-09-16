// Test pilot: customer outbox recipients must match the booking; operator inbox is allowlisted.
export async function deliverNotifications(db,env,bookingId,owner,now=Date.now(),send=fetch){
  if(!env.RESEND_API_KEY||env.NOTIFICATION_EMAIL!=='mlw903@gmail.com')return;
  const rows=await db.sql("SELECT * FROM notifications WHERE booking_id = ? AND owner = ? AND status IN ('queued','email_failed') ORDER BY due_at",bookingId,owner).all();
  for(const note of rows.results){
    // Resend idempotency lasts 24 hours. Never risk an ambiguous repeat beyond it.
    if(now-note.due_at>23*60*60*1000){await db.sql("UPDATE notifications SET status = 'review_required' WHERE id = ?",note.id).run();continue;}
    const customer=note.kind.startsWith('customer_');
    if(customer){
      if(env.CUSTOMER_EMAIL_ENABLED!=='true')continue;
      const booking=await db.sql('SELECT email FROM bookings WHERE id = ? AND owner = ?',bookingId,owner).first();
      if(!booking||note.recipient!==booking.email)continue;
    }else if(note.recipient!=='mlw903@gmail.com')continue;
    let accepted=false;
    try{
      const response=await send('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${env.RESEND_API_KEY}`,'Content-Type':'application/json','Idempotency-Key':`512notary/${note.id}`},body:JSON.stringify({from:env.CUSTOMER_EMAIL_ENABLED==='true'?'512notary.com <appointments@512notary.com>':'512notary.com Test <onboarding@resend.dev>',reply_to:'mlw903@gmail.com',to:[note.recipient],subject:`[TEST] ${note.subject}`,text:note.body}),signal:AbortSignal.timeout(8000)});
      const result=await response.json();accepted=response.ok&&typeof result.id==='string';
    }catch{ /* Do not log credentials, message contents, or provider response bodies. */ }
    await db.sql("UPDATE notifications SET status = ? WHERE id = ? AND status IN ('queued','email_failed')",accepted?'accepted_by_email_service':'email_failed',note.id).run();
  }
}
