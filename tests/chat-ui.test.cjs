const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('fs'),vm=require('vm');
const source=fs.readFileSync('js/chat-auto.js','utf8');
function fn(name){const start=source.indexOf('function '+name+'(');let depth=0,begin=source.indexOf('{',start);for(let i=begin;i<source.length;i++){if(source[i]==='{')depth++;if(source[i]==='}'&&--depth===0)return source.slice(start,i+1);}}
test('composer mock: whitespace/busy/request disabled, growth capped, processing indicator',()=>{
 const input={value:'',style:{},scrollHeight:250},span={textContent:''},button={setAttribute(k,v){this[k]=v},querySelector(){return span}};
 const c=vm.createContext({document:{getElementById:id=>id==='chat-message'?input:button},chatBusy:false,session:{request:null}});vm.runInContext(fn('updateComposer'),c);
 vm.runInContext('updateComposer()',c);assert.equal(button.disabled,true);input.value='  ';vm.runInContext('updateComposer()',c);assert.equal(button.disabled,true);
 input.value='Makan RM12';vm.runInContext('updateComposer()',c);assert.equal(button.disabled,false);assert.equal(input.style.height,'160px');assert.equal(input.style.overflowY,'auto');
 c.chatBusy=true;vm.runInContext('updateComposer()',c);assert.equal(button.disabled,true);assert.equal(span.textContent,'…');c.chatBusy=false;c.session.request={};vm.runInContext('updateComposer()',c);assert.equal(button.disabled,true);
});
test('cancel clarification clears pending context only, preserves saved actions and history',()=>{
 const session={pending:[{text:'Makan',amount:null}],messages:[{role:'user',content:'makan'},{role:'assistant',content:'Berapa jumlahnya?',pending:true}]};let persisted=false,rendered=false;
 const c=vm.createContext({session,chatBusy:false,persistChat(){persisted=true},renderChat(){rendered=true}});vm.runInContext(fn('cancelPending'),c);vm.runInContext('cancelPending()',c);
 assert.equal(session.pending.length,0);assert.equal(session.contextStart,2);assert.equal(session.messages.at(-1).content,'Baik, transaksi itu dibatalkan.');assert.ok(persisted&&rendered);assert.equal(session.messages[0].content,'makan');
 vm.runInContext('cancelPending()',c);assert.equal(session.messages.length,3);
});
test('keyboard mock: Enter submits, Shift+Enter/composition preserve newlines, disabled blocks',()=>{
 const listeners={};let sent=0,prevented=0;const button={disabled:false};const input={addEventListener:(k,f)=>listeners[k]=f};const form={requestSubmit(){sent++}};
 const c=vm.createContext({document:{getElementById:id=>id==='chat-message'?input:id==='chat-generate'?button:form}});
 vm.runInContext(source.split('\n').find(l=>l.includes("addEventListener('keydown'")),c);
 const event=extra=>({key:'Enter',shiftKey:false,isComposing:false,preventDefault(){prevented++},...extra});listeners.keydown(event());assert.equal(sent,1);listeners.keydown(event({shiftKey:true}));listeners.keydown(event({isComposing:true}));assert.equal(sent,1);button.disabled=true;listeners.keydown(event());assert.equal(sent,1);assert.equal(prevented,2);
});
test('markup has accessible icon and no main technical explanation; keyboard viewport hooks retained',()=>{
 const h=fs.readFileSync('index.html','utf8');assert.ok(h.includes('aria-label="Hantar mesej"'));assert.ok(h.includes('id="chat-generate"'));assert.ok(!h.includes('Batalkan permintaan tertangguh'));assert.ok(source.includes('visualViewport.height'));assert.ok(source.includes('pending:pending.length>0'));assert.ok(source.includes('session.contextStart||0'));
});
