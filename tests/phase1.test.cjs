const {test}=require('node:test');const assert=require('node:assert/strict');const vm=require('node:vm');const fs=require('node:fs');const c=require('../js/phase1-core.js');
const categories={expense:['Makan','Dapur','Minyak','Tol','Lain-lain'],income:['Gaji','Bonus','Niaga','Lain-lain']};
const ctx={referenceDate:'2026-11-05',categories};
const tx=(type='expense',amount=12)=>({text:'Ujian',amount,date:'2026-11-05',category:type==='income'?'Gaji':type==='savings'?'Simpanan':'Makan',type,isBill:false,isDebtPayment:false,savingsAccountId:type==='savings'?'1':null});
const state=()=>({transactions:[],savings:[{id:1,name:'Tabung',amount:0}],debts:[{id:2,name:'Bank',balance:1000,payments:[]}],dismissed:[],history:[],categories,commits:{}});
class Storage{constructor(data={}){this.data={...data};}getItem(k){return this.data[k]??null;}setItem(k,v){this.data[k]=v;}removeItem(k){delete this.data[k];}}
test('multi transaction, ambiguity, dates and corrections',()=>{
 const a=c.parse('Tadi makan RM12, petrol RM30, barang dapur RM65.',ctx);assert.equal(a.length,3);assert.deepEqual(a.map(x=>x.category),['Makan','Minyak','Dapur']);assert.deepEqual(a.map(x=>x.amount),[12,30,65]);
 assert.equal(c.parse('sesuatu RM10',ctx)[0].category,'');assert.equal(c.parse('makan',ctx)[0].amount,'');assert.equal(c.parse('makan RM12 semalam',ctx)[0].date,'2026-11-04');
 assert.equal(c.choose('petrol',categories,{petrol:{type:'expense',category:'Tol'}}).category,'Tol');
 assert.equal(c.parse('gaji RM3000',ctx)[0].type,'income');assert.equal(c.parse('simpan RM200',ctx)[0].type,'savings');
});
test('commit batch, double click/retry, transfer edit and linked debt once',()=>{
 let s=state();const a=c.nextCommit(s,[tx(),tx('income',500),tx('savings',200)],{key:'draft'});assert.equal(s.transactions.length,0);s=a.state;assert.equal(s.savings[0].amount,200);assert.equal(c.nextCommit(s,[tx()],{key:'draft'}).state.transactions.length,3);assert.equal(new Set(a.ids).size,3);
 s=c.nextCommit(s,[tx('savings',150)],{key:'edit',editId:a.ids[2]}).state;assert.equal(s.savings[0].amount,150);
 const bill={...tx('expense',100),isBill:true,isDebtPayment:true,debtId:'2'};s=c.nextCommit(s,[bill],{key:'bill'}).state;assert.equal(s.debts[0].payments.length,1);assert.deepEqual(c.totals(s.transactions),{income:500,expense:112,savings:150});
 assert.throws(()=>c.nextCommit(s,[{...tx(),amount:0}],{key:'bad'}));
});
test('backup complete, allowlist secrets excluded, legacy safe, invalid rejected',()=>{
 const storage=new Storage({poket_tx:JSON.stringify([{...tx(),id:1}]),poket_plan:JSON.stringify({monthlyBudget:1000,carryForward:true}),poket_theme:'dark',poket_savings:JSON.stringify(state().savings),poket_palette:'cosmic',AI_API_KEY:'secret',poket_api_key:'secret'});
 const b=c.backup(storage);assert.equal(Object.keys(b.data).length,5);assert.equal(JSON.stringify(b).includes('secret'),false);
 const target=new Storage();c.write(target,c.importChanges(b));assert.deepEqual(c.snapshot(target),c.snapshot(storage));
 const old=c.importChanges({transactions:[{...tx(),id:5}],plan:{monthlyBudget:0,carryForward:true},theme:'light'});assert.equal(Object.hasOwn(old,'poket_savings'),false);
 assert.throws(()=>c.importChanges({transactions:[{...tx(),id:1,date:'2026-02-30'}]}));
 assert.throws(()=>c.importChanges({...b,data:{...b.data,poket_api_key:'x'}}));
});
test('journal rollback on failed write and interrupted commit',()=>{
 const s=new Storage({poket_theme:'dark'});const set=s.setItem.bind(s);let once=true;s.setItem=(k,v)=>{if(k==='poket_palette'&&once){once=false;throw Error('quota');}set(k,v);};
 assert.throws(()=>c.write(s,{poket_theme:'light',poket_palette:'night'}));assert.equal(s.getItem('poket_theme'),'dark');assert.equal(s.getItem(c.JOURNAL),null);
 s.setItem(c.JOURNAL,JSON.stringify({before:{poket_theme:'dark'}}));s.setItem('poket_theme','light');c.recover(s);assert.equal(s.getItem('poket_theme'),'dark');
});
test('invalid response, connection failure and timeout',async()=>{
 await assert.rejects(c.requestDemo({}, {fetchImpl:async()=>({ok:true,json:async()=>({mode:'real'})})}));
 await assert.rejects(c.requestDemo({}, {fetchImpl:async()=>{throw Error('offline');}}));
 await assert.rejects(c.requestDemo({}, {timeout:5,fetchImpl:(_,o)=>new Promise((resolve,reject)=>o.signal.addEventListener('abort',()=>reject(Error('timeout'))))}));
});
const html=fs.readFileSync('index.html','utf8').replace(/\r\n/g,'\n');
function functionCode(name,source=html){const start=source.indexOf('        function '+name+'(');const end=source.indexOf('\n        }',start)+10;return source.slice(start,end);}
test('pay cycle original logic retained: 23rd and February 31 anchor',()=>{
 const source=['getPayCycleAnchorDay','getCycleStartForDate','getNextCycleStart','getCurrentPayCycle','calculateFinance'].map(n=>functionCode(n)).join('\n');
 const helpers=functionCode('getLocalYYYYMMDD')+'\n'+functionCode('parseLocalDateStr');
 const context=vm.createContext({Date,transactions:[{...tx('income',1000),category:'Gaji',date:'2026-10-23'}],appPlan:{monthlyBudget:0,carryForward:false}});vm.runInContext(helpers+'\n'+source,context);
 assert.equal(vm.runInContext('getCurrentPayCycle(new Date(2026,10,22)).start.getDate()',context),23);assert.equal(vm.runInContext('getCurrentPayCycle(new Date(2026,10,23)).start.getMonth()',context),10);
 assert.equal(vm.runInContext('getCycleStartForDate(new Date(2026,1,28),31).getDate()',context),28);
 // Historical backup comparison omitted: deployment tests use synthetic fixtures only.
});
test('weekly graph navigation and expansion preserve expenses/income only',()=>{
 const els=new Map();const el=id=>{if(!els.has(id))els.set(id,{innerText:'',className:'',getContext:()=>({})});return els.get(id);};let config;
 const context=vm.createContext({Date,transactions:[{...tx(),date:'2026-11-05'},{...tx('income',500),date:'2026-11-05'},{...tx('savings',200),date:'2026-11-05'}],weeklyTrendDate:new Date(2026,10,5),dayShortNames:['A','I','S','R','K','J','S'],monthNames:Array(12).fill('bulan'),weeklyTrendChart:null,isWeeklyChartExpanded:false,document:{getElementById:el,documentElement:{classList:{contains:()=>false}}},Chart:function(_,cfg){config=cfg;this.destroy=()=>{};},getLocalYYYYMMDD:d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`});
 vm.runInContext(functionCode('renderWeeklyTrend'),context);vm.runInContext('renderWeeklyTrend()',context);assert.equal(config.data.datasets[0].data.reduce((a,b)=>a+b),12);assert.equal(config.data.datasets[1].data.reduce((a,b)=>a+b),500);
 vm.runInContext('isWeeklyChartExpanded=true;weeklyTrendDate.setDate(weeklyTrendDate.getDate()-7);renderWeeklyTrend()',context);assert.equal(config.data.datasets[0].data.reduce((a,b)=>a+b),0);
 vm.runInContext('isWeeklyChartExpanded=false;weeklyTrendDate.setDate(weeklyTrendDate.getDate()+7);renderWeeklyTrend()',context);assert.equal(config.data.datasets[1].data.reduce((a,b)=>a+b),500);
});
test('inline scripts syntax and protected budget/themes retained',()=>{
 for(const m of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g))if(m[1].trim())new vm.Script(m[1]);
 assert.ok(html.indexOf('id="profile-budget-card"')<html.indexOf('id="profile-settings-panel"'));for(const p of ['cosmic','night','autumn','glass','pop'])assert.ok(html.includes(p));
});
test('private service worker never intercepts auth/pages/API and deletes only own caches',async()=>{const handlers={},deleted=[];const context=vm.createContext({self:{skipWaiting(){},clients:{claim:async()=>{}},addEventListener:(n,f)=>handlers[n]=f},caches:{keys:async()=>['another-app','poket-harian-cache-v2'],delete:async k=>deleted.push(k)}});vm.runInContext(fs.readFileSync('service-worker.js','utf8'),context);let p;handlers.activate({waitUntil:v=>p=v});await p;assert.deepEqual(deleted,['poket-harian-cache-v2']);assert.equal(handlers.fetch,undefined);});
