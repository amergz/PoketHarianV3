import http from 'node:http';
import {accessGate,expectedOrigin} from './owner-auth.mjs';
import {createHash} from 'node:crypto';
const runtimeFiles=['server.mjs','deepseek.mjs','diagnostics.mjs','../js/chat-contract.js'];
const runtimeHash=createHash('sha256');
for(const file of runtimeFiles)runtimeHash.update(await readFile(new URL(file,import.meta.url)));
const runtime={revision:'schema-trace-2',startedAt:new Date().toISOString(),fingerprint:runtimeHash.digest('hex')};
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import core from '../js/phase1-core.js';
import analysis from '../js/finance-analysis.js';
import {extract} from './deepseek.mjs';
import {recordFailure,recordCall} from './diagnostics.mjs';
import {configurationStatus} from './config.mjs';
function validateRequest(d){
 if(Object.hasOwn(d,'image'))throw Error('Fungsi resit dinyahaktifkan.');
 if(d.analysisCategories&&!['expense','income','savings'].every(k=>Array.isArray(d.analysisCategories[k])&&d.analysisCategories[k].length<=200&&d.analysisCategories[k].every(c=>typeof c==='string'&&c.length<=100)))throw Error('Kategori analisis tidak sah.');
 if(d.analysisContext!=null){const a=d.analysisContext;if(!a.q||!a.range||!core.dateValid(a.range.start)||!core.dateValid(a.range.end)||a.range.start>a.range.end)throw Error('Konteks analisis tidak sah.');analysis.validate(a.q,d.analysisCategories||d.categories);if(JSON.stringify(a).length>1000)throw Error('Konteks terlalu panjang.');}

 if(d.schemaVersion!==2||typeof d.requestId!=='string'||!/^[a-zA-Z0-9-]{8,100}$/.test(d.requestId)||typeof d.message!=='string'||!d.message.trim()||d.message.length>2000||d.timeZone!=='Asia/Kuala_Lumpur'||!core.dateValid(d.referenceDate)||d.referenceDate!==core.malaysiaDate()||!d.categories||!['expense','income'].every(k=>Array.isArray(d.categories[k])&&d.categories[k].length<=100&&d.categories[k].every(x=>typeof x==='string'&&x.length<=100))||!Array.isArray(d.context)||d.context.length>6||d.context.some(x=>!['user','assistant'].includes(x.role)||typeof x.content!=='string'||x.content.length>500)||!Array.isArray(d.recent)||d.recent.length>10||!Array.isArray(d.accounts)||d.accounts.length>30)throw Error('Kontrak permintaan tidak sah.');
 if(Object.keys(d).some(k=>!['schemaVersion','requestId','message','referenceDate','timeZone','categories','context','recent','accounts','pending','analysisContext','analysisCategories','image'].includes(k)))throw Error('Field permintaan tidak dibenarkan.');
}
const root=fileURLToPath(new URL('../',import.meta.url));
const port=Number(process.env.PORT||8787);
const allowed=new Set(['pwa-login.js','index.html','manifest.json','service-worker.js','apple-touch-icon.png','icon-192.png','icon-512.png','icon-maskable-192.png','icon-maskable-512.png','js/phase1-core.js','js/finance-analysis.js','js/chat-contract.js','js/chat-auto.js','js/phase1-app.js','css/phase1.css']);
const mime={'.html':'text/html; charset=utf-8','.json':'application/json','.js':'text/javascript','.css':'text/css','.png':'image/png'};
const quotas=new Map();
let connected=false;
const pending=new Map();
let probeUsed=false;
const server=http.createServer(async(req,res)=>{
 res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
 const send=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(data));};
 try{
  const url=new URL(req.url,'http://localhost');
  if(req.method==='GET'&&url.pathname==='/health')return send(200,{status:'ok'});
  if(await accessGate(req,res,url,send))return;
  if(url.pathname.startsWith('/api/')){
   if(req.method==='GET'&&url.pathname==='/api/ai/status')return send(200,{app:'Poket Harian',runtime,...configurationStatus(),connected,provider:connected?'DeepSeek':null});
   if(req.method==='POST'&&url.pathname==='/api/ai/probe'){
    if(process.env.NODE_ENV==='production')return send(404,{error:'Endpoint tidak tersedia.'});
    if(req.headers.origin!==expectedOrigin(req))return send(403,{error:'Origin tidak dibenarkan.'});
    if(configurationStatus().maxAttempts!==1||configurationStatus().keySource!=='backend/.env')return send(409,{error:'Probe memerlukan satu percubaan dan key backend/.env.'});
    if(probeUsed)return send(409,{error:'Probe sudah digunakan; tiada retry.'});
    probeUsed=true;const result=await extract(null,{maxAttempts:1,probe:true});connected=true;return send(200,result);
   }
   if(req.method!=='POST'||url.pathname!=='/api/ai/chat')return send(404,{error:'Endpoint tidak tersedia.'});
   if(req.headers.origin!==expectedOrigin(req))return send(403,{error:'Origin tidak dibenarkan.'});
   if(!String(req.headers['content-type']).startsWith('application/json'))return send(415,{error:'JSON diperlukan.'});
   let body='';for await(const chunk of req){body+=chunk;if(Buffer.byteLength(body)>50000)return send(413,{error:'Permintaan terlalu besar.'});}
   const data=JSON.parse(body);validateRequest(data);
   const cacheKey=data.requestId;const fingerprint=createHash('sha256').update(JSON.stringify(data)).digest('hex');
   if(pending.has(cacheKey)){const entry=pending.get(cacheKey);if(entry.fingerprint!==fingerprint)return send(409,{error:'Request ID telah digunakan untuk mesej lain.'});return send(200,await entry.promise);}
   const day=new Date().toISOString().slice(0,10);const count=quotas.get(day)||0;
   if(count>=20)return send(429,{error:'Had 20 mesej sehari untuk pelayan lokal ini.'});
   if(!configurationStatus().configured)return send(503,{error:'AI belum disambungkan: key tiada atau masih placeholder.'});
   quotas.set(day,count+1);
   const promise=extract(data).then(result=>{connected=true;recordCall({requestId:data.requestId,source:'DeepSeek',model:result.model,status:'success',httpStatus:result.httpStatus});return result;}).catch(e=>{recordCall({requestId:data.requestId,source:'DeepSeek',model:e.diagnostic?.model,status:e.diagnostic?.stage||'failed',httpStatus:e.diagnostic?.httpStatus});throw e;});
   pending.set(cacheKey,{fingerprint,promise});if(pending.size>100)pending.delete(pending.keys().next().value);
   try{return send(200,await promise);}catch(e){pending.delete(cacheKey);throw e;}
  }
  if(req.method!=='GET')return send(405,{error:'Kaedah tidak dibenarkan.'});
  const file=url.pathname==='/'?'index.html':decodeURIComponent(url.pathname.slice(1));
  if(!allowed.has(file))return send(404,{error:'Fail tidak tersedia.'});
  const content=await readFile(path.join(root,file));res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream'});res.end(content);
 }catch(e){recordFailure(e);send(e.status||400,{error:e.diagnostic?e.diagnostic.message:'Permintaan tidak sah. Tiada transaksi disimpan oleh backend.',...(e.diagnostic?{diagnostic:e.diagnostic}:{})});}
});
server.requestTimeout=10000;
server.listen(port,'0.0.0.0',()=>{
 console.log('Poket Harian lokal: http://127.0.0.1:'+port);
 console.log(configurationStatus().configured?'Adapter DeepSeek dikonfigurasi — sambungan belum diuji.':'AI belum disambungkan — key tiada atau masih placeholder.');
 console.log(JSON.stringify(configurationStatus()));
});
