const {test}=require('node:test'),assert=require('node:assert/strict');const a=require('../js/finance-analysis.js'),chat=require('../js/chat-contract.js');
const categories={expense:['Makan','Minyak'],income:['Niaga','Gaji']},today='2026-11-05',plan={monthlyBudget:1000,carryForward:false};
const tx=[{id:1,date:'2026-11-02',type:'income',category:'Niaga',amount:500},{id:2,date:'2026-11-03',type:'expense',category:'Makan',amount:100},{id:3,date:'2026-11-05',type:'savings',category:'Simpanan',amount:50},{id:4,date:'2026-10-03',type:'expense',category:'Makan',amount:80},{id:5,date:'2026-10-20',type:'expense',category:'Minyak',amount:1000}];
const q=(op='report')=>({op,period:'month',month:null,type:'expense',category:null});
test('separate totals, partial matched days, previous zero and no data',()=>{
 const r=a.run(tx,plan,q(),{today,categories});assert.equal(r.current.income,50000);assert.equal(r.current.expense,10000);assert.equal(r.current.savings,5000);assert.equal(r.current.net,40000);assert.equal(r.current.availableChange,35000);assert.equal(r.previous.expense,8000);assert.equal(r.prior.end,'2026-10-05');assert.equal(r.delta.percent,25);assert.ok(a.format(r).includes('Setakat 2026-11-05'));
 const empty=a.run([],plan,q(),{today,categories});assert.equal(empty.delta.percent,null);assert.ok(a.format(empty).includes('Tiada rekod'));assert.ok(!a.format(empty).includes('Infinity'));
});
test('year, leap month, full month and followup previous',()=>{
 assert.equal(a.previous(a.period('2027-01','2027-01-05')).start,'2026-12-01');assert.equal(a.previous(a.period('2024-03','2024-03-31')).end,'2024-02-29');
 const old=a.run(tx,plan,{...q(),month:'2026-10'},{today,categories});assert.equal(old.current.expense,108000);assert.equal(old.range.end,'2026-10-31');
 const follow=a.run(tx,plan,{...q('total'),period:'followup_previous'},{today,categories,last:{q:q(),range:a.period('2026-11',today)}});assert.equal(follow.range.start,'2026-10-01');assert.equal(follow.range.end,'2026-10-05');
});
test('salary period remains separate from calendar, future and query rejected',()=>{
 const data=[...tx,{id:6,date:'2026-10-23',type:'income',category:'Gaji',amount:2000}];const r=a.run(data,plan,{...q('balance'),period:'salary'},{today,categories});assert.equal(r.salary.start,'2026-10-23');assert.equal(r.salary.end,'2026-11-22');assert.equal(r.salary.remaining,335000);
 assert.throws(()=>a.run(tx,plan,{...q(),op:'execute'},{today,categories}));assert.throws(()=>a.run(tx,plan,{...q(),month:'2027-01'},{today,categories}));
});
test('cache invalidates after add/edit/Undo/import state; no source mutation',()=>{
 const data=JSON.parse(JSON.stringify(tx)),before=JSON.stringify(data);const one=a.run(data,plan,q(),{today,categories});assert.equal(JSON.stringify(data),before);data.push({id:99,date:today,type:'expense',category:'Makan',amount:10});assert.equal(a.run(data,plan,q(),{today,categories}).current.expense,one.current.expense+1000);data.at(-1).amount=20;assert.equal(a.run(data,plan,q(),{today,categories}).current.expense,12000);data.pop();assert.equal(a.run(data,plan,q(),{today,categories}).current.expense,10000);assert.equal(a.run([],plan,q(),{today,categories}).current.count,0);
});
test('listed questions resolve locally, questions cannot carry writes, invalid mock rejected',()=>{
 for(const s of ['Berapa belanja hari ini?','Bulan ini paling banyak belanja apa?','Berapa pendapatan niaga bulan lepas?','Bandingkan belanja makan bulan ini dengan bulan lepas.','Berapa baki sampai gaji?','Kenapa belanja bulan ini meningkat?','Buat laporan bulan ini.','Ringkaskan Oktober 2026.','Kalau bulan lepas?'])assert.ok(a.localQuery(s,today,null,categories),s);
 assert.equal(a.localQuery('Makan RM12',today,null,categories),null);
 assert.throws(()=>chat.check({intent:'question',operations:[{}],clarification:'',query:null},{referenceDate:today,categories}));
 const good={intent:'question',operations:[],clarification:'',query:null,analysis:q()};assert.equal(chat.check(good,{referenceDate:today,categories}).analysis.op,'report');assert.throws(()=>chat.check({...good,analysis:{...q(),op:'sql'}},{referenceDate:today,categories}));
});
