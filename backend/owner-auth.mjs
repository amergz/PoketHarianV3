import {createRememberStore} from './remember-device.mjs';
import {randomBytes,scrypt as scryptCallback,timingSafeEqual} from 'node:crypto';
import {promisify} from 'node:util';
const scrypt=promisify(scryptCallback),sessions=new Map(),attempts=new Map();
const remember=createRememberStore();
const production=process.env.NODE_ENV==='production';
export function expectedOrigin(req){return production?process.env.APP_ORIGIN:`http://${req.headers.host}`;}
const configured=()=>typeof process.env.OWNER_PASSWORD==='string'&&process.env.OWNER_PASSWORD.length>=16&&process.env.OWNER_PASSWORD.length<=256&&(!production||/^https:\/\/[^/]+$/.test(process.env.APP_ORIGIN||''));
const page=`<!doctype html><html lang="ms"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Log masuk Poket Harian</title><link rel="manifest" href="/manifest.json"><link rel="apple-touch-icon" href="/apple-touch-icon.png"><meta name="theme-color" content="#4338ca"><script src="/pwa-login.js" defer></script><style>body{font:16px/1.5 system-ui;background:#eef2ff;color:#1e293b;margin:0;padding:24px}main{max-width:420px;margin:8vh auto;background:white;padding:24px;border-radius:20px}label{display:block;margin:16px 0}input[type=password]{display:block;box-sizing:border-box;width:100%;min-height:44px;font:inherit}label:has(input[type=checkbox]){display:flex;align-items:center;gap:12px;min-height:44px}input[type=checkbox]{width:22px;height:22px;flex-shrink:0}button{min-height:44px;width:100%;font:inherit;background:#4338ca;color:white;border:0;border-radius:8px}</style><body><main><h1>Poket Harian</h1><form method="post" action="/auth/login"><label>Kata laluan pemilik <input type="password" name="password" autocomplete="current-password" required maxlength="256"></label><label><input type="checkbox" name="remember" value="1"> Ingat peranti ini selama 30 hari</label><button>Log masuk</button></form></main></body></html>`;
const publicPwa=new Set(['/manifest.json','/service-worker.js','/pwa-login.js','/icon-192.png','/icon-512.png','/icon-maskable-192.png','/icon-maskable-512.png','/apple-touch-icon.png']);
export async function accessGate(req,res,url,send){
 if(req.method==='GET'&&publicPwa.has(url.pathname))return false;
 // Local development retains existing workflows. Production always fails closed.
 if(!production&&!process.env.OWNER_PASSWORD)return false;
 res.setHeader('Cache-Control','no-store');res.setHeader('Vary','Cookie');
 if(!configured()){send(503,{error:'Akses pemilik belum dikonfigurasi.'});return true;}
 if(production&&req.headers.host!==new URL(process.env.APP_ORIGIN).host){send(403,{error:'Host tidak dibenarkan.'});return true;}
 if(req.method==='POST'&&req.headers.origin!==expectedOrigin(req)){send(403,{error:'Origin tidak dibenarkan.'});return true;}
 const now=Date.now();for(const [k,v] of sessions)if(v<now)sessions.delete(k);for(const [k,v] of attempts)if(v.until<now)attempts.delete(k);
 const remembered=(req.headers.cookie||'').match(/(?:^|;\s*)poket_device=([^;]+)(?:;|$)/)?.[1];
 const token=(req.headers.cookie||'').match(/(?:^|;\s*)poket_owner=([a-f0-9]{64})(?:;|$)/)?.[1];
 if(url.pathname==='/auth/login'){
  if(req.method==='GET'){if((token&&sessions.has(token))||(remembered&&await remember.valid(remembered))){res.writeHead(303,{Location:'/'});res.end();return true;}res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});res.end(page);return true;}
  if(req.method!=='POST'){send(405,{error:'Kaedah tidak dibenarkan.'});return true;}
  // Single-owner deployment: global limit avoids trusting proxy IP headers.
  const rate=attempts.get('owner')||{count:0,until:now+15*60*1000};if(rate.count>=5){send(429,{error:'Terlalu banyak percubaan. Tunggu 15 minit.'});return true;}rate.count++;attempts.set('owner',rate);
  let body='';for await(const chunk of req){body+=chunk;if(Buffer.byteLength(body)>2048){send(413,{error:'Permintaan terlalu besar.'});return true;}}
  const fields=new URLSearchParams(body);const password=fields.get('password')||'';const salt='poket-owner-login-v1';const [given,wanted]=await Promise.all([scrypt(password,salt,64),scrypt(process.env.OWNER_PASSWORD,salt,64)]);
  if(!timingSafeEqual(given,wanted)){send(401,{error:'Log masuk gagal.'});return true;}
  attempts.delete('owner');const secure=production?'; Secure':'';
  if(fields.get('remember')==='1'){if(!remember.configured()){send(503,{error:'Ingat peranti belum dikonfigurasi. Log masuk tanpa pilihan ini atau sediakan storan sesi.'});return true;}if(remembered)await remember.revoke(remembered);const persistent=await remember.issue();sessions.delete(token);res.setHeader('Set-Cookie',[`poket_device=${persistent}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${remember.ttl}${secure}`,`poket_owner=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${secure}`]);}
  else {if(remembered)await remember.revoke(remembered);sessions.delete(token);const id=randomBytes(32).toString('hex');sessions.set(id,now+12*60*60*1000);res.setHeader('Set-Cookie',[`poket_owner=${id}; HttpOnly; SameSite=Strict; Path=/; Max-Age=43200${secure}`,`poket_device=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${secure}`]);}
  res.writeHead(303,{Location:'/'});res.end();return true;
 }
 const authenticated=(token&&sessions.has(token))||(remembered&&await remember.valid(remembered));
 if(!authenticated){if(url.pathname.startsWith('/api/'))send(401,{error:'Sila log masuk.'});else{res.writeHead(303,{Location:'/auth/login'});res.end();}return true;}
 if(url.pathname==='/auth/logout'&&req.method==='POST'){if(remembered)await remember.revoke(remembered);sessions.delete(token);res.setHeader('Set-Cookie',['poket_owner','poket_device'].map(name=>`${name}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${production?'; Secure':''}`));res.writeHead(303,{Location:'/auth/login'});res.end();return true;}
 return false;
}
