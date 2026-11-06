/* Restricted model contract, shared by backend and browser. No execution of model code. */
(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./phase1-core.js'):root.PoketCore);if(typeof module==='object'&&module.exports)module.exports=api;else root.PoketChat=api;})(globalThis,function(core){
 'use strict';
 const nullable=type=>({type:[type,'null']});
 const month={type:['string','null'],pattern:'^\\d{4}-(0[1-9]|1[0-2])$'};
 const analysisSchema={type:'object',additionalProperties:false,required:['op','period','month','type','category'],properties:{op:{enum:['total','top','compare','report','reasons','balance']},period:{enum:['today','month','previous','salary','followup_previous']},month,compareMonth:month,type:{enum:['expense','income','savings']},category:nullable('string')}};
 const operationSchema={type:'object',additionalProperties:false,required:['text','amount','date','type','category','accountAlias','targetId','isBill'],properties:{text:{type:'string'},amount:nullable('number'),date:nullable('string'),type:{enum:['expense','income','savings',null]},category:nullable('string'),accountAlias:nullable('string'),targetId:nullable('number'),isBill:{type:'boolean'}}};
 const schema={type:'object',additionalProperties:false,required:['intent','operations','clarification','query'],properties:{intent:{enum:['record','correct','question','plan','clarify','other']},operations:{type:'array',items:operationSchema},clarification:{type:'string'},query:{anyOf:[{type:'null'},{type:'object',additionalProperties:false,required:['type','category','start','end'],properties:{type:{enum:['expense','income','savings']},category:nullable('string'),start:{type:'string'},end:{type:'string'}}}]},analysis:{anyOf:[{type:'null'},analysisSchema]}}};

 const receiptSchema={type:'object',additionalProperties:false,required:['merchant','date','currency','number','items','subtotal','discount','tax','charges','rounding','total','cashTendered','change','category','issues'],properties:{merchant:nullable('string'),date:nullable('string'),currency:nullable('string'),number:nullable('string'),items:{type:'array',items:{type:'object',additionalProperties:false,required:['text','quantity','total'],properties:{text:{type:'string'},quantity:nullable('number'),total:nullable('number')}}},subtotal:nullable('number'),discount:nullable('number'),tax:nullable('number'),charges:nullable('number'),rounding:nullable('number'),total:nullable('number'),cashTendered:nullable('number'),change:nullable('number'),category:nullable('string'),issues:{type:'array',items:{type:'string'}}}};
 schema.properties.receipt={anyOf:[{type:'null'},receiptSchema]};
 function receiptCheck(r){inspect(r,receiptSchema,'$.receipt');if(r.items.length>100||r.issues.length>10)throw Error('Resit terlalu panjang.');for(const k of ['subtotal','discount','tax','charges','rounding','total','cashTendered','change'])if(r[k]!==null&&!Number.isFinite(r[k]))throw Error('Angka resit tidak sah.');if(r.date!==null&&!core.dateValid(r.date))throw Error('Tarikh resit tidak sah.');return r;}
 function receiptIssues(r,today){const issues=[...r.issues];if(!r.merchant)issues.push('Nama kedai belum jelas.');if(!r.date||r.date>today)issues.push('Sahkan tarikh resit yang telah berlaku.');if(r.currency!=='MYR')issues.push('Mata wang perlu MYR; mata wang asing tidak ditukar kepada RM.');if(!(r.total>0))issues.push('Sahkan jumlah akhir.');const near=(a,b)=>Math.abs(Math.round(a*100)-Math.round(b*100))<=1;if(r.subtotal!==null&&r.total!==null&&[r.discount,r.tax,r.charges,r.rounding].every(x=>x!==null)&&!near(r.subtotal-r.discount+r.tax+r.charges+r.rounding,r.total))issues.push('Subtotal, diskaun dan caj tidak sepadan dengan jumlah akhir.');if(r.items.length&&r.items.every(i=>i.total!==null)&&r.subtotal!==null&&!near(r.items.reduce((n,i)=>n+i.total,0),r.subtotal))issues.push('Jumlah baris item tidak sepadan dengan subtotal.');if(r.cashTendered!==null&&r.change!==null&&r.total!==null&&!near(r.cashTendered-r.change,r.total))issues.push('Tunai diberi tolak baki tidak sepadan dengan jumlah dibayar.');return [...new Set(issues)];}
 const kind=v=>v===undefined?'missing':v===null?'null':Array.isArray(v)?'array':typeof v;
 function invalid(path,expected,value){const e=Error('Respons model tidak sepadan dengan kontrak.');e.validation={path,expected,received:kind(value)};throw e;}
 function inspect(v,s,path='$'){
  if(s.anyOf){for(const option of s.anyOf){try{inspect(v,option,path);return;}catch{}}const option=s.anyOf.find(x=>x.type===kind(v));if(option)return inspect(v,option,path);invalid(path,'null or object',v);}
  if(s.type&&!([].concat(s.type)).includes(kind(v)))invalid(path,[].concat(s.type).join(' or '),v);
  if(s.enum&&!s.enum.includes(v))invalid(path,'allowed enum',v);
  if(s.pattern&&v!==null&&!new RegExp(s.pattern).test(v))invalid(path,'YYYY-MM',v);
  if(s.type==='object'){for(const k of s.required||[])if(!Object.hasOwn(v,k))invalid(path+'.'+k,'required field',undefined);for(const k of Object.keys(v)){if(!s.properties[k])invalid(path,'allowed fields',v);inspect(v[k],s.properties[k],path+'.'+k);}}
  if(s.type==='array')v.forEach((x,i)=>inspect(x,s.items,path+'['+i+']'));
 }

 const timeSchema={type:'object',additionalProperties:false,required:['kind'],properties:{kind:{enum:['previous_months','including_current','month_offset','last_days','explicit_months','previous_salary_cycles','inherit']},count:{type:'number'},startMonth:month,endMonth:month}};
 analysisSchema.properties.time=timeSchema;
 const categoryKey=s=>String(s).normalize('NFKC').trim().replace(/\s+/g,' ').toLocaleLowerCase('ms-MY');
 function analysisCategories(settings,tx){const out={};for(const type of ['expense','income','savings'])out[type]=[...new Set([...(settings[type]||[]),...tx.filter(t=>t.type===type).map(t=>t.category)])].filter(x=>typeof x==='string');return out;}
 function validateAnalysis(a,categories){inspect(a,analysisSchema,'$.analysis');if(a.time){const t=a.time;if(t.kind==='explicit_months'){if(!t.startMonth||!t.endMonth||t.startMonth>t.endMonth)invalid('$.analysis.time','ordered startMonth/endMonth',t);}else if(t.kind!=='inherit'&&(!Number.isInteger(t.count)||t.count<1||t.count>(t.kind==='last_days'?366:24)))invalid('$.analysis.time.count','integer within supported range',t.count);}
 if(a.category!==null&&!(categories[a.type]||[]).some(c=>categoryKey(c)===categoryKey(a.category))){const e=Error('Kategori analisis tidak ditemui. Pilih kategori yang tersedia untuk jenis ini.');e.code='CATEGORY_NOT_FOUND';e.validation={path:'$.analysis.category',expected:'existing normalized read category',received:'string'};throw e;}return a;}

 // Deliberately narrow, auditable fallback for the reported purchase syntax.
 // General language and dates remain the provider's job, guarded by the schema.
 function reportedPurchases(ctx){
  const parts=String(ctx.message||'').trim().split(/[,;\n]+/).map(s=>s.trim());
  const matches=parts.map(p=>p.match(/^(7e|nasi kerabu)\s+RM\s*(\d+(?:\.\d{1,2})?)(?:\s+(?:masuk(?:kan)?(?:\s+(?:dalam|dlm))?(?:\s+(?:kategori|ketegori))?|kategori|ketegori)\s+(.+?))?[.!]?$/i));
  if(!parts.length||parts.length>10||matches.some(m=>!m))return null;
  return matches.map(m=>{const names=ctx.categories.expense||[],explicit=m[3]?.replace(/[.!]+$/,'').trim();
   const candidates=explicit?names.filter(c=>categoryKey(c)===categoryKey(explicit)):categoryKey(m[1])==='nasi kerabu'?names.filter(c=>['makan','makanan','makanan & minuman','makan & minum'].includes(categoryKey(c))):[];
   return {text:m[1],amount:Number(m[2]),date:ctx.referenceDate,type:'expense',category:candidates.length===1?candidates[0]:null,accountAlias:null,targetId:null,isBill:false};
  });
 }
 function check(value,ctx){
  inspect(value,schema);if(value.receipt!=null){receiptCheck(value.receipt);if(value.operations.length||value.intent!=='clarify')throw Error('Bacaan resit mesti menunggu pengesahan.');}
  if(['record','clarify'].includes(value.intent)&&!value.receipt){const purchases=reportedPurchases(ctx);if(purchases)value={...value,intent:'record',operations:purchases};}
  const segments=String(ctx.message||'').split(/[,;\n]+/).map(s=>s.trim()).filter(Boolean);
  value={...value,operations:value.operations.map((o,index)=>{
   if(!o.type||o.type==='savings')return {...o};
   // Associate explicit instructions with their item, never with every item in a batch.
   const segment=segments.length===1?segments[0]:segments.find(s=>categoryKey(s).includes(categoryKey(o.text)))||(segments.length===value.operations.length?segments[index]:'');
   const explicit=segment?.match(/\b(?:masuk(?:kan)?(?:\s+(?:dalam|dlm))?(?:\s+(?:kategori|ketegori))?|kategori|ketegori)\s+(.+?)\s*[.!?]?$/i);
   const requested=explicit?explicit[1].replace(/[.!?]+$/,'').trim():o.category;
   const matches=requested===null?[]:(ctx.categories[o.type]||[]).filter(c=>categoryKey(c)===categoryKey(requested));
   // An explicit assignment means expense, even if the merchant suggested income.
   if(explicit){const expense=(ctx.categories.expense||[]).filter(c=>categoryKey(c)===categoryKey(requested));return {...o,type:'expense',category:expense.length===1?expense[0]:null};}
   return {...o,category:matches.length===1?matches[0]:null};
  })};
  value.operations.forEach((o,i)=>{const p='$.operations['+i+']';if(o.date!==null&&!core.dateValid(o.date))invalid(p+'.date','YYYY-MM-DD calendar date',o.date);if(o.amount!==null){try{core.cents(o.amount);}catch{invalid(p+'.amount','positive finite amount',o.amount);}}if(o.category!==null&&o.type&&o.type!=='savings'&&!ctx.categories[o.type]?.includes(o.category))invalid(p+'.category','existing category for type',o.category);});
  if(value.query){for(const k of ['start','end'])if(!core.dateValid(value.query[k]))invalid('$.query.'+k,'YYYY-MM-DD calendar date',value.query[k]);}

  if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(k=>!['intent','operations','clarification','query','analysis','receipt'].includes(k)))throw Error('Respons model tidak sah.');
  if(!['record','correct','question','plan','clarify','other'].includes(value.intent)||!Array.isArray(value.operations)||value.operations.length>10||typeof value.clarification!=='string'||value.clarification.length>500)throw Error('Schema respons tidak sah.');
  if(!['record','correct'].includes(value.intent)&&value.operations.length)invalid('$.operations','empty for non-write intent',value.operations);
  if(value.intent==='correct'&&value.operations.length>1)throw Error('Pembetulan mesti satu rekod yang jelas.');
  const allowed=['text','amount','date','type','category','accountAlias','targetId','isBill'];
  const ops=value.operations.map(o=>{
   if(!o||typeof o!=='object'||Array.isArray(o)||Object.keys(o).some(k=>!allowed.includes(k)))throw Error('Operasi tidak dibenarkan.');
   if(typeof o.text!=='string'||!o.text.trim()||o.text.length>500||!['expense','income','savings',null].includes(o.type)||!(o.category===null||typeof o.category==='string')||!(o.amount===null||typeof o.amount==='number')||!(o.date===null||core.dateValid(o.date))||typeof o.isBill!=='boolean')throw Error('Medan operasi tidak sah.');
   if(o.amount!==null)core.cents(o.amount);
   if(o.date&&o.date>ctx.referenceDate)throw Error('Transaksi masa depan tidak direkod sebagai sebenar.');
   if(o.category!==null&&o.type&&o.type!=='savings'&&!ctx.categories[o.type]?.includes(o.category))throw Error('Kategori model bukan kategori aplikasi.');
   if(o.type==='savings'&&o.category!==null&&o.category!=='Simpanan')throw Error('Kategori pindahan tidak sah.');
   if(o.accountAlias!==null&&typeof o.accountAlias!=='string')throw Error('Alias akaun tidak sah.');
   if(o.targetId!==null&&(!Number.isSafeInteger(o.targetId)||!ctx.recent?.some(t=>t.id===o.targetId)))throw Error('Rujukan pembetulan tidak sah.');
   if(value.intent==='record'&&o.targetId!==null)throw Error('Rekod baharu tidak boleh menimpa ID.');
   return {...o};
  });
  if(value.query!==null&&value.query!==undefined){if(value.intent!=='question')throw Error('Query mesti soalan.');const q=value.query;if(typeof q!=='object'||Object.keys(q).some(k=>!['type','category','start','end'].includes(k))||!['expense','income','savings'].includes(q.type)||!core.dateValid(q.start)||!core.dateValid(q.end)||q.start>q.end||q.end>ctx.referenceDate||!(q.category===null||ctx.categories[q.type]?.includes(q.category)))throw Error('Parameter soalan tidak sah.');}
  if(value.analysis!=null){if(value.intent!=='question')invalid('$.analysis','question intent',value.analysis);validateAnalysis(value.analysis,ctx.analysisCategories||ctx.categories);}
  return {intent:value.intent,operations:ops,clarification:value.clarification,query:value.query||null,analysis:value.analysis||null,receipt:value.receipt||null};
 }
 function pendingCategory(message,pending,categories){
  const assignment=String(message).match(/\b(?:masuk(?:kan)?(?:\s+(?:dalam|dlm))?(?:\s+(?:kategori|ketegori))?|kategori|ketegori)\s+(.+?)\s*[.!?]?$/i);
  if(!assignment&&(/[?]/.test(message)||/^(berapa|bila|kenapa|bagaimana|tolong|jumlah|belanja|kalau|jika)\b/i.test(message)||String(message).trim().split(/\s+/).length>4))return null;
  let requested=assignment?assignment[1].replace(/[.!?]+$/,'').trim():message;
  let candidates=pending.filter(p=>p.type&&p.category===null);
  if(assignment){const prefix=String(message).slice(0,assignment.index).trim();if(prefix){const parsed=prefix.match(/^(.+?)\s+rm\s*(\d+(?:\.\d{1,2})?)$/i);if(!parsed)return null;candidates=candidates.filter(p=>categoryKey(p.text)===categoryKey(parsed[1])&&p.amount===Number(parsed[2]));}}
  else if(candidates.length>1)candidates=candidates.slice(0,1);
  if(!candidates.length)return null;
  const op=candidates[0],matches=(categories[op.type]||[]).filter(c=>categoryKey(c)===categoryKey(requested));
  return {op,requested,category:matches.length===1?matches[0]:null,ambiguous:matches.length>1};
 }
 function prepare(op,ctx){
  const missing=[];
  if(op.amount===null)missing.push('Berapa jumlahnya?');
  if(!op.type)missing.push('Ini belanja, pendapatan atau pindahan simpanan?');
  if(!op.category&&op.type!=='savings')missing.push(op.type==='expense'&&op.amount!==null?'RM'+op.amount+' ini untuk kategori mana?':'Kategori mana yang sesuai? '+(ctx.categories[op.type]||[]).join(', '));
  if(!op.date)missing.push('Tarikh transaksi bila?');
  const account=ctx.accounts?.find(a=>a.alias===op.accountAlias);
  if(op.type==='savings'&&!account)missing.push('Akaun simpanan mana? '+(ctx.accounts||[]).map(a=>a.alias).join(', '));
  if(missing.length)return {missing};
  const item={text:op.text,amount:op.amount,date:op.date,type:op.type,category:op.type==='savings'?'Simpanan':op.category,isBill:op.type==='expense'&&op.isBill,isDebtPayment:false,debtId:null,savingsAccountId:account?String(account.id):null};
  core.validateTx(item);return {item,missing:[]};
 }
 function undoState(state,action){
  const s=JSON.parse(JSON.stringify(state));
  if(action.undone)throw Error('Tindakan ini sudah di-Undo.');
  for(const after of action.after){const current=s.transactions.find(t=>t.id===after.id);if(JSON.stringify(current)!==JSON.stringify(after))throw Error('Rekod telah berubah/dipadam. Undo tidak boleh menimpa perubahan lain.');}
  for(const after of action.after){
   const before=action.before.find(t=>t.id===after.id);
   if(after.type==='savings'){const a=s.savings.find(a=>String(a.id)===String(after.savingsAccountId));if(!a||Math.round(a.amount*100)<core.cents(after.amount))throw Error('Baki simpanan telah berubah; Undo tidak selamat.');a.amount=(Math.round(a.amount*100)-core.cents(after.amount))/100;}
   if(before?.type==='savings'){const a=s.savings.find(a=>String(a.id)===String(before.savingsAccountId));if(!a)throw Error('Akaun asal tidak lagi wujud.');a.amount=(Math.round(a.amount*100)+core.cents(before.amount))/100;}
   s.transactions=s.transactions.filter(t=>t.id!==after.id);if(before)s.transactions.push(before);
   s.debts.forEach(d=>{if(Array.isArray(d.payments))d.payments=d.payments.filter(p=>p.txId!==after.id);});
   for(const link of action.beforePayments||[]){const d=s.debts.find(d=>d.id===link.debtId);if(d){d.payments=d.payments||[];d.payments.push(...link.payments.filter(p=>p.txId===after.id));}}
  }
  return s;
 }
 return {receiptSchema,receiptCheck,receiptIssues,schema,analysisSchema,timeSchema,categoryKey,analysisCategories,inspect,validateAnalysis,check,prepare,pendingCategory,undoState};
});
