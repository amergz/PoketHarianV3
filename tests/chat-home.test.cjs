const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const h=fs.readFileSync('index.html','utf8'),a=fs.readFileSync('js/chat-auto.js','utf8').replace(/\r\n/g,'\n');const els={};
function el(id){return els[id]??={hidden:false,textContent:'',classList:{toggle(k,v){this[k]=v},remove(){},add(){}},focus(){this.focused=true}}}
const c=vm.createContext({document:{getElementById:el,querySelectorAll:()=>[]},window:{scrollTo(){}},populateHistoryFilters(){},renderFullHistory(){},renderStatistics(){},renderSavingsAccounts(){},renderFeatureSettingsList(){},renderChat(){},refreshAIStatus(){}});
vm.runInContext(h.match(/function switchTab\(tabId\) \{[\s\S]*?\n        \}/)[0],c);
for(const tab of ['home','history','stats','savings','menu','home']){c.tab=tab;vm.runInContext('switchTab(tab)',c);assert.equal(el('floating-chat-btn').hidden,tab!=='home');assert.equal(el('floating-add-btn').classList.hidden,tab!=='home')}
vm.runInContext('const chatPanel=document.getElementById("chat-panel");let chatOpener=null;'+a.match(/function openChat\(event\).*\nfunction closeChat\(\).*/)[0],c);
c.opener=el('floating-chat-btn');c.opener.id='floating-chat-btn';vm.runInContext('openChat({currentTarget:opener})',c);assert.equal(el('chat-panel').hidden,false);vm.runInContext('closeChat()',c);assert.equal(el('chat-panel').hidden,true);assert.ok(c.opener.focused);
assert.ok(h.includes('onclick="prepareNewTx()"'));assert.ok(h.includes('AI belum disambungkan'));
console.log('PASS: Home-only visibility, existing panel open/close, focus return, original + handler and Demo label');