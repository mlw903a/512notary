export function database(env) {
  if(!env.DB?.prepare || !env.DB?.batch) throw Object.assign(new Error('Booking storage is unavailable. Please try again later.'),{status:503});
  const db=env.DB;
  return {env,customerEmail:env.CUSTOMER_EMAIL_ENABLED==='true'&&!!env.GUEST_LINK_SECRET&&!!env.RESEND_API_KEY,notificationRecipient:env.RESEND_API_KEY&&env.NOTIFICATION_EMAIL==='mlw903@gmail.com'?env.NOTIFICATION_EMAIL:null,sql:(query,...values)=>db.prepare(query).bind(...values),batch:statements=>db.batch(statements)};
}
