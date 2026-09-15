import {createServer} from 'node:http';
import {mkdir} from 'node:fs/promises';
import {openDatabase} from './local-db.mjs';
import worker from '../dist/server/index.js';
await mkdir('.local',{recursive:true});
const DB=openDatabase('.local/pilot.sqlite');
const server=createServer(async(req,res)=>{
  try{
    const headers=new Headers();for(const [k,v]of Object.entries(req.headers))if(v!==undefined)headers.set(k,String(v));
    // Development is loopback-only. Never trust a caller-supplied identity here.
    headers.set('oai-authenticated-user-id','local-pilot-operator');
    const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>20000){res.writeHead(413);res.end();return;}chunks.push(chunk);}
    const request=new Request(`http://127.0.0.1:8765${req.url}`,{method:req.method,headers,...(!['GET','HEAD'].includes(req.method)?{body:Buffer.concat(chunks)}:{})});
    const response=await worker.fetch(request,{DB});res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));
  }catch{res.writeHead(500);res.end('Local preview failed.');}
});
server.listen(8765,'127.0.0.1',()=>console.log('Private local test: http://127.0.0.1:8765 — persistent test records only'));
process.on('SIGINT',()=>server.close(()=>{DB.close();process.exit(0);}));
