(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./phase1-core.js'):root.PoketCore,typeof module==='object'&&module.exports?require('./chat-contract.js'):root.PoketChat);if(typeof module==='object'&&module.exports)module.exports=api;else root.PoketAnalysis=api;})(globalThis,function(core,contract){
 const operations=['total','top','compare','report','reasons','balance'];
 const date=(y,m,d)=>new Date(Date.UTC(y,m,d)).toISOString().slice(0,10);
 function period(month,today){const [y,m]=month.split('-').map(Number);const end=date(y,m,0);return {start:month+'-01',end:end>today?today:end,fullEnd:end,partial:end>today};}
 function previous(p){const [y,m]=p.start.split('-').map(Number);const start=date(y,m-2,1),fullEnd=date(y,m-1,0);return {start,end:p.partial?date(y,m-2,Math.min(Number(p.end.slice(8)),Number(fullEnd.slice(8)))):fullEnd,partial:p.partial,fullEnd};}
 function validate(q,categories){return contract.validateAnalysis(q,categories);}
 function timeRange(t,today,tx,plan={}){
 const [y,m]=today.split('-').map(Number),n=t.count;
 if(t.kind==='previous_months')return {start:date(y,m-1-n,1),end:date(y,m-1,0),label:n+' bulan penuh sebelum bulan semasa'};
 if(t.kind==='including_current')return {start:date(y,m-n,1),end:today,label:n+' bulan termasuk bulan semasa setakat '+today};
 if(t.kind==='month_offset')return {start:date(y,m-1-n,1),end:date(y,m-n,0),label:'Satu bulan, '+n+' bulan yang lalu'};
 if(t.kind==='last_days')return {start:date(y,m-1,Number(today.slice(8))-n+1),end:today,label:n+' hari terakhir termasuk hari ini'};
 if(t.kind==='explicit_months'){if(t.startMonth+'-01'>today)throw Error('Tempoh masa depan.');return {start:t.startMonth+'-01',end:period(t.endMonth,today).end,label:'Julat bulan eksplisit'};}
 if(t.kind==='previous_salary_cycles'){const d=new Date(salary(tx,{...plan,carryForward:false},today).start+'T00:00:00Z');d.setUTCDate(d.getUTCDate()-1);const end=d.toISOString().slice(0,10);let cursor=end,start;for(let i=0;i<n;i++){start=salary(tx,{...plan,carryForward:false},cursor).start;const d=new Date(start+'T00:00:00Z');d.setUTCDate(d.getUTCDate()-1);cursor=d.toISOString().slice(0,10);}return {start,end,label:n+' kitaran gaji penuh sebelumnya'};}
 throw Error('Tempoh tidak disokong.');
 }
 function resolve(q,today,last){
 if(q.time){if(q.time.kind==='inherit'){if(!last)throw Error('Nyatakan tempoh.');return {...last,q:{...last.q,category:q.category,type:q.type,op:q.op}};}return {q,range:timeRange(q.time,today,[])};}

  if(q.period==='followup_previous'){if(!last?.range)throw Error('Tempoh sebelumnya belum jelas. Nyatakan bulan.');const p=q.op==='compare'?last.range:previous(last.range);return {...last,q:{...last.q,op:q.op==='total'?last.q.op:q.op},range:p};}
  if(q.period==='salary')return {q,range:null};
  if(q.period==='today')return {q,range:{start:today,end:today,partial:false}};
  let p=period(q.month||today.slice(0,7),today);if(q.period==='previous'){p=previous(p);p={...p,end:p.fullEnd,partial:false};}
  if(p.start>today)throw Error('Tempoh masa depan belum mempunyai rekod sebenar.');return {q,range:p};
 }
 function aggregate(tx,p,category=null){const a={income:0,expense:0,savings:0,count:0,categories:{}};for(const t of tx){if(t.date<p.start||t.date>p.end||category&&contract.categoryKey(t.category)!==contract.categoryKey(category))continue;if(!['income','expense','savings'].includes(t.type))continue;const n=core.cents(t.amount);a[t.type]+=n;a.count++;if(t.type==='expense')a.categories[t.category]=(a.categories[t.category]||0)+n;}a.net=a.income-a.expense;a.availableChange=a.net-a.savings;return a;}
 function difference(now,before){return {amount:now-before,percent:before===0?null:(now-before)/before*100};}
 function salary(tx,plan,today){const g=tx.filter(t=>t.type==='income'&&t.category==='Gaji').sort((a,b)=>b.date.localeCompare(a.date))[0];const anchor=g?Number(g.date.slice(8)):1;const [y,m,d]=today.split('-').map(Number);const startFor=(y,m)=>date(y,m-1,Math.min(anchor,Number(date(y,m,0).slice(8))));let start=startFor(y,m);if(today<start)start=startFor(m===1?y-1:y,m===1?12:m-1);const [sy,sm]=start.split('-').map(Number);const next=startFor(sm===12?sy+1:sy,sm===12?1:sm+1);const end=date(Number(next.slice(0,4)),Number(next.slice(5,7))-1,Number(next.slice(8))-1);
  let carry=0;if(plan.carryForward){const past=tx.filter(t=>t.date<start),cycles=new Set();for(const t of past){const p=salaryCycleStart(t.date,anchor);cycles.add(p);}carry=Math.max(0,Math.round(plan.monthlyBudget*100)*cycles.size+past.reduce((n,t)=>n+(t.type==='income'?1:-1)*core.cents(t.amount),0));}
  const a=aggregate(tx,{start,end});return {start,end,remaining:Math.round(plan.monthlyBudget*100)+carry+a.income-a.expense-a.savings};
 }
 function salaryCycleStart(day,anchor){const [y,m,d]=day.split('-').map(Number);const s=date(y,m-1,Math.min(anchor,Number(date(y,m,0).slice(8))));if(day>=s)return s;return date(y,m-2,Math.min(anchor,Number(date(y,m-1,0).slice(8))));}
 const cache=new Map();let version='';
 function run(tx,plan,query,{today=core.malaysiaDate(),categories,last=null}={}){
  validate(query,categories);const resolved=resolve(query,today,last);if(query.time&&query.time.kind!=='inherit')resolved.range=timeRange(query.time,today,tx,plan);const v=JSON.stringify([tx,plan]);if(v!==version){cache.clear();version=v;}const key=JSON.stringify([resolved,today]);if(cache.has(key))return cache.get(key);
  let out;if(query.op==='balance'||query.period==='salary'){const s=salary(tx,plan,today);out={...resolved,salary:s};}else{const range=resolved.range,prior=resolved.q.compareMonth?period(resolved.q.compareMonth,today):previous(range),a=aggregate(tx,range,resolved.q.category),b=aggregate(tx,prior,resolved.q.category);out={...resolved,prior,current:a,previous:b,delta:difference(a[resolved.q.type],b[resolved.q.type]),top:Object.entries(a.categories).sort((a,b)=>b[1]-a[1]).slice(0,5),drivers:Object.keys({...a.categories,...b.categories}).map(c=>({category:c,change:(a.categories[c]||0)-(b.categories[c]||0)})).sort((a,b)=>b.change-a.change).slice(0,3)};}if(out.current&&out.q.time){out.monthly=[];let month=out.range.start.slice(0,7);while(month<=out.range.end.slice(0,7)){const p=period(month,today);const r={start:p.start<out.range.start?out.range.start:p.start,end:p.fullEnd>out.range.end?out.range.end:p.fullEnd};const a=aggregate(tx,r,out.q.category);out.monthly.push({month,amount:a[out.q.type],count:tx.filter(t=>t.type===out.q.type&&t.date>=r.start&&t.date<=r.end&&(!out.q.category||contract.categoryKey(t.category)===contract.categoryKey(out.q.category))).length});const [y,m]=month.split('-').map(Number);month=date(y,m,1).slice(0,7);}}
 cache.set(key,out);return out;
 }
 const rm=n=>'RM'+(n/100).toFixed(2);
 function format(r){
  const caveat='Berdasarkan rekod aplikasi sahaja; kelengkapan rekod tidak dapat dipastikan.';
  if(r.salary)return `Kitaran gaji ${r.salary.start} hingga ${r.salary.end}: baki peruntukan ${rm(r.salary.remaining)}. Ini dana bajet aplikasi, bukan baki bank atau unjuran. Formula asal turut memasukkan rekod bertarikh dalam seluruh kitaran.\n${caveat}`;
  const a=r.current,b=r.previous,q=r.q;const lines=[`${r.range.start} hingga ${r.range.end}${r.range.partial?' — Setakat '+r.range.end:''}.`];
  if(!a.count)lines.push('Tiada rekod untuk tempoh ini; ini tidak membuktikan tiada aktiviti kewangan.');
  if(q.op==='report')lines.push(`Pendapatan ${rm(a.income)}; belanja ${rm(a.expense)}.`,`Aliran tunai bersih (pendapatan − belanja) ${rm(a.net)}.`,`Pindahan simpanan ${rm(a.savings)} (berasingan); perubahan dana boleh belanja selepas pindahan ${rm(a.availableChange)}.`);
  else lines.push(`${q.type==='income'?'Pendapatan':q.type==='savings'?'Pindahan simpanan':'Belanja'}${q.category?' '+q.category:''}: ${rm(a[q.type])}.`);
  if(['top','report','reasons'].includes(q.op))lines.push('Kategori belanja terbesar: '+(r.top.map(([c,n])=>c+' '+rm(n)).join('; ')||'tiada rekod')+'.');
  if(['compare','report','reasons'].includes(q.op)){lines.push(`Bandingan sepadan ${r.prior.start} hingga ${r.prior.end}: ${rm(b[q.type])}; beza ${rm(r.delta.amount)}${r.delta.percent===null?' (tiada asas peratus: nilai sebelumnya sifar)':` (${r.delta.percent.toFixed(1)}%)`}.`);if(!b.count)lines.push('Tempoh sebelumnya tiada rekod; perbandingan mungkin tidak lengkap.');}
  if(['report','reasons'].includes(q.op)){const positive=r.drivers.filter(d=>d.change>0);lines.push(positive.length?'Kenaikan direkod mengikut kategori: '+positive.map(d=>d.category+' +'+rm(d.change)).join('; ')+'. Ini sumbangan angka, bukan bukti punca sebenar.':'Tiada kenaikan kategori positif direkod dalam perbandingan ini.');lines.push(r.top.length?'Semak rekod kategori '+r.top[0][0]+' dahulu jika mahu mengurangkan belanja.':'Lengkapkan rekod sebelum membuat keputusan bajet.');}
  lines.push(caveat);return lines.join('\n');
 }
 function localQuery(text,today,last,categories){const s=text.toLowerCase().trim();if(!/^(berapa|bulan ini paling|bandingkan|buat laporan|laporan|ringkaskan|kenapa|kalau bulan lepas|belanja bulan ini|kategori terbesar)/.test(s))return null;let op=/laporan|ringkaskan/.test(s)?'report':/kenapa/.test(s)?'reasons':/banding/.test(s)?'compare':/paling|terbesar/.test(s)?'top':/baki|gaji/.test(s)?'balance':'total';let period=/sampai gaji|kitaran gaji/.test(s)?'salary':/^kalau bulan lepas|^bandingkan dengan bulan sebelumnya/.test(s)?'followup_previous':/hari ini/.test(s)?'today':/bulan lepas/.test(s)&&!/bulan ini/.test(s)?'previous':'month';let type=/pendapatan/.test(s)?'income':/simpanan/.test(s)?'savings':'expense';let category=(categories[type]||[]).find(c=>s.includes(c.toLowerCase()))||null;let month=null;const names=['januari','februari','mac','april','mei','jun','julai','ogos','september','oktober','november','disember'];for(let i=0;i<12;i++){const re=new RegExp(names[i]+'\\s+(\\d{4})');const m=s.match(re);if(m)month=m[1]+'-'+String(i+1).padStart(2,'0');}return {op,period,month,type,category};}
 const money=n=>'RM '+(n/100).toLocaleString('en-MY',{minimumFractionDigits:2,maximumFractionDigits:2});
 function presentation(r,tx,{largest=false}={}){
  if(r.monthly){const label=m=>new Intl.DateTimeFormat('ms-MY',{month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(m+'-01T00:00:00Z'));return {version:1,monthly:true,title:`${r.q.type==='expense'?'Belanja':'Jumlah'} ${r.q.category||''} ? ${r.range.start} hingga ${r.range.end}`,range:r.range,query:r.q,rows:r.monthly.map(x=>({category:label(x.month)+(x.count?'':' (tiada rekod)'),amount:x.amount})),total:r.current[r.q.type],totalLabel:'Jumlah '+r.monthly.length+' bulan',observations:[r.range.label,'Berdasarkan rekod; bulan tanpa rekod tidak membuktikan tiada aktiviti.'],note:'Pengiraan tempatan daripada rekod aplikasi.',transactions:[]};}
  if(r.salary||r.q.type!=='expense')return null;
  const rows=Object.entries(r.current.categories).filter(([,n])=>n>0).sort((a,b)=>b[1]-a[1]);
  const relevant=tx.filter(t=>t.type==='expense'&&t.date>=r.range.start&&t.date<=r.range.end&&(!r.q.category||t.category===r.q.category)).sort((a,b)=>core.cents(b.amount)-core.cents(a.amount));
  const observations=[];
  if(rows.length)observations.push(`${rows[0][0]} paling besar: ${money(rows[0][1])} (${(rows[0][1]/r.current.expense*100).toFixed(1)}% daripada belanja direkodkan).`);
  else observations.push('Tiada belanja direkodkan untuk tempoh ini.');
  if(relevant.length)observations.push(`Transaksi terbesar berdasarkan rekod: ${relevant[0].text||relevant[0].category}, ${money(core.cents(relevant[0].amount))} pada ${relevant[0].date}.`);
  if(['compare','report','reasons'].includes(r.q.op))observations.push(`Tempoh sepadan ${r.prior.start} hingga ${r.prior.end}: ${money(r.previous.expense)}; perubahan ${money(r.delta.amount)}${r.delta.percent===null?' (asas sebelumnya sifar; peratus tidak tersedia)':` (${r.delta.percent.toFixed(1)}%)`}. Perubahan angka ini tidak membuktikan punca perbelanjaan.`);
  const month=new Intl.DateTimeFormat('ms-MY',{month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(r.range.start+'T00:00:00Z'));
  const summary=r.q.op==='report'?`Pendapatan ${money(r.current.income)}. Aliran tunai bersih (pendapatan tolak belanja) ${money(r.current.net)}. Pindahan simpanan ${money(r.current.savings)}, berasingan.`:'';
  return {version:1,title:`${month} — belanja direkodkan${r.range.partial?' setakat '+r.range.end:''}.`,range:{...r.range},query:{...r.q},rows:rows.map(([category,amount])=>({category,amount})),total:r.current.expense,observations,summary,note:'Ringkasan tempatan berdasarkan rekod; kelengkapan rekod tidak dapat dipastikan.',transactions:largest?relevant.slice(0,5).map(t=>({text:t.text||t.category,date:t.date,amount:core.cents(t.amount)})):[]};
 }
 function budgetRange(tx,plan,day,mode='salary'){
  if(mode==='month'){const p=period(day.slice(0,7),day);return {start:p.start,end:p.fullEnd};}
  // Use the application's salary anchor, resolved for the transaction date.
  const s=salary(tx, {...plan,carryForward:false},day);return {start:s.start,end:s.end};
 }
 function budgetCommand(text,categories,tx,plan,today=core.malaysiaDate()){
  const m=text.trim().match(/^tetapkan\s+(bajet|sasaran pendapatan)\s+(.+?)\s+RM\s*([\d,]+(?:\.\d{1,2})?)\s+untuk\s+(kitaran gaji ini|bulan ini)[.!]?$/i);
  if(!m)return null;const type=m[1].toLowerCase()==='bajet'?'expense':'income';const category=(categories[type]||[]).find(c=>c.toLowerCase()===m[2].trim().toLowerCase());
  if(!category)throw Error('Kategori tidak dikenali. Gunakan kategori sedia ada.');
  const amount=Math.round(Number(m[3].replace(/,/g,''))*100);if(!Number.isSafeInteger(amount)||amount<0)throw Error('Jumlah bajet tidak sah.');
  const mode=m[4].toLowerCase()==='bulan ini'?'month':'salary';return {type,category,amount,mode,...budgetRange(tx,plan,today,mode)};
 }
 function forecast(tx,today=core.malaysiaDate()){
 const [y,m]=today.split('-').map(Number),monthsData=[];
 for(let i=3;i>=1;i--){const month=date(y,m-1-i,1).slice(0,7),catTotals={};let total=0;for(const t of tx){if(t.type!=='expense'||!t.date.startsWith(month+'-'))continue;catTotals[t.category]=(catTotals[t.category]||0)+t.amount;total+=t.amount;}monthsData.push({year:Number(month.slice(0,4)),month:Number(month.slice(5))-1,catTotals,total});}
 const active=monthsData.filter(m=>m.total>0),catAverages={};for(const c of new Set(active.flatMap(m=>Object.keys(m.catTotals))))catAverages[c]=active.reduce((sum,m)=>sum+(m.catTotals[c]||0),0)/(active.length||1);
 return {catAverages,totalAvg:Object.values(catAverages).reduce((a,b)=>a+b,0),monthsData,activeMonthsCount:active.length};
 }
 function postSave(tx,items,plan,budgets=[]){
  const groups=new Map();for(const t of items){
   const configured=budgets.find(b=>b.type===t.type&&b.category===t.category&&t.date>=b.start&&t.date<=b.end);
   const prediction=t.type==='expense'&&!configured?forecast(tx,t.date):null;const reference=prediction?.catAverages[t.category];const estimated=Number.isFinite(reference)&&reference>0;
   const range=estimated?{start:t.date.slice(0,7)+'-01',end:period(t.date.slice(0,7),t.date).fullEnd}:configured?{start:configured.start,end:configured.end}:budgetRange(tx,plan,t.date);
   const key=JSON.stringify([t.type,t.category,range]);if(groups.has(key))continue;
   const spent=tx.filter(x=>x.type===t.type&&x.category===t.category&&x.date>=range.start&&x.date<=range.end).reduce((n,x)=>n+core.cents(x.amount),0);
   const budget=configured?.amount??(estimated?reference*100:null),remaining=budget===null?null:budget-spent,percent=budget===null||budget===0?null:spent/budget*100;
   groups.set(key,{type:t.type,category:t.category,range,mode:estimated?'month':configured?.mode||'salary',source:estimated?'forecast':'manual',basis:estimated?prediction.monthsData.filter(m=>m.total>0).map(m=>m.year+'-'+String(m.month+1).padStart(2,'0')):null,spent,budget,remaining,percent});
  }
  return {version:1,rows:[...groups.values()],ids:items.map(t=>t.id).filter(x=>x!==undefined)};
 }
 return {validate,resolve,aggregate,difference,run,format,localQuery,period,previous,salary,money,presentation,budgetRange,budgetCommand,postSave,forecast};
});
