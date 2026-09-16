import {handleApi} from './api.mjs';
import assets from '../.build/assets.mjs';
import {operator} from './admin.mjs';
export default {async fetch(request,env){
  const path=new URL(request.url).pathname;
  if(path.startsWith('/api/')){const response=await handleApi(request,env);response.headers.set('X-Robots-Tag','noindex, nofollow, noarchive');return response;}
  if(!['GET','HEAD'].includes(request.method))return new Response('Method not allowed',{status:405});
  if(['/admin','/admin/','/admin.html'].includes(path)){
    try{operator(request);}catch(e){return new Response(e.status===401?'<!doctype html><meta name="robots" content="noindex"><title>Admin sign-in</title><h1>512notary admin</h1><p>Customer booking needs no account. Admin access requires your authorized account.</p><a href="/signin-with-chatgpt?return_to=%2Fadmin" target="_top">Sign in with ChatGPT</a>':'This account is not authorized for the admin calendar.',{status:e.status,headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Robots-Tag':'noindex'}});}
  }
  const asset=assets[path==='/'?'/index.html':['/admin','/admin/'].includes(path)?'/admin.html':path];
  if(!asset)return new Response('Not found',{status:404});
  return new Response(request.method==='HEAD'?null:asset.body,{headers:{'X-Robots-Tag':'noindex, nofollow, noarchive','Content-Type':asset.type,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin','Content-Security-Policy':"default-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; script-src 'self'; connect-src 'self'; img-src 'self' data:; frame-ancestors 'self'; base-uri 'self'; form-action 'self'"}});
}};
