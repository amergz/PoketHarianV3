const {test}=require('node:test');const assert=require('node:assert/strict');const c=require('../js/phase1-core.js'),chat=require('../js/chat-contract.js');
const ctx={referenceDate:'2026-11-05',categories:{expense:['Makan','Minyak','Lain-lain'],income:['Gaji','Niaga']},recent:[{id:1}],accounts:[]};
const op=(text='Makan',amount=12,type='expense',category='Makan')=>({text,amount,type,category,date:'2026-11-05',accountAlias:null,targetId:null,isBill:false});
const result=(operations,intent='record')=>({intent,operations,clarification:'',query:null});
test('single/multiple, business income versus costs, missing amount followup, no writes for plans/questions',()=>{
 const r=chat.check(result([op(),op('Petrol',30,'expense','Minyak'),op('Customer 3D',80,'income','Niaga')]),ctx);assert.deepEqual(c.totals(r.operations),{income:80,expense:42,savings:0});
 assert.equal(chat.check(result([op('Filament niaga',45,'expense','Lain-lain')]),ctx).operations[0].type,'expense');
 assert.ok(chat.prepare(op('Makan',null),ctx).missing.includes('Berapa jumlahnya?'));assert.equal(chat.prepare(op('Makan',15),ctx).item.amount,15);
 for(const intent of ['plan','question','other']){assert.equal(chat.check(result([],intent),ctx).operations.length,0);assert.throws(()=>chat.check(result([op()],intent),ctx));}
});
test('invalid schema/categories/date/operations rejected, ambiguous correction not writable',()=>{
 assert.throws(()=>chat.check({...result([]),intent:'deleteAll'},ctx));assert.throws(()=>chat.check(result([op('x',-1)]),ctx));assert.equal(chat.check(result([op('x',10,'income','Makan')]),ctx).operations[0].category,null);assert.throws(()=>chat.check(result([{...op(),date:'2026-11-06'}]),ctx));
 assert.equal(chat.check(result([{...op(),targetId:null}],'correct'),ctx).operations[0].targetId,null);assert.throws(()=>chat.check(result([{...op(),targetId:999}],'correct'),ctx));
});
test('correction retains id, retry idempotent, Undo scoped and refuses changed record',()=>{
 const state={transactions:[{...chat.prepare(op(),ctx).item,id:1}],savings:[],debts:[],dismissed:[],history:[],categories:ctx.categories,commits:{}};
 const before=JSON.parse(JSON.stringify(state.transactions));const r=c.nextCommit(state,[chat.prepare(op('Makan',18),ctx).item],{key:'correct',editId:1});assert.equal(r.state.transactions.length,1);assert.equal(r.state.transactions[0].amount,18);assert.equal(c.nextCommit(r.state,[op()],{key:'correct'}).duplicate,true);
 const action={before,after:JSON.parse(JSON.stringify(r.state.transactions)),undone:false};assert.equal(chat.undoState(r.state,action).transactions[0].amount,12);r.state.transactions[0].amount=20;assert.throws(()=>chat.undoState(r.state,action));
});
test('DeepSeek simulated transport: non-thinking JSON, usage, invalid output, transient retry and failure',async()=>{
 const {extract}=await import('../backend/deepseek.mjs');let calls=0;const payload={...ctx,message:'Makan RM12',requestId:'simulation'};
 const fetchImpl=async(url,o)=>{calls++;assert.equal(url,'https://api.deepseek.com/chat/completions');const b=JSON.parse(o.body);assert.equal(b.thinking.type,'disabled');assert.equal(b.response_format.type,'json_object');assert.equal(b.tools,undefined);return{ok:true,json:async()=>({choices:[{finish_reason:'stop',message:{content:JSON.stringify(result([op()]))}}],usage:{total_tokens:100}})}};const r=await extract(payload,{key:'test-only-not-real',fetchImpl});assert.equal(r.usage.total_tokens,100);assert.equal(calls,1);
 await assert.rejects(extract(payload,{key:'',fetchImpl}));await assert.rejects(extract(payload,{key:'test',fetchImpl:async()=>({ok:true,json:async()=>({choices:[{finish_reason:'stop',message:{content:'not json'}}]})})}));
 calls=0;await assert.rejects(extract(payload,{key:'test',fetchImpl:async()=>{calls++;return{ok:false,status:503}}}));assert.equal(calls,2);
});
