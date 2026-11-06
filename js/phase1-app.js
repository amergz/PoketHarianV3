/* Browser integration: shared manual/chat commit and explicit demo UI. */
let manualCommitKey = crypto.randomUUID();
const financialKeys = ['poket_tx','poket_savings','poket_debts','poket_dismissed_bills','poket_savings_history','poket_commits_v1'];
let observedFinance = financialKeys.map(k=>localStorage.getItem(k));
function currentCategories(){return {expense:customExpenseCategories,income:customIncomeCategories};}
function adoptFinance(s){transactions=s.transactions;savingsAccounts=s.savings;debts=s.debts;dismissedBillNames=s.dismissed;savingsHistory=s.history;}
async function commitTransactions(items,options={}) {
    if(!navigator.locks)throw Error('Pelayar ini memerlukan sokongan Web Locks. Gunakan Chrome/Edge terkini melalui localhost atau HTTPS.');
    return navigator.locks.request('poket-finance-write',async()=>{
        const raw=financialKeys.map(k=>localStorage.getItem(k));
        const commits=JSON.parse(raw[5]||'{}');
        if(options.key&&Object.hasOwn(commits,options.key))return commits[options.key];
        if(raw.some((v,i)=>v!==observedFinance[i]))throw Error('Data telah berubah dalam tab lain. Muat semula dan semak draf sebelum menyimpan.');
        const state={transactions,savings:savingsAccounts,debts,dismissed:dismissedBillNames,history:savingsHistory,categories:currentCategories(),commits};
        const result=PoketCore.nextCommit(state,items,options);
        const s=result.state;
        const total=s.savings.reduce((n,a)=>n+Math.round(a.amount*100),0)/100;
        const date=getLocalYYYYMMDD();const h=s.history.find(x=>x.date===date);
        if(h)h.total=total;else s.history.push({date,total});
        const changes={poket_tx:JSON.stringify(s.transactions),poket_savings:JSON.stringify(s.savings),poket_debts:JSON.stringify(s.debts),poket_dismissed_bills:JSON.stringify(s.dismissed),poket_savings_history:JSON.stringify(s.history),poket_commits_v1:JSON.stringify(s.commits)};
        if(options.chatAction){
            const actions=JSON.parse(localStorage.getItem('poket_chat_actions_v2')||'{}');
            actions[options.key]={before:options.editId?transactions.filter(t=>t.id===options.editId):[],after:s.transactions.filter(t=>result.ids.includes(t.id)),beforePayments:debts.map(d=>({debtId:d.id,payments:(d.payments||[]).filter(p=>result.ids.includes(p.txId))})),undone:false};
            changes.poket_chat_actions_v2=JSON.stringify(actions);
        }
        PoketCore.write(localStorage,changes);
        adoptFinance(s);
        if(!options.chatAction&&typeof showManualSummary==='function'){try{if(options.editId&&typeof markSnapshots==='function'){markSnapshots([options.editId]);persistChat();}showManualSummary(s.transactions.filter(t=>result.ids.includes(t.id)));}catch(e){console.error('Ringkasan kategori tidak tersedia');}}
        observedFinance=financialKeys.map(k=>localStorage.getItem(k));
        // All persisted effects are committed before rendering. Render failures cannot replay transfers.
        try{renderSavingsAccounts();refreshData();showBudgetToast();}catch(e){console.error('Paparan perlu dimuat semula',e);}
        observedFinance=financialKeys.map(k=>localStorage.getItem(k));
        return result.ids;
    });
}
function downloadBackup(){
    try{
        const blob=new Blob([JSON.stringify(PoketCore.backup(localStorage),null,2)],{type:'application/json'});
        const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='Poket-Harian-lengkap-'+new Date().toISOString().replace(/[:.]/g,'-')+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
    }catch(e){alert('Backup tidak dapat dihasilkan: '+e.message);}
}
async function restoreBackup(event){
    const file=event.target.files[0];event.target.value='';if(!file)return;
    try{
        if(file.size>10*1024*1024)throw Error('Had saiz backup 10 MB.');
        const data=JSON.parse(await file.text()),changes=PoketCore.importChanges(data);
        const legacy=data.schemaVersion===undefined;
        if(!confirm(legacy?'Backup lama hanya menggantikan transaksi, bajet dan tema yang disertakan. Akaun/hutang/kategori sedia ada dikekalkan; pautan mungkin perlu disemak. Eksport backup lengkap dahulu. Teruskan?':'Backup lengkap akan menggantikan data kewangan dan tetapan aplikasi. Eksport backup semasa dahulu. Teruskan?'))return;
        if(!navigator.locks)throw Error('Gunakan pelayar terkini melalui localhost/HTTPS.');
        await navigator.locks.request('poket-finance-write',()=>PoketCore.write(localStorage,changes));
        // Reload rehydrates all financial state from restored storage, never from chat snapshots.
        alert('Backup dipulihkan. Transaksi simpanan tidak dimainkan semula.');location.reload();
    }catch(e){alert('Import dibatalkan: '+e.message);}
}

// Existing manual savings/delete actions can persist outside commitTransactions. Reobserve after same-tab UI refresh.
const originalRefreshData=refreshData;
refreshData=function(){originalRefreshData();observedFinance=financialKeys.map(k=>localStorage.getItem(k));};
for(const name of ['saveSavingsAccounts','saveDebts','saveSavingsHistoryLog','saveDismissedBillNames']) {
    const original=window[name];
    if(original)window[name]=function(...args){const out=original(...args);observedFinance=financialKeys.map(k=>localStorage.getItem(k));return out;};
}
let staleTab=false;
window.addEventListener('storage',e=>{if(financialKeys.includes(e.key)){staleTab=true;chatStatus('Data berubah dalam tab lain. Muat semula sebelum menyimpan.',true);}});
const initialCommit=commitTransactions;
commitTransactions=async function(items,options){if(staleTab)throw Error('Muat semula aplikasi: data telah berubah dalam tab lain.');return initialCommit(items,options);};
