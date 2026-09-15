export function database(env) {
  if(!env.DB?.prepare || !env.DB?.batch) throw Object.assign(new Error('Booking storage is unavailable. Please try again later.'),{status:503});
  const db=env.DB;
  return {sql:(query,...values)=>db.prepare(query).bind(...values),batch:statements=>db.batch(statements)};
}
