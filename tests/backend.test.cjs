const {test}=require('node:test');const assert=require('node:assert/strict');const {spawn}=require('node:child_process');
test('local server no-key state, no-store, origin, validation and private file protection',async()=>{
 const child=spawn(process.execPath,['backend/server.mjs'],{env:{...process.env,PORT:'8788',DEEPSEEK_API_KEY:''},stdio:['ignore','pipe','pipe']});
 try{
  await new Promise((resolve,reject)=>{child.stdout.once('data',resolve);child.once('error',reject);child.once('exit',code=>reject(Error('server exit '+code)));});
  const base='http://127.0.0.1:8788';const req={schemaVersion:1,requestId:'test',message:'Tadi makan RM12, petrol RM30, barang dapur RM65.',referenceDate:'2026-11-05',timeZone:'Asia/Kuala_Lumpur',categories:{expense:['Makan','Minyak','Dapur'],income:['Gaji']}};
  req.schemaVersion=2;req.requestId='test-request';req.referenceDate=require('../js/phase1-core.js').malaysiaDate();req.context=[];req.accounts=[];req.recent=[];req.pending=[];
  const post=(body,origin=base)=>fetch(base+'/api/ai/chat',{method:'POST',headers:{'Content-Type':'application/json',Origin:origin},body:JSON.stringify(body)});
  const r=await post(req);assert.equal(r.status,503);assert.equal(r.headers.get('cache-control'),'no-store');const data=await r.json();assert.match(data.error,/^AI belum disambungkan/);
  assert.equal((await post(req,'https://untrusted.example')).status,403);assert.equal((await post({})).status,400);
  for(const file of ['backend/.env.example','backups/20261105-121822-phase1/index.html','PLAN-CHAT-AI.md'])assert.equal((await fetch(base+'/'+file)).status,404);
  assert.equal((await fetch(base+'/')).status,200);
 }finally{child.kill();}
});
