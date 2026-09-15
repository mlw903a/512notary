// Local development/test adapter only. Production receives a managed D1 binding.
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
export function openDatabase(path=':memory:'){
  const sqlite=new DatabaseSync(path);sqlite.exec('PRAGMA foreign_keys = ON;');
  sqlite.exec('CREATE TABLE IF NOT EXISTS __local_migrations (name TEXT PRIMARY KEY)');
  for(const file of readdirSync(new URL('../drizzle/',import.meta.url)).filter(f=>f.endsWith('.sql')).sort()){
    if(sqlite.prepare('SELECT name FROM __local_migrations WHERE name=?').get(file))continue;
    sqlite.exec('BEGIN');try{sqlite.exec(readFileSync(new URL(`../drizzle/${file}`,import.meta.url),'utf8'));sqlite.prepare('INSERT INTO __local_migrations(name) VALUES (?)').run(file);sqlite.exec('COMMIT');}catch(e){sqlite.exec('ROLLBACK');throw e;}
  }
  const statement=(q,values=[])=>({bind:(...v)=>statement(q,v),first:async()=>sqlite.prepare(q).get(...values)??null,all:async()=>({results:sqlite.prepare(q).all(...values)}),run:async()=>({success:true,meta:sqlite.prepare(q).run(...values)}),execute:()=>sqlite.prepare(q).run(...values)});
  return {prepare:q=>statement(q),batch:async statements=>{sqlite.exec('BEGIN');try{const results=statements.map(s=>({success:true,meta:s.execute()}));sqlite.exec('COMMIT');return results;}catch(e){sqlite.exec('ROLLBACK');throw e;}},close:()=>sqlite.close()};
}
