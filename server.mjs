import { createServer } from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { randomBytes, scrypt as scryptCallback, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';
import { readFile, mkdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scrypt=promisify(scryptCallback);
const here=dirname(fileURLToPath(import.meta.url));
const SESSION_AGE=7*86400;
const rooms=new Set(['allgemein','fragen','quellen']);
const digest=value=>createHash('sha256').update(value).digest('hex');
const publicUser=u=>u?{id:u.id,username:u.username,name:u.name,role:u.role}:null;
function error(status,message){return Object.assign(new Error(message),{status})}

export async function createApp(options={}) {
  const dataDir=resolve(options.dataDir||process.env.DATA_DIR||join(here,'data'));
  await mkdir(dataDir,{recursive:true,mode:0o700});
  const db=new DatabaseSync(join(dataDir,'athar.sqlite'));
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
    CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,username TEXT UNIQUE NOT NULL,name TEXT NOT NULL,salt TEXT NOT NULL,password_hash TEXT NOT NULL,role TEXT NOT NULL DEFAULT 'member');
    CREATE TABLE IF NOT EXISTS sessions(token_hash TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS messages(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,room TEXT NOT NULL,text TEXT NOT NULL,created_at INTEGER NOT NULL);
    CREATE INDEX IF NOT EXISTS room_messages ON messages(room,created_at);
    CREATE TABLE IF NOT EXISTS reports(message_id TEXT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,created_at INTEGER NOT NULL,PRIMARY KEY(message_id,user_id));
  `);
  const configuredOrigin=options.origin||process.env.PUBLIC_ORIGIN||'';
  const production=options.production??(process.env.NODE_ENV==='production');
  if(production&&!configuredOrigin){db.close();throw new Error('PUBLIC_ORIGIN mit der HTTPS-Adresse der Website setzen.');}
  const secure=options.secureCookies??(production||configuredOrigin.startsWith('https://'));
  if(production&&!configuredOrigin.startsWith('https://')){db.close();throw new Error('Im Produktionsbetrieb muss PUBLIC_ORIGIN mit https:// beginnen.');}
  const trustProxy=options.trustProxy??(process.env.TRUST_PROXY==='1');
  const configuredAdmin=(options.adminUsername||process.env.ADMIN_USERNAME||'').toLowerCase();
  // Admin rights are assigned only to an existing account explicitly selected by the operator.
  if(configuredAdmin)db.prepare("UPDATE users SET role='admin' WHERE username=?").run(configuredAdmin);
  const assets=new Map(await Promise.all(['index.html','styles.css','content.js','app.js'].map(async name=>[name,await readFile(join(here,name))])));
  const rates=new Map(),streams=new Set();
  let activeHashes=0;
  const cleanup=setInterval(()=>{const now=Date.now();for(const [k,v] of rates)if(v.until<now)rates.delete(k);db.prepare('DELETE FROM sessions WHERE expires<?').run(now);},60000);cleanup.unref();
  function rate(key,max,windowMs){const now=Date.now();let value=rates.get(key);if(!value||value.until<=now){if(rates.size>=10000)throw error(503,'Der Server ist ausgelastet. Bitte später erneut versuchen.');value={count:0,until:now+windowMs};rates.set(key,value)}value.count++;if(value.count>max)throw error(429,'Zu viele Anfragen. Bitte warte etwas und versuche es erneut.');}
  function ip(req){return trustProxy?(String(req.headers['x-forwarded-for']||req.socket.remoteAddress).split(',').at(-1).trim()):req.socket.remoteAddress;}
  function token(req){const value=(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('athar_session='))?.slice(14);return value&&/^[a-f0-9]{64}$/.test(value)?value:null;}
  function user(req){const t=token(req);if(!t)return null;return db.prepare('SELECT users.* FROM users JOIN sessions ON sessions.user_id=users.id WHERE sessions.token_hash=? AND sessions.expires>?').get(digest(t),Date.now())||null;}
  function required(req){const u=user(req);if(!u)throw error(401,'Bitte melde dich an.');return u;}
  function cookie(value,age=SESSION_AGE){return `athar_session=${value}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${age}${secure?'; Secure':''}`;}
  function session(res,u,req){const old=token(req);if(old)db.prepare('DELETE FROM sessions WHERE token_hash=?').run(digest(old));const value=randomBytes(32).toString('hex');db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(digest(value),u.id,Date.now()+SESSION_AGE*1000);res.setHeader('Set-Cookie',cookie(value));}
  function send(res,status,data){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));}
  function broadcast(){for(const peer of streams)if(!peer.res.write('event: change\ndata: {}\n\n'))peer.res.destroy();}
  async function body(req){if(!String(req.headers['content-type']||'').startsWith('application/json'))throw error(415,'JSON erwartet.');if(Number(req.headers['content-length'])>16384)throw error(413,'Die Anfrage ist zu groß.');const chunks=[];let length=0;for await(const chunk of req){length+=chunk.length;if(length>16384)throw error(413,'Die Anfrage ist zu groß.');chunks.push(chunk)}try{const result=JSON.parse(Buffer.concat(chunks).toString('utf8'));if(!result||Array.isArray(result)||typeof result!=='object')throw new Error();return result}catch{throw error(400,'Ungültige JSON-Daten.');}}
  async function hash(password,salt){if(activeHashes>=4)throw error(503,'Die Anmeldung ist ausgelastet. Bitte gleich erneut versuchen.');activeHashes++;try{return Buffer.from(await scrypt(password,salt,64))}finally{activeHashes--;}}
  function ownOrigin(req){const expected=configuredOrigin||`http://${req.headers.host}`;if(req.headers.origin!==expected||req.headers['sec-fetch-site']==='cross-site')throw error(403,'Diese Anfrage stammt nicht von der ATHAR-Website.');}
  const server=createServer(async(req,res)=>{
    res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','strict-origin-when-cross-origin');res.setHeader('X-Frame-Options','DENY');res.setHeader('Permissions-Policy','camera=(), microphone=(), geolocation=()');
    res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; font-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
    if(secure)res.setHeader('Strict-Transport-Security','max-age=31536000');
    try {
      const url=new URL(req.url,'http://localhost'),path=url.pathname;
      if(!path.startsWith('/api/')){if(!['GET','HEAD'].includes(req.method))throw error(405,'Methode nicht erlaubt.');const file=path==='/'?'index.html':path.slice(1);if(!assets.has(file))throw error(404,'Nicht gefunden.');res.writeHead(200,{'Content-Type':file.endsWith('.html')?'text/html; charset=utf-8':file.endsWith('.css')?'text/css; charset=utf-8':'text/javascript; charset=utf-8','Cache-Control':'no-cache'});res.end(req.method==='HEAD'?undefined:assets.get(file));return;}
      if(['POST','DELETE','PUT','PATCH'].includes(req.method))ownOrigin(req);
      const address=digest(String(ip(req))),method=req.method;
      if(path!=='/api/events')rate('api:'+address,300,60000);
      if(method==='GET'&&path==='/api/status'){send(res,200,{service:'athar',version:1,chat:true});return;}
      if(method==='GET'&&path==='/api/session'){send(res,200,{user:publicUser(user(req))});return;}
      if(method==='POST'&&(path==='/api/register'||path==='/api/login')){
        rate('auth:'+address,12,15*60000);
        const data=await body(req),username=typeof data.username==='string'?data.username.trim().toLowerCase():'',password=data.password;
        if(!/^[a-z0-9_-]{3,30}$/.test(username)||typeof password!=='string'||password.length<10||password.length>128)throw error(400,'Benutzername: 3–30 Buchstaben, Ziffern, _ oder -. Passwort: 10–128 Zeichen.');
        if(path==='/api/register'){
          const name=typeof data.name==='string'?data.name.trim():'';if(name.length<2||name.length>40)throw error(400,'Anzeigename: 2–40 Zeichen.');
          if(db.prepare('SELECT id FROM users WHERE username=?').get(username))throw error(409,'Dieser Benutzername ist bereits vergeben.');
          const salt=randomBytes(16).toString('hex'),passwordHash=await hash(password,salt),id=randomBytes(16).toString('hex');
          try{db.prepare('INSERT INTO users(id,username,name,salt,password_hash) VALUES(?,?,?,?,?)').run(id,username,name,salt,passwordHash.toString('hex'));}catch(err){if(String(err.message).includes('UNIQUE'))throw error(409,'Dieser Benutzername ist bereits vergeben.');throw err;}
          const u=db.prepare('SELECT * FROM users WHERE id=?').get(id);session(res,u,req);send(res,201,{user:publicUser(u)});return;
        }
        const u=db.prepare('SELECT * FROM users WHERE username=?').get(username),salt=u?.salt||'00000000000000000000000000000000';
        const candidate=await hash(password,salt),expected=Buffer.from(u?.password_hash||'00'.repeat(64),'hex');
        if(!timingSafeEqual(candidate,expected)||!u)throw error(401,'Benutzername oder Passwort ist falsch.');
        session(res,u,req);send(res,200,{user:publicUser(u)});return;
      }
      if(method==='POST'&&path==='/api/logout'){await body(req);const t=token(req);if(t)db.prepare('DELETE FROM sessions WHERE token_hash=?').run(digest(t));res.setHeader('Set-Cookie',cookie('',0));send(res,200,{ok:true});return;}
      if(method==='DELETE'&&path==='/api/account'){const u=required(req);await body(req);db.prepare('DELETE FROM users WHERE id=?').run(u.id);res.setHeader('Set-Cookie',cookie('',0));broadcast();send(res,200,{ok:true});return;}
      if(method==='GET'&&path==='/api/messages'){
        const room=url.searchParams.get('room')||'allgemein';if(!rooms.has(room))throw error(400,'Unbekannter Gesprächsraum.');
        const messages=db.prepare('SELECT m.id,m.user_id AS userId,u.name,m.room,m.text,m.created_at AS createdAt FROM messages m JOIN users u ON u.id=m.user_id WHERE m.room=? ORDER BY m.created_at DESC,m.rowid DESC LIMIT 100').all(room).reverse();send(res,200,{messages});return;
      }
      if(method==='POST'&&path==='/api/messages'){
        const u=required(req);rate('write:'+u.id,30,60000);const data=await body(req),text=typeof data.text==='string'?data.text.trim():'';
        if(!rooms.has(data.room))throw error(400,'Unbekannter Gesprächsraum.');if(!text||text.length>2000)throw error(400,'Nachrichten müssen 1–2.000 Zeichen enthalten.');
        const id=randomBytes(16).toString('hex'),createdAt=Date.now();db.prepare('INSERT INTO messages VALUES(?,?,?,?,?)').run(id,u.id,data.room,text,createdAt);broadcast();send(res,201,{message:{id,userId:u.id,name:u.name,room:data.room,text,createdAt}});return;
      }
      if(method==='DELETE'&&/^\/api\/messages\/[a-f0-9]{32}$/.test(path)){
        const u=required(req);await body(req);const id=path.split('/').at(-1),message=db.prepare('SELECT user_id FROM messages WHERE id=?').get(id);
        if(!message)throw error(404,'Die Nachricht existiert nicht.');if(message.user_id!==u.id&&u.role!=='admin')throw error(403,'Du darfst diese Nachricht nicht löschen.');
        db.prepare('DELETE FROM messages WHERE id=?').run(id);broadcast();send(res,200,{ok:true});return;
      }
      if(method==='POST'&&path==='/api/reports'){
        const u=required(req);rate('report:'+u.id,10,60000);const data=await body(req);if(typeof data.messageId!=='string'||!db.prepare('SELECT id FROM messages WHERE id=?').get(data.messageId))throw error(404,'Die Nachricht existiert nicht.');
        db.prepare('INSERT OR IGNORE INTO reports VALUES(?,?,?)').run(data.messageId,u.id,Date.now());send(res,201,{ok:true});return;
      }
      if(method==='GET'&&path==='/api/reports'){
        const u=required(req);if(u.role!=='admin')throw error(403,'Nur für die Administration.');
        const reports=db.prepare('SELECT m.id,m.text,u.name,count(r.user_id) AS count FROM reports r JOIN messages m ON m.id=r.message_id JOIN users u ON u.id=m.user_id GROUP BY m.id ORDER BY min(r.created_at) LIMIT 100').all();send(res,200,{reports});return;
      }
      if(method==='GET'&&path==='/api/events'){
        if(req.headers['sec-fetch-site']==='cross-site'||(req.headers.origin&&req.headers.origin!==(configuredOrigin||`http://${req.headers.host}`)))throw error(403,'Fremder Ursprung.');
        rate('stream:'+address,30,60000);if(streams.size>=200||[...streams].filter(p=>p.address===address).length>=8)throw error(429,'Zu viele offene Verbindungen.');
        res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-cache, no-transform','Connection':'keep-alive','X-Accel-Buffering':'no'});res.write('retry: 5000\n: connected\n\n');
        const peer={res,address};streams.add(peer);const heartbeat=setInterval(()=>res.write(': heartbeat\n\n'),20000);heartbeat.unref();res.on('close',()=>{clearInterval(heartbeat);streams.delete(peer)});return;
      }
      throw error(404,'Nicht gefunden.');
    } catch(err){if(res.headersSent){res.end();return;}if(!err.status)console.error('ATHAR request error:',err.message);if(err.status===429)res.setHeader('Retry-After','60');send(res,err.status||500,{error:err.status?err.message:'Interner Serverfehler. Bitte später erneut versuchen.'});}
  });
  server.requestTimeout=15000;server.headersTimeout=10000;
  const close=async()=>{clearInterval(cleanup);for(const peer of streams)peer.res.end();await new Promise(resolveClose=>server.close(resolveClose));db.close();};
  return {server,close};
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const app=await createApp(),port=Number(process.env.PORT||3000),host=process.env.HOST||'127.0.0.1';
  app.server.listen(port,host,()=>console.log(`ATHAR läuft auf http://${host}:${app.server.address().port}`));
  for(const signal of ['SIGINT','SIGTERM'])process.once(signal,async()=>{await app.close();process.exit(0)});
}
