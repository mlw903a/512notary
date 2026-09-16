const hex=bytes=>Array.from(new Uint8Array(bytes),x=>x.toString(16).padStart(2,'0')).join('');
async function key(env){if(!env.GUEST_LINK_SECRET)throw Object.assign(new Error('Guest booking is temporarily unavailable.'),{status:503});return crypto.subtle.importKey('raw',new TextEncoder().encode(env.GUEST_LINK_SECRET),{name:'HMAC',hash:'SHA-256'},false,['sign','verify']);}
export async function guestToken(env,id,expires){const payload=`${id}.${expires}`;return `${payload}.${hex(await crypto.subtle.sign('HMAC',await key(env),new TextEncoder().encode(payload)))}`;}
export async function guestOwner(request,env,now){
 const token=request.headers.get('x-booking-access');if(!token)return null;
 const match=token.match(/^([a-f0-9-]{36})\.(\d{13})\.([a-f0-9]{64})$/);
 if(!match||Number(match[2])<now)throw Object.assign(new Error('This private link is invalid or expired.'),{status:401});
 const bytes=Uint8Array.from(match[3].match(/../g),x=>parseInt(x,16));
 if(!await crypto.subtle.verify('HMAC',await key(env),bytes,new TextEncoder().encode(`${match[1]}.${match[2]}`)))throw Object.assign(new Error('This private link is invalid or expired.'),{status:401});
 return `guest:${match[1]}`;
}
export async function managementUrl(env,b){return `https://512notary.com/?booking=${b.id}#access=${await guestToken(env,b.id,b.start+30*86400000)}`;}
export async function throttle(db,request,scope,limit,now){
 const ip=request.headers.get('cf-connecting-ip')||'unknown';
 const digest=hex(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(ip)));
 const bucket=`${scope}:${Math.floor(now/3600000)}:${digest}`;
 const result=await db.sql('INSERT INTO rate_limits (bucket, hits) VALUES (?, 1) ON CONFLICT(bucket) DO UPDATE SET hits = hits + 1 RETURNING hits',bucket).all();
 if(result.results[0].hits>limit)throw Object.assign(new Error('Too many requests. Please try again in an hour.'),{status:429});
}
