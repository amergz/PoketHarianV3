/* Chat -> validated auto record -> reply. No demo fallback. */
const chatPanel=document.getElementById('chat-panel');
let chatOpener=null,chatBusy=false;
let session={messages:[],pending:[],request:null};
// Legacy conversation payload only; action/commit journals are intentionally retained.
localStorage.removeItem('poket_chat_session_v2');
localStorage.removeItem('poket_chat_drafts_v1');
let chatStage='idle';
function chatDiagnostic(source,status,requestId,model=null,httpStatus=null,detail=null){const d={source,status,requestId,model,httpStatus,stage:chatStage,detail};window.PoketChatDiagnostic=d;if(localStorage.getItem('poket_debug')==='1')console.debug('PoketChat',d);}
function persistChat(){/* Page-memory session only. Financial commits persist separately. */}
function categoryBudgets(){return JSON.parse(localStorage.getItem('poket_category_budgets_v1')||'[]');}
const deferredBudgets=new Set();
let budgetQueue=[],budgetAwaiting=null;
const budgetKey=r=>JSON.stringify([r.type,r.category,r.range.start,r.range.end]);
function queueBudgetQuestions(snapshot){for(const row of snapshot.rows.filter(r=>r.type==='expense'&&r.budget===null)){const key=budgetKey(row);if(!deferredBudgets.has(key)&&!budgetQueue.some(r=>budgetKey(r)===key)&&(!budgetAwaiting||budgetKey(budgetAwaiting)!==key))budgetQueue.push(row);}nextBudgetQuestion();}
function nextBudgetQuestion(){if(budgetAwaiting||!budgetQueue.length)return;budgetAwaiting=budgetQueue.shift();const r=budgetAwaiting;session.messages.push({role:'assistant',content:`Bajet kategori ${r.category} belum ditetapkan. Nak tetapkan berapa untuk ${r.range.start} hingga ${r.range.end}?`,budgetQuestion:r});}
function proposeAwaitingBudget(message){if(!budgetAwaiting||session.pending.length)return false;const match=message.trim().match(/^(?:RM\s*)?(\d+(?:\.\d{1,2})?)$/i);if(!match)return false;const amount=Math.round(Number(match[1])*100);if(!Number.isSafeInteger(amount)||amount<0)return false;const r=budgetAwaiting;for(const m of session.messages)if(m.budgetQuestion===r)m.budgetQuestionResolved=true;budgetAwaiting=null;session.messages.push({role:'user',content:message},{role:'assistant',content:`Tetapkan bajet ${r.category} ${PoketAnalysis.money(amount)} untuk ${r.range.start} hingga ${r.range.end}?`,budgetProposal:{type:r.type,category:r.category,mode:r.mode,start:r.range.start,end:r.range.end,amount},afterSaveBudget:r});return true;}
function renderPostSave(host,snapshot){
 const add=(tag,text,parent=host)=>{const e=document.createElement(tag);e.textContent=text;parent.append(e);return e;};
 const cash=(parent,n)=>{const cell=add('td','',parent);if(n===null){cell.textContent='\u2014';return;}add('span','RM',cell).className='chat-money-unit';add('span',PoketAnalysis.money(n).replace(/^RM\s*/,''),cell).className='chat-money-digits';};
 for(const group of [{type:'expense',source:'manual'},{type:'expense',source:'forecast'},{type:'income'},{type:'savings'}]){const type=group.type;const groupRows=snapshot.rows.filter(r=>r.type===type&&(!group.source||(r.source||'manual')===group.source));const missing=groupRows.filter(r=>type==='expense'&&r.budget===null);for(const r of missing)add('p',`${r.category}: belanja terkumpul ${PoketAnalysis.money(r.spent)} (${r.range.start} hingga ${r.range.end}). Bajet kategori belum ditetapkan.`);const rows=groupRows.filter(r=>!(type==='expense'&&r.budget===null));if(!rows.length)continue;
  add('h4',type==='expense'?'Belanja kategori':type==='income'?'Pendapatan kategori (bukan keuntungan)':'Pindahan simpanan');
  const seenPeriods=new Set();for(const r of rows){const key=r.mode+r.range.start+r.range.end;if(seenPeriods.has(key))continue;seenPeriods.add(key);const today=PoketCore.malaysiaDate(),days=Math.round((Date.parse(r.range.end)-Date.parse(r.range.start))/86400000)+1,elapsed=Math.min(days,Math.max(1,Math.round((Date.parse(today)-Date.parse(r.range.start))/86400000)+1));const fmt=(d,options)=>new Intl.DateTimeFormat('ms-MY',{...options,timeZone:'UTC'}).format(new Date(d+'T00:00:00Z'));const label=r.mode==='month'?fmt(r.range.start,{month:'long',year:'numeric'}):'Kitaran gaji '+fmt(r.range.start,{day:'numeric',month:'short'})+'\u2013'+fmt(r.range.end,{day:'numeric',month:'short'});add('p',label+' \u00b7 Hari ke-'+elapsed+'/'+days+(today>r.range.end?' (tamat)':today<r.range.start?' (belum bermula)':''));}
  const wrap=document.createElement('div');wrap.className='chat-post-scroll';host.append(wrap);
  const table=document.createElement('table');table.className='chat-analysis-table chat-post-table';wrap.append(table);
  const cols=document.createElement('colgroup');table.append(cols);for(const width of type==='savings'?[50,50]:[26,19,19,21,15]){const col=document.createElement('col');col.style.width=width+'%';cols.append(col);}
  const head=document.createElement('thead');table.append(head);const tr=document.createElement('tr');head.append(tr);
  const labels=type==='expense'?['Kategori','Belanja',group.source==='forecast'?'Ramalan':'Bajet',group.source==='forecast'?'Baki anggaran':'Baki','Terpakai %']:type==='income'?['Kategori','Pendapatan','Sasaran','Baki sasaran','Dicapai %']:['Kategori','Pindahan'];
  for(const label of labels)add('th',label,tr).setAttribute('scope','col');const body=document.createElement('tbody');table.append(body);
  for(const r of rows){const row=document.createElement('tr');body.append(row);add('th',r.category,row).setAttribute('scope','row');cash(row,r.spent);
   if(type!=='savings'){cash(row,r.budget);cash(row,r.remaining);add('td',r.percent===null?'\u2014':r.percent.toFixed(1)+'%',row);}
  }

  for(const r of rows){
   let status='';if(type==='expense'){if(r.remaining<0)status=(r.source==='forecast'?'Melebihi anggaran ':'Melebihi bajet ')+PoketAnalysis.money(-r.remaining)+'.';else if(r.budget===0)status='Rujukan RM0.00; peratus tidak tersedia.';else if(r.percent>=80)status='Hampir/mencapai had '+(r.source==='forecast'?'anggaran.':'bajet.');else status=(r.source==='forecast'?'Baki anggaran ':'Baki bajet '+r.category+' ')+PoketAnalysis.money(r.remaining)+'.';}
   else if(type==='income'&&r.remaining!==null)status=r.remaining<0?'Melebihi sasaran '+PoketAnalysis.money(-r.remaining)+'.':'Baki sasaran '+PoketAnalysis.money(r.remaining)+'.';
   if(status)add('p',(rows.length>1?r.category+': ':'')+status);
   if(type==='expense')add('small',r.source==='forecast'?(r.basis.length===3?'Anggaran bajet berdasarkan purata 3 bulan lepas.':'Anggaran bajet berdasarkan '+r.basis.length+' bulan berdata.'):'Bajet yang anda tetapkan.');
   const details=document.createElement('details');add('summary','Cara kira',details);add('small',r.source==='forecast'?'Bulan digunakan: '+r.basis.join(', ')+'. Jumlah kategori dibahagi bilangan bulan berdata; bulan kosong keseluruhan dikecualikan. Ini anggaran, bukan bajet ditetapkan.':'Bajet manual untuk '+r.range.start+' hingga '+r.range.end+'.',details);add('small','Baki = rujukan tolak belanja. Terpakai = belanja / rujukan \u00d7 100%; peratus tidak tersedia jika rujukan sifar.',details);host.append(details);
  }

 }
 if(snapshot.changed)add('small','Snapshot ini telah dibetulkan/dibatalkan kemudian; lihat ringkasan terkini.');
}

function showManualSummary(items){let host=document.getElementById('manual-category-summary');if(!host){host=document.createElement('aside');host.id='manual-category-summary';host.setAttribute('aria-live','polite');document.getElementById('app-shell').append(host);}host.replaceChildren();const close=document.createElement('button');close.type='button';close.textContent='Tutup ringkasan';close.addEventListener('click',()=>{host.hidden=true;});host.append(close);renderPostSave(host,PoketAnalysis.postSave(transactions,items,appPlan,categoryBudgets()));host.hidden=false;}
function markSnapshots(ids){for(const m of session.messages)if(m.postSave?.ids.some(id=>ids.includes(id)))m.postSave.changed=true;}
function chatStatus(text,error=false){const e=document.getElementById('chat-status');e.textContent=text;e.setAttribute('role',error?'alert':'status');e.hidden=!text;}
function updateComposer(){const input=document.getElementById('chat-message'),button=document.getElementById('chat-generate');button.disabled=chatBusy||!!session.request||(!input.value.trim()&&!(typeof receiptImage!=='undefined'&&receiptImage));button.setAttribute('aria-busy',String(chatBusy));button.querySelector('span').textContent=chatBusy?'…':'↑';input.style.height='auto';input.style.height=Math.min(input.scrollHeight,160)+'px';input.style.overflowY=input.scrollHeight>160?'auto':'hidden';}

function budgetAnswer(message){
 if(!/bajet|boleh belanja sehari|kalau belanja/i.test(message)||/^tetapkan/i.test(message))return false;
 const f=calculateFinance(),money=n=>PoketAnalysis.money(Math.round(n*100));const simulation=message.match(/^kalau belanja\s+RM\s*(\d+(?:\.\d{1,2})?)/i);
 const rows=[['Peruntukan asas',money(appPlan.monthlyBudget)],['Carry Forward',money(f.surplus)],['Pendapatan direkod dalam kitaran',money(f.totalFunds-appPlan.monthlyBudget-f.surplus)],['Belanja dan pindahan simpanan',money(f.currentSpent)],['Baki bajet aplikasi',money(f.remaining)],['Baki hari (termasuk hari ini)',String(f.daysRem)],['Had harian Home sebelum belanja hari ini',money(f.limit)],['Baki purata sehari selepas belanja direkod',money(Math.max(0,f.remaining)/Math.max(1,f.daysRem))]];
 const forecastNow=getForecastCategoryAverages();rows.push(['Ramalan keseluruhan (bulan kalendar, bukan tambahan dana)',money(forecastNow.totalAvg)]);
 if(simulation)rows.push(['Simulasi sahaja: baki selepas '+money(Number(simulation[1])),money(f.remaining-Number(simulation[1]))]);
 if(/kategori.*melebihi/i.test(message)){const today=PoketCore.malaysiaDate();for(const b of categoryBudgets().filter(b=>b.type==='expense'&&today>=b.start&&today<=b.end)){const spent=PoketAnalysis.aggregate(transactions,b,b.category).expense;if(spent>b.amount)rows.push(['Lebih bajet '+b.category,PoketAnalysis.money(spent-b.amount)]);}}
 session.messages.push({role:'assistant',content:(simulation?'Simulasi ? tiada transaksi disimpan. ':'')+(appPlan.monthlyBudget===0?'Peruntukan asas RM0. Adakah bajet belum ditetapkan atau memang sifar? ':'')+'Baki ini bajet aplikasi, bukan baki bank. Formula Home menambah semua pendapatan direkod kepada peruntukan; semak gaji jika peruntukan anda sudah mewakilinya. Bil belum direkod tidak ditolak; bil direkod termasuk sekali sahaja. Kekurangan: '+(f.remaining<0?money(-f.remaining):'tiada berdasarkan rekod')+'.',budgetView:{range:getLocalYYYYMMDD(f.cycleStart)+' hingga '+getLocalYYYYMMDD(f.cycleEnd),rows}});session.request=null;renderChat();return true;
}
async function completePending(category,type=null){
 if(chatBusy||session.request||!session.pending.length)return;
 const index=session.pending.findIndex(o=>type?!o.type:o.type&&o.category===null);if(index<0)return;
 const op={...session.pending[index]};if(type){op.type=type;op.category=type==='savings'?'Simpanan':null;}else{if(!currentCategories()[op.type]?.includes(category))return;op.category=category;}
 const remaining=session.pending.filter((_,i)=>i!==index);const payload=contextPayload(category||type,crypto.randomUUID());payload.pending=[];
 chatBusy=true;renderChat();try{await performResponse({schemaVersion:2,provider:'DeepSeek',requestId:payload.requestId,result:{intent:'record',operations:[op],clarification:'',query:null}},payload);session.pending.push(...remaining);if(remaining.length&&!session.messages.at(-1).pending)session.messages.push({role:'assistant',content:'Masih menunggu maklumat transaksi lain.',pending:true});renderChat();}catch(e){session.pending=remaining;session.pending.splice(index,0,op);chatStatus(e.message,true);}finally{chatBusy=false;renderChat();}
}
function renderBudget(host,view){const p=document.createElement('p');p.textContent=view.range;host.append(p);const table=document.createElement('table');table.className='chat-analysis-table';host.append(table);for(const row of [['Perkara','Jumlah'],...view.rows]){const tr=document.createElement('tr');table.append(tr);for(const [i,text] of row.entries()){const cell=document.createElement(i?'td':'th');cell.textContent=text;tr.append(cell);}}}
function cancelPending(){if(chatBusy||!session.pending.length)return;session.pending=[];session.contextStart=session.messages.length;session.messages.push({role:'assistant',content:'Baik, transaksi itu dibatalkan.'});persistChat();renderChat();}
function openChat(event){chatOpener=event?.currentTarget||document.getElementById('open-chat');chatPanel.hidden=false;document.getElementById('close-chat').textContent=chatOpener.id==='floating-chat-btn'?'Kembali ke Home':'Kembali ke Profil';renderChat();document.getElementById('chat-message').focus();refreshAIStatus();}
function closeChat(){chatPanel.hidden=true;(chatOpener||document.getElementById('open-chat')).focus();}
for(const id of ['open-chat','floating-chat-btn'])document.getElementById(id).addEventListener('click',openChat);
document.getElementById('close-chat').addEventListener('click',closeChat);
async function refreshAIStatus(){try{const r=await fetch('/api/ai/status',{cache:'no-store'});if(!r.ok)throw Error();const s=await r.json();document.getElementById('ai-connection-label').textContent=s.connected?'DeepSeek aktif':s.configured?'DeepSeek dikonfigurasi — belum disahkan':'AI belum disambungkan';}catch{document.getElementById('ai-connection-label').textContent='AI belum disambungkan — backend tidak tersedia';}}
function renderAnalysis(bubble,view){
 const add=(tag,text,parent=bubble)=>{const el=document.createElement(tag);el.textContent=text;parent.append(el);return el;};
 bubble.className+=' chat-analysis';add('h3',view.title);add('p',view.range.start+' hingga '+view.range.end);
 const table=document.createElement('table');table.className='chat-analysis-table';bubble.append(table);
 const caption=add('caption','Belanja berdasarkan rekod',table);caption.className='sr-only';
 const head=document.createElement('thead');table.append(head);const hr=document.createElement('tr');head.append(hr);for(const label of [view.monthly?'Bulan':'Kategori','Jumlah belanja'])add('th',label,hr).setAttribute('scope','col');
 const body=document.createElement('tbody');table.append(body);for(const row of view.rows){const tr=document.createElement('tr');body.append(tr);add('th',row.category,tr).setAttribute('scope','row');add('td',PoketAnalysis.money(row.amount),tr);}
 const foot=document.createElement('tfoot');table.append(foot);const total=document.createElement('tr');foot.append(total);add('th',view.totalLabel||'Jumlah belanja',total).setAttribute('scope','row');add('td',PoketAnalysis.money(view.total),total);
 if(view.summary)add('p',view.summary);
 const list=document.createElement('ul');bubble.append(list);for(const text of view.observations.slice(0,3))add('li',text,list);
 if(view.transactions?.length){add('h4','Transaksi terbesar (maksimum 5)');for(const t of view.transactions)add('p',`${t.date}: ${t.text} — ${PoketAnalysis.money(t.amount)}`);}
 add('small',view.note);
 const controls=document.createElement('div');controls.className='chat-analysis-followups';bubble.append(controls);
 for(const [text,largest] of [['Banding bulan lepas',false],['Lihat transaksi terbesar',true]]){const button=add('button',text,controls);button.type='button';button.disabled=chatBusy||!!session.request;button.addEventListener('click',()=>{
  if(chatBusy||session.request)return;
  try{const last={q:view.query,range:view.range};const query={...view.query,op:'compare',period:'followup_previous'};
   // Resolve against this bubble's period, including when an older answer is selected.
   const resolved=largest?last:{q:query,range:view.range};
   const report={...PoketAnalysis.run(transactions,appPlan,query,{today:PoketCore.malaysiaDate(),categories:currentCategories(),last:resolved})};
   if(largest){const exact={...view.query,period:'month',month:view.range.start.slice(0,7)};Object.assign(report,{q:exact,range:view.range,current:PoketAnalysis.aggregate(transactions,view.range,view.query.category)});}
   session.messages.push({role:'user',content:text+' ('+view.range.start+' hingga '+view.range.end+')'});appendAnalysis(report,largest);persistChat();renderChat();
  }catch(e){chatStatus('Analisis gagal: '+e.message,true);}
 });}
}
function appendAnalysis(report,largest=false){session.lastAnalysis={q:report.q,range:report.range};session.messages.push({role:'assistant',content:'Ringkasan angka tempatan (dikira aplikasi):\n'+PoketAnalysis.format(report),analysis:PoketAnalysis.presentation(report,transactions,{largest})});}
function renderChat(){
 const host=document.getElementById('chat-messages');const oldTop=host.scrollTop||0;const follow=(host.scrollHeight-(host.clientHeight||0)-oldTop)<64;host.replaceChildren();
 if(!session.messages.length){for(const text of ['Belanja bulan ini','Kategori terbesar','Laporan bulanan']){const b=document.createElement('button');b.type='button';b.textContent=text;b.addEventListener('click',()=>{document.getElementById('chat-message').value=text;updateComposer();document.getElementById('chat-form').requestSubmit();});host.append(b);}}
 const actions=JSON.parse(localStorage.getItem('poket_chat_actions_v2')||'{}');
 const pendingIndex=session.messages.findLastIndex(m=>m.role==='assistant'&&m.pending);
 for(const [index,m] of session.messages.entries()){const bubble=document.createElement('div');bubble.className='chat-bubble '+(m.role==='user'?'chat-user':'chat-assistant');if(m.analysis?.version===1)renderAnalysis(bubble,m.analysis);else{const p=document.createElement('p');p.textContent=m.content;bubble.append(p);}
  if(index===pendingIndex&&session.pending.length&&!chatBusy&&!session.request){const op=session.pending.find(o=>!o.type||o.category===null);if(op){const options=op.type?(currentCategories()[op.type]||[]):['expense','income','savings'];let expanded=false;const draw=()=>{for(const value of options.slice(0,expanded?options.length:6)){const choice=document.createElement('button');choice.type='button';choice.textContent=op.type?value:({expense:'Perbelanjaan',income:'Duit masuk',savings:'Pindahan simpanan'}[value]);choice.addEventListener('click',()=>completePending(op.type?value:null,op.type?null:value));bubble.append(choice);}};draw();if(options.length>6){const more=document.createElement('button');more.textContent='Lihat semua';more.addEventListener('click',()=>{expanded=true;more.hidden=true;draw();});bubble.append(more);}}const b=document.createElement('button');b.type='button';b.textContent='Batal';b.className='chat-cancel-pending';b.addEventListener('click',cancelPending);bubble.append(b);}
  if(m.action&&actions[m.action]&&!actions[m.action].undone){const b=document.createElement('button');b.type='button';b.textContent='Undo';b.addEventListener('click',async()=>{b.disabled=true;try{await undoChat(m.action);m.content+=' (Sudah di-Undo.)';persistChat();renderChat();}catch(e){chatStatus(e.message,true);b.disabled=false;}});bubble.append(b);}
  if(typeof renderReceiptControls==='function')renderReceiptControls(bubble,m);
  if(m.budgetView)renderBudget(bubble,m.budgetView);
  if(m.postSave)renderPostSave(bubble,m.postSave);
  if(m.budgetQuestion&&!m.budgetQuestionResolved){for(const later of [false,true]){const b=document.createElement('button');b.type='button';b.textContent=later?'Nanti':'Tetapkan bajet';b.addEventListener('click',()=>{if(chatBusy||session.request)return;if(later){deferredBudgets.add(budgetKey(m.budgetQuestion));m.budgetQuestionResolved=true;if(budgetAwaiting===m.budgetQuestion)budgetAwaiting=null;nextBudgetQuestion();renderChat();}else{budgetAwaiting=m.budgetQuestion;document.getElementById('chat-message').focus();chatStatus('Taip jumlah bajet, contoh RM500.');}});bubble.append(b);}}
  if(m.budgetProposal&&!m.budgetResolved){for(const accept of [true,false]){const b=document.createElement('button');b.type='button';b.textContent=accept?'Sahkan':'Batal';b.addEventListener('click',async()=>{if(chatBusy||session.request)return;try{if(accept){await navigator.locks.request('poket-finance-write',()=>{const proposal=m.budgetProposal;if(m.afterSaveBudget&&categoryBudgets().some(x=>x.type===proposal.type&&x.category===proposal.category&&x.start<=proposal.end&&x.end>=proposal.start))throw Error('Bajet sudah tersedia; tidak ditimpa.');const list=categoryBudgets().filter(x=>!(x.type===proposal.type&&x.category===proposal.category&&x.start<=proposal.end&&x.end>=proposal.start));list.push(proposal);PoketCore.write(localStorage,{poket_category_budgets_v1:JSON.stringify(list)});});}m.budgetResolved=true;if(m.afterSaveBudget&&accept){const r=m.afterSaveBudget;const relevant=transactions.filter(t=>t.type===r.type&&t.category===r.category&&t.date>=r.range.start&&t.date<=r.range.end);session.messages.push({role:'assistant',content:'Bajet kategori disimpan.',postSave:PoketAnalysis.postSave(transactions,relevant.length?relevant:[{type:r.type,category:r.category,date:r.range.start}],appPlan,categoryBudgets())});}nextBudgetQuestion();session.messages.push({role:'assistant',content:accept?'Tetapan kategori disimpan. Bajet keseluruhan tidak berubah.':'Tetapan dibatalkan.'});persistChat();renderChat();}catch(e){chatStatus(e.message,true);}});bubble.append(b);}}
  host.append(bubble);
 }
 document.getElementById('chat-retry').hidden=!session.request||chatBusy;
 document.getElementById('chat-cancel-request').hidden=!session.request||chatBusy;
 updateComposer();host.scrollTop=follow?host.scrollHeight:oldTop;
}
function contextPayload(message,id){
 const actions=JSON.parse(localStorage.getItem('poket_chat_actions_v2')||'{}');
 const recent=Object.values(actions).filter(a=>!a.undone).flatMap(a=>a.after).slice(-10).map(t=>transactions.find(x=>x.id===t.id)).filter(Boolean).map(({id,text,amount,type,category,date})=>({id,text,amount,type,category,date}));
 return {schemaVersion:2,requestId:id,message,referenceDate:PoketCore.malaysiaDate(),timeZone:'Asia/Kuala_Lumpur',categories:currentCategories(),analysisCategories:PoketChat.analysisCategories(currentCategories(),transactions),accounts:savingsAccounts.map((a,i)=>({alias:'Akaun '+(i+1),id:a.id})),recent,context:session.messages.slice(session.contextStart||0).slice(-6).map(m=>({role:m.role,content:m.content.slice(0,500)})),pending:session.pending,analysisContext:session.lastAnalysis?.range?session.lastAnalysis:null};
}
function summary(items){const t=PoketCore.totals(items);const parts=[];if(t.expense)parts.push('belanja RM'+t.expense.toFixed(2));if(t.income)parts.push('pendapatan RM'+t.income.toFixed(2));if(t.savings)parts.push('pindahan simpanan RM'+t.savings.toFixed(2));return parts.join(', ')+'. '+items.map(t=>t.category+' RM'+t.amount.toFixed(2)+' ('+t.date+')').join('; ');}
async function performResponse(response,payload){
 if(response.schemaVersion!==2||response.requestId!==payload.requestId||response.provider!=='DeepSeek')throw Error('Respons sambungan tidak sah.');
 const result=PoketChat.check(response.result,payload),items=[],pending=[];
 if(payload.image&&!result.receipt)throw Error('Bacaan resit tidak lengkap. Tiada transaksi disimpan; cuba gambar yang lebih jelas.');
 if(result.receipt){await receiveReceipt(result.receipt,payload);session.request=null;delete session.response;renderChat();return;}
 if(PoketAnalysis.localQuery(payload.message,payload.referenceDate,session.lastAnalysis,currentCategories())&&result.operations.length)throw Error('Soalan tidak dibenarkan menulis transaksi.');
 for(const op of result.operations){const prepared=PoketChat.prepare(op,payload);if(prepared.missing.length)pending.push({...op,question:prepared.missing.join(' ')});else if(result.intent==='correct'&&!op.targetId)pending.push({...op,question:'Rekod yang mana? Nyatakan keterangan atau ID daripada balasan tadi.'});else items.push({item:prepared.item,target:op.targetId});}
 let action=null,reply='',analysis=null,postSave=null;
 if(items.length){
  action=payload.requestId;
  await commitTransactions(items.map(x=>x.item),{key:action,editId:result.intent==='correct'?items[0].target:null,chatAction:true});
  const stored=transactions.filter(t=>JSON.parse(localStorage.getItem('poket_chat_actions_v2')||'{}')[action].after.some(x=>x.id===t.id));
  if(result.intent==='correct')markSnapshots(items.map(x=>x.target));
  postSave=PoketAnalysis.postSave(transactions,[...stored,...JSON.parse(localStorage.getItem('poket_chat_actions_v2')||'{}')[action].before],appPlan,categoryBudgets());
  reply=(result.intent==='correct'?'Dibetulkan \u2705 ':'Direkod \u2705 ')+stored.map(t=>`${t.text} RM${t.amount.toFixed(2)} \u2014 kategori ${t.category}, ${t.date}.`).join('; ');
 }
 if(pending.length)reply+=(reply?'\n':'')+'Belum direkod: '+pending.map(x=>x.text+': '+x.question).join('\n');
 if(!items.length&&!pending.length){
  if(result.intent==='question'&&result.analysis){const report=(chatStage='frontend.analysis',PoketAnalysis.run(transactions,appPlan,result.analysis,{today:PoketCore.malaysiaDate(),categories:PoketChat.analysisCategories(currentCategories(),transactions),last:session.lastAnalysis}));chatStage='frontend.presentation';session.lastAnalysis={q:report.q,range:report.range};analysis=PoketAnalysis.presentation(report,transactions);reply='Ringkasan angka aplikasi (pertanyaan difahami DeepSeek):\n'+PoketAnalysis.format(report);}
  else if(result.intent==='question'&&result.query){const q=result.query;const list=transactions.filter(t=>t.type===q.type&&(!q.category||t.category===q.category)&&t.date>=q.start&&t.date<=q.end);const n=list.reduce((s,t)=>s+PoketCore.cents(t.amount),0);reply='Berdasarkan '+list.length+' rekod ('+q.start+' hingga '+q.end+'): RM'+(n/100).toFixed(2)+'.';}
  else reply=result.intent==='question'?((result.clarification?result.clarification+' Pilihan: '+(payload.analysisCategories?.expense||payload.categories.expense).slice(0,12).join(', '):'')||'Pertanyaan belum dapat dipetakan kepada analisis yang disokong. Nyatakan kategori dan tempoh; tiada transaksi diubah.'):result.intent==='plan'?'Ini rancangan; tiada transaksi direkod.':result.clarification||'Tiada transaksi direkod. Nyatakan transaksi yang telah berlaku.';
 }
 session.pending=pending.length?pending.map(({question,...op})=>op):(['question','plan','other'].includes(result.intent)?session.pending:[]);session.messages.push({role:'assistant',content:reply,analysis,postSave,action,pending:pending.length>0});session.request=null;delete session.response;if(postSave)queueBudgetQuestions(postSave);persistChat();chatStage='frontend.renderer';renderChat();chatStage='completed';refreshAIStatus();
}
async function sendRequest(){
 if(chatBusy||!session.request)return;
 if(typeof globalThis.PoketAnalysis==='undefined'){chatStatus('Analisis belum dimuatkan. Restart server dan buka semula aplikasi. Tiada transaksi disimpan.',true);return;}
 try{
  if(budgetAnswer(session.request.message))return;
  const proposal=PoketAnalysis.budgetCommand(session.request.message,currentCategories(),transactions,appPlan);
  if(proposal){chatDiagnostic('local-budget','confirmation',session.request.requestId);for(const old of session.messages)if(old.budgetProposal&&!old.budgetResolved)old.budgetResolved=true;session.messages.push({role:'assistant',content:`${proposal.type==='expense'?'Bajet':'Sasaran pendapatan'} ${proposal.category}: ${PoketAnalysis.money(proposal.amount)}, ${proposal.start} hingga ${proposal.end}. Sahkan sebelum diterapkan.`,budgetProposal:proposal});session.request=null;persistChat();renderChat();return;}
  if(/^(tetapkan|kalau|jika|contoh|mungkin).*?(bajet|sasaran pendapatan)/i.test(session.request.message)){session.messages.push({role:'assistant',content:'Untuk menetapkan kategori, taip: Tetapkan bajet [kategori] RM300 untuk kitaran gaji ini. Atau: Tetapkan sasaran pendapatan [kategori] RM300 untuk bulan ini. Tetapan memerlukan pengesahan.'});session.request=null;persistChat();renderChat();return;}

 }catch(e){chatStatus('Analisis gagal: '+e.message+' Tiada transaksi disimpan.',true);return;}
 chatBusy=true;renderChat();chatStatus('Sedang memproses…');
 try{
  const payload=session.request;chatDiagnostic('DeepSeek','requesting',payload.requestId);
  // Recover a completed commit after refresh without another provider call or duplicate write.
  const actions=JSON.parse(localStorage.getItem('poket_chat_actions_v2')||'{}');
  if(session.response)await performResponse(session.response,payload);
  else if(actions[payload.requestId]){session.messages.push({role:'assistant',content:'Tindakan telah disimpan sebelum ini. '+summary(actions[payload.requestId].after),postSave:PoketAnalysis.postSave(transactions,actions[payload.requestId].after,appPlan,categoryBudgets()),action:payload.requestId});session.request=null;persistChat();renderChat();}
  else{chatStage='frontend.send';const r=await fetch('/api/ai/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),cache:'no-store',signal:AbortSignal.timeout(45000)});chatStage='frontend.envelope';const data=await r.json();chatDiagnostic('DeepSeek',r.ok?'received':'failed',payload.requestId,data.model||data.diagnostic?.model,r.status);if(!r.ok){const error=Error(data.error||'Sambungan AI gagal.');error.analysisFailure=data.diagnostic?.errorCode==='SCHEMA';error.safeDiagnostic=data.diagnostic;chatStage=data.diagnostic?.boundary||'backend.http';throw error;}chatStage='frontend.contract';PoketChat.check(data.result,payload);session.response=data;persistChat();await performResponse(data,payload);}
  chatStatus('');
 }catch(e){if(session.request?.image){delete session.request.image;if(typeof clearReceiptImage==='function')clearReceiptImage();session.request=null;delete session.response;}chatDiagnostic('DeepSeek','failed',session.request?.requestId,null,e.safeDiagnostic?.httpStatus,{validation:e.safeDiagnostic?.validation||e.validation||null,boundary:e.safeDiagnostic?.boundary||chatStage});chatStatus(e.analysisFailure||e.validation?'Analisis belum berjaya diproses. Tiada rekod diubah.':(e.name==='TimeoutError'?'Sambungan tamat masa.':e.message)+' Respons belum dapat diproses. Tiada kejayaan simpan baharu disahkan. Cuba semula atau tutup permintaan ini.',true);renderChat();}
 finally{chatBusy=false;renderChat();}
}
document.getElementById('chat-form').addEventListener('submit',e=>{e.preventDefault();if(chatBusy)return;if(session.request){chatStatus('Selesaikan Cuba semula atau batalkan permintaan gagal dahulu.',true);return;}const message=document.getElementById('chat-message').value.trim()||(typeof receiptImage!=='undefined'&&receiptImage?'Baca resit ini.':'');if(!message)return;if(typeof receiptCorrection==='function'&&!receiptImage&&receiptCorrection(message)){document.getElementById('chat-message').value='';return;}if(proposeAwaitingBudget(message)){document.getElementById('chat-message').value='';renderChat();return;}if(budgetAwaiting){for(const m of session.messages)if(m.budgetQuestion===budgetAwaiting)m.budgetQuestionResolved=true;budgetAwaiting=null;}const pendingOp=session.pending.find(o=>o.type&&o.category===null);if(pendingOp){const match=currentCategories()[pendingOp.type]?.find(c=>PoketChat.categoryKey(c)===PoketChat.categoryKey(message));if(match){document.getElementById('chat-message').value='';completePending(match);return;}}session.request=contextPayload(message,crypto.randomUUID());if(typeof receiptImage!=='undefined'&&receiptImage)session.request.image=receiptImage;session.messages.push({role:'user',content:message});persistChat();document.getElementById('chat-message').value='';renderChat();sendRequest();});
document.getElementById('chat-retry').addEventListener('click',sendRequest);
document.getElementById('chat-cancel-request').addEventListener('click',()=>{if(chatBusy)return;session.request=null;delete session.response;if(typeof clearReceiptImage==='function')clearReceiptImage();persistChat();renderChat();chatStatus('Permintaan gagal ditutup. Rekod yang sudah disimpan kekal.');});
document.getElementById('chat-message').addEventListener('input',updateComposer);
document.getElementById('chat-message').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing){e.preventDefault();if(!document.getElementById('chat-generate').disabled)document.getElementById('chat-form').requestSubmit();}});
function fitChatViewport(){if(!window.visualViewport)return;chatPanel.style.top=window.visualViewport.offsetTop+'px';chatPanel.style.height=window.visualViewport.height+'px';}
window.visualViewport?.addEventListener('resize',fitChatViewport);window.visualViewport?.addEventListener('scroll',fitChatViewport);fitChatViewport();updateComposer();
async function undoChat(id){
 if(staleTab)throw Error('Data berubah pada tab lain; muat semula dahulu.');
 if(!navigator.locks)throw Error('Pelayar memerlukan Web Locks.');
 return navigator.locks.request('poket-finance-write',()=>{
  if(financialKeys.some((k,i)=>localStorage.getItem(k)!==observedFinance[i]))throw Error('Data berubah; muat semula dahulu.');
  const actions=JSON.parse(localStorage.getItem('poket_chat_actions_v2')||'{}');const action=actions[id];if(!action)throw Error('Tindakan tidak ditemui.');
  const s=PoketChat.undoState({transactions,savings:savingsAccounts,debts,dismissed:dismissedBillNames,history:savingsHistory},action);actions[id].undone=true;
  const total=s.savings.reduce((n,a)=>n+Math.round(a.amount*100),0)/100;const date=getLocalYYYYMMDD();const h=s.history.find(x=>x.date===date);if(h)h.total=total;else s.history.push({date,total});
  PoketCore.write(localStorage,{poket_tx:JSON.stringify(s.transactions),poket_savings:JSON.stringify(s.savings),poket_debts:JSON.stringify(s.debts),poket_savings_history:JSON.stringify(s.history),poket_chat_actions_v2:JSON.stringify(actions)});adoptFinance(s);markSnapshots(action.after.map(t=>t.id));session.messages.push({role:'assistant',content:'Undo selesai. Ringkasan selepas pembatalan:',postSave:PoketAnalysis.postSave(transactions,[...action.after,...action.before],appPlan,categoryBudgets())});persistChat();observedFinance=financialKeys.map(k=>localStorage.getItem(k));renderSavingsAccounts();refreshData();
 });
}
