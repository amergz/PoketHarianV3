import {randomBytes,createHmac,timingSafeEqual} from 'node:crypto';
const TTL=30*24*60*60;
export function createRememberStore({secret=process.env.SESSION_SECRET,url=process.env.SESSION_STORE_URL,key=process.env.SESSION_STORE_TOKEN,fetchImpl=fetch,now=Date.now}={}){
 const configured=()=>typeof secret==='string'&&secret.length>=32&&/^https:\/\//.test(url||'')&&!!key;
 async function command(args){if(!configured())throw Object.assign(Error('Storan sesi kekal belum dikonfigurasi.'),{status:503});let r;try{r=await fetchImpl(url,{method:'POST',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},body:JSON.stringify(args),signal:AbortSignal.timeout(5000)});}catch{throw Object.assign(Error('Storan sesi tidak tersedia.'),{status:503});}if(!r.ok)throw Object.assign(Error('Storan sesi tidak tersedia.'),{status:503});const d=await r.json();if(d.error)throw Object.assign(Error('Storan sesi gagal.'),{status:503});return d.result;}
 const sign=s=>createHmac('sha256',secret).update(s).digest('hex');
 function parse(token){if(!configured()||typeof token!=='string'||!/^\d{13}\.[a-f0-9]{64}\.[a-f0-9]{64}$/.test(token))return null;const [expiry,id,mac]=token.split('.'),data=expiry+'.'+id;if(Number(expiry)<=now()||Number(expiry)>now()+TTL*1000)return null;if(!timingSafeEqual(Buffer.from(mac),Buffer.from(sign(data))))return null;return id;}
 return {configured,ttl:TTL,async issue(){const id=randomBytes(32).toString('hex'),data=(now()+TTL*1000)+'.'+id;await command(['SET','poket:device:'+id,'1','EX',TTL]);return data+'.'+sign(data);},async valid(token){const id=parse(token);return !!id&&await command(['GET','poket:device:'+id])==='1';},async revoke(token){const id=parse(token);if(id)await command(['DEL','poket:device:'+id]);}};
}
