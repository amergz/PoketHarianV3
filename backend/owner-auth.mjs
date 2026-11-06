import {randomBytes,scrypt as scryptCallback,timingSafeEqual} from 'node:crypto';
import {promisify} from 'node:util';
const scrypt=promisify(scryptCallback),sessions=new Map(),attempts=new Map();
const production=process.env.NODE_ENV==='production';
export function expectedOrigin(req){return production?process.env.APP_ORIGIN:`http://${req.headers.host}`;}
const configured=()=>typeof process.env.OWNER_PASSWORD==='string'&&process.env.OWNER_PASSWORD.length>=16&&process.env.OWNER_PASSWORD.length<=256&&(!production||/^https:\/\/[^/]+$/.test(process.env.APP_ORIGIN||''));
const page=`<!doctype html><html lang="ms"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Log masuk Poket Harian</title><link rel="manifest" href="/manifest.json"><link rel="apple-touch-icon" href="/apple-touch-icon.png"><meta name="theme-color" content="#4338ca"><script src="/pwa-login.js" defer></script><body><main><h1>Poket Harian</h1><form method="post" action="/auth/login"><label>Kata laluan pemilik <input type="password" name="password" autocomplete="current-password" required maxlength="256"></label><button>Log masuk</button></form></main></body></html>`;
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
 const token=(req.headers.cookie||'').match(/(?:^|;\s*)poket_owner=([a-f0-9]{64})(?:;|$)/)?.[1];
 if(url.pathname==='/auth/login'){
  if(req.method==='GET'){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});res.end(page);return true;}
  if(req.method!=='POST'){send(405,{error:'Kaedah tidak dibenarkan.'});return true;}
  // Single-owner deployment: global limit avoids trusting proxy IP headers.
  const rate=attempts.get('owner')||{count:0,until:now+15*60*1000};if(rate.count>=5){send(429,{error:'Terlalu banyak percubaan. Tunggu 15 minit.'});return true;}rate.count++;attempts.set('owner',rate);
  let body='';for await(const chunk of req){body+=chunk;if(Buffer.byteLength(body)>2048){send(413,{error:'Permintaan terlalu besar.'});return true;}}
  const password=new URLSearchParams(body).get('password')||'';const salt='poket-owner-login-v1';const [given,wanted]=await Promise.all([scrypt(password,salt,64),scrypt(process.env.OWNER_PASSWORD,salt,64)]);
  if(!timingSafeEqual(given,wanted)){send(401,{error:'Log masuk gagal.'});return true;}
  attempts.delete('owner');const id=randomBytes(32).toString('hex');sessions.set(id,now+12*60*60*1000);res.setHeader('Set-Cookie',`poket_owner=${id}; HttpOnly; SameSite=Strict; Path=/; Max-Age=43200${production?'; Secure':''}`);res.writeHead(303,{Location:'/'});res.end();return true;
 }
 if(!token||!sessions.has(token)){if(url.pathname.startsWith('/api/'))send(401,{error:'Sila log masuk.'});else{res.writeHead(303,{Location:'/auth/login'});res.end();}return true;}
 if(url.pathname==='/auth/logout'&&req.method==='POST'){sessions.delete(token);res.setHeader('Set-Cookie',`poket_owner=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${production?'; Secure':''}`);res.writeHead(303,{Location:'/auth/login'});res.end();return true;}
 return false;
}
