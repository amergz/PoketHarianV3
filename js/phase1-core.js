/* Shared deterministic Phase 1 logic. No network or AI provider. */
(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    else root.PoketCore = api;
})(typeof globalThis === 'object' ? globalThis : this, function () {
    'use strict';
    const KEYS = ['poket_category_budgets_v1','poket_tx','poket_plan','poket_theme','poket_ui_prefs','poket_font_size','poket_palette',
        'poket_expense_categories','poket_income_categories','poket_category_colors','poket_savings',
        'poket_savings_history','poket_debts','poket_debt_strategy','poket_debt_extra','poket_salary_commitments',
        'poket_salary_savings_income','poket_salary_savings_pct','poket_dismissed_bills','poket_payday_dismissed',
        'poket_filament_stock','poket_enabled_features','poket_history_advanced_expanded_v3',
        'poket_chat_drafts_v1','poket_category_rules_v1','poket_commits_v1','poket_chat_session_v2','poket_chat_actions_v2'];
    const JOURNAL = 'poket_pending_write_v1';
    const clone = x => JSON.parse(JSON.stringify(x));
    const object = x => x && typeof x === 'object' && !Array.isArray(x);
    function dateValid(s) {
        if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
        const d = new Date(s + 'T00:00:00Z');
        return Number.isFinite(+d) && d.toISOString().slice(0,10) === s;
    }
    function cents(x) {
        const n = typeof x === 'number' ? x : Number(String(x).trim());
        if (!Number.isFinite(n) || n <= 0 || !Number.isSafeInteger(Math.round(n * 100)) || Math.abs(n*100-Math.round(n*100)) > 0.00001) throw Error('Jumlah mesti positif dengan maksimum dua tempat perpuluhan.');
        return Math.round(n*100);
    }
    function validateTx(t, options = {}) {
        if (!object(t) || !dateValid(t.date) || !['expense','income','savings'].includes(t.type)) throw Error('Jenis atau tarikh transaksi tidak sah.');
        cents(t.amount);
        if (typeof t.text !== 'string' || !t.text.trim() || t.text.length > 500 || typeof t.category !== 'string' || !t.category.trim()) throw Error('Lengkapkan keterangan dan kategori transaksi.');
        if (options.requireId && (!Number.isSafeInteger(t.id) || t.id <= 0)) throw Error('ID transaksi tidak sah.');
        for (const f of ['isBill','isDebtPayment']) if (t[f] !== undefined && typeof t[f] !== 'boolean') throw Error('Tanda bil/hutang tidak sah.');
        return t;
    }
    function validateValue(key, raw) {
        if (typeof raw !== 'string') throw Error('Nilai backup mesti teks storan.');
        const enums = {poket_theme:['light','dark'],poket_font_size:['small','medium','large'],poket_palette:['default','cosmic','night','autumn','glass','pop'],poket_debt_strategy:['original','avalanche','snowball'],poket_history_advanced_expanded_v3:['0','1']};
        if (enums[key]) { if (!enums[key].includes(raw)) throw Error('Tetapan tidak sah: '+key); return; }
        if (['poket_debt_extra','poket_salary_savings_income','poket_salary_savings_pct'].includes(key)) {
            if (!Number.isFinite(Number(raw)) || Number(raw)<0 || (key.endsWith('_pct') && Number(raw)>100)) throw Error('Amaun tetapan tidak sah.'); return;
        }
        const v = JSON.parse(raw);
        if (key === 'poket_plan') { if (!object(v) || !Number.isFinite(v.monthlyBudget) || v.monthlyBudget < 0 || typeof v.carryForward !== 'boolean') throw Error('Pelan bajet tidak sah.'); }
        else if (['poket_ui_prefs','poket_category_colors','poket_payday_dismissed','poket_commits_v1','poket_category_rules_v1','poket_chat_session_v2','poket_chat_actions_v2'].includes(key)) {
            if (!object(v)) throw Error('Tetapan objek tidak sah: '+key);
            if(key === 'poket_ui_prefs' && Object.values(v).some(x=>typeof x!=='boolean')) throw Error('Pilihan paparan tidak sah.');
            if(key === 'poket_category_colors' && (!object(v.expense)||!object(v.income)||Object.values({...v.expense,...v.income}).some(x=>typeof x!=='string'||!/^#[0-9a-f]{6}$/i.test(x)))) throw Error('Warna kategori tidak sah.');
            if(key === 'poket_category_rules_v1' && Object.values(v).some(x=>!object(x)||!['expense','income'].includes(x.type)||typeof x.category!=='string')) throw Error('Pemetaan kategori tidak sah.');
            if(key === 'poket_payday_dismissed' && Object.values(v).some(x=>!Array.isArray(x)||x.some(y=>typeof y!=='string'))) throw Error('Peringatan tidak sah.');
        } else {
            if (!Array.isArray(v)) throw Error('Senarai tidak sah: '+key);
            if(key==='poket_category_budgets_v1'){if(v.length>1000||v.some(b=>!object(b)||!['expense','income'].includes(b.type)||typeof b.category!=='string'||!b.category.trim()||!['salary','month'].includes(b.mode)||!dateValid(b.start)||!dateValid(b.end)||b.start>b.end||!Number.isSafeInteger(b.amount)||b.amount<0))throw Error('Bajet kategori tidak sah.');}
            else if (key === 'poket_tx') { const ids=new Set(); v.forEach(t=>{validateTx(t,{requireId:true});if(ids.has(t.id))throw Error('ID transaksi pendua.');ids.add(t.id);}); }
            else if (['poket_expense_categories','poket_income_categories','poket_dismissed_bills','poket_enabled_features'].includes(key)) {
                if(v.some(x=>typeof x!=='string'||!x.trim()) || (key.includes('_categories') && !v.length)) throw Error('Nama kategori/senarai tidak sah.');
            } else if (key === 'poket_chat_drafts_v1') {
                if (v.some(x=>!object(x)||typeof x.draftId!=='string'||!Array.isArray(x.items)||x.items.some(i=>!object(i)||typeof i.text!=='string'))) throw Error('Draf tidak sah.');
            } else {
                if(v.some(x=>!object(x))) throw Error('Rekod sokongan tidak sah.');
                if(key==='poket_savings' && v.some(x=>!Number.isSafeInteger(x.id)||typeof x.name!=='string'||!Number.isFinite(x.amount)||x.amount<0)) throw Error('Akaun simpanan tidak sah.');
                if(key==='poket_debts' && v.some(x=>!Number.isSafeInteger(x.id)||typeof x.name!=='string'||!Number.isFinite(x.balance)||x.balance<0||(x.payments!==undefined&&(!Array.isArray(x.payments)||x.payments.some(p=>!object(p)||!Number.isFinite(p.amount)||p.amount<=0||!dateValid(p.date)))))) throw Error('Rekod hutang tidak sah.');
                if(key==='poket_salary_commitments' && v.some(x=>typeof x.name!=='string'||!Number.isFinite(x.amount)||x.amount<0)) throw Error('Komitmen tidak sah.');
            }
        }
    }
    function snapshot(storage) {
        return Object.fromEntries(KEYS.filter(k=>!['poket_chat_session_v2','poket_chat_drafts_v1'].includes(k)).map(k=>[k,storage.getItem(k)]).filter(([,v])=>v!==null));
    }
    function backup(storage) {
        const data = snapshot(storage); Object.entries(data).forEach(([k,v])=>validateValue(k,v));
        return {app:'Poket Harian',schemaVersion:2,createdAt:new Date().toISOString(),data};
    }
    function importChanges(input) {
        if (!object(input)) throw Error('Fail backup tidak sah.');
        let changes;
        if (input.schemaVersion === 2 && input.app === 'Poket Harian' && object(input.data)) {
            if (Object.keys(input.data).some(k=>!KEYS.includes(k))) throw Error('Backup mengandungi key tidak dibenarkan.');
            changes=Object.fromEntries(KEYS.map(k=>[k,Object.hasOwn(input.data,k)?input.data[k]:null]));
        } else if (input.schemaVersion === undefined && Array.isArray(input.transactions)) {
            changes={poket_tx:JSON.stringify(input.transactions)};
            if(input.plan!==undefined) changes.poket_plan=JSON.stringify(input.plan);
            if(input.theme!==undefined) changes.poket_theme=input.theme;
            // Old format has no linked balances/categories: preserve those keys, never replay transfers.
        } else throw Error('Versi atau format backup tidak disokong.');
        Object.entries(changes).forEach(([k,v])=>{if(v!==null) validateValue(k,v);});
        changes.poket_chat_session_v2=null;
        changes.poket_chat_drafts_v1=null;
        return changes;
    }
    function recover(storage) {
        const raw=storage.getItem(JOURNAL); if(!raw)return;
        const j=JSON.parse(raw);
        if(!object(j)||!object(j.before)||Object.keys(j.before).some(k=>!KEYS.includes(k))) throw Error('Jurnal pemulihan tidak sah.');
        for(const [k,v] of Object.entries(j.before)) { if(v===null)storage.removeItem(k);else storage.setItem(k,v); }
        storage.removeItem(JOURNAL);
    }
    function write(storage, changes) {
        if(storage.getItem(JOURNAL)) throw Error('Pemulihan storan diperlukan. Muat semula aplikasi.');
        if(Object.keys(changes).some(k=>!KEYS.includes(k)))throw Error('Key tidak dibenarkan.');
        const before=Object.fromEntries(Object.keys(changes).map(k=>[k,storage.getItem(k)]));
        storage.setItem(JOURNAL,JSON.stringify({before}));
        try {
            for(const [k,v]of Object.entries(changes)){if(v===null)storage.removeItem(k);else storage.setItem(k,v);}
            storage.removeItem(JOURNAL);
        } catch(e) { try{recover(storage);}catch(_){} throw Error('Tidak dapat menyimpan. Data dipulihkan atau pemulihan akan disambung ketika muat semula. '+e.message); }
    }
    function normal(s) { return String(s).toLocaleLowerCase('ms-MY').replace(/[^\p{L}\p{N}\s]/gu,' ').replace(/\s+/g,' ').trim(); }
    function ruleKey(s) { return normal(s).replace(/^(tadi|hari ini|semalam|kelmarin)\s+/,'').trim(); }
    function malaysiaDate(now=new Date()) { return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kuala_Lumpur',year:'numeric',month:'2-digit',day:'2-digit'}).format(now); }
    function shiftDate(s,n){const d=new Date(s+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);}
    function choose(text,categories,rules={}) {
        const k=ruleKey(text), learned=Object.hasOwn(rules,k)?rules[k]:null;
        if(learned && categories[learned.type]?.includes(learned.category)) return {...learned,source:'Pembetulan pengguna'};
        const s=' '+normal(text)+' ';
        const hit=re=>re.test(s);
        if(hit(/\b(simpan|simpanan|tabung)\b/))return{type:'savings',category:'Simpanan',source:'Peraturan tempatan'};
        const income=hit(/\b(gaji|bonus|pendapatan|upah|jualan|niaga)\b/);
        const type=income?'income':'expense';
        const direct=categories[type].filter(c=>c!=='Lain-lain'&&s.includes(' '+normal(c)+' '));
        if(direct.length===1)return{type,category:direct[0],source:'Kategori sedia ada'};
        const mappings=income?[[/\bgaji\b/,'Gaji'],[/\bbonus\b/,'Bonus'],[/\b(jualan|niaga)\b/,'Niaga']]:[[/\b(makan|nasi|sarapan|minum|kopi|roti)\b/,'Makan'],[/\b(petrol|minyak|diesel)\b/,'Minyak'],[/\b(dapur|runcit|sayur|beras|grocery)\b/,'Dapur'],[/\btol\b/,'Tol']];
        const matches=mappings.filter(([re,c])=>hit(re)&&categories[type].includes(c));
        return {type,category:matches.length===1?matches[0][1]:'',source:'Peraturan tempatan'};
    }
    function parse(text,ctx) {
        if(typeof text!=='string'||!text.trim()||text.length>2000)throw Error('Masukkan ayat sehingga 2,000 aksara.');
        const base=ctx.referenceDate||malaysiaDate(); if(!dateValid(base))throw Error('Tarikh rujukan tidak sah.');
        const explicit=text.match(/\b\d{4}-\d{2}-\d{2}\b/g)||[];
        const relative=[...text.toLowerCase().matchAll(/\b(kelmarin|semalam|hari ini|tadi)\b/g)].map(m=>m[1]);
        const dates=new Set([...explicit,...relative.map(x=>shiftDate(base,x==='semalam'?-1:x==='kelmarin'?-2:0))]);
        const date=dates.size>1?'':(dates.size?[...dates][0]:base);
        // Split only explicit separators; leave ambiguous clauses for manual completion.
        const pieces=text.split(/[,;\n]+|\s+dan\s+/i).map(x=>x.trim().replace(/[.!?]+$/,'')).filter(Boolean);
        return pieces.slice(0,20).map(piece=>{
            const amounts=[...piece.matchAll(/\bRM\s*(-?\d+(?:\.\d+)?)/gi)];
            const textOnly=piece.replace(/\bRM\s*-?\d+(?:\.\d+)?/gi,'').trim();
            const choice=choose(textOnly,ctx.categories,ctx.rules);
            const suspicious=/\b(bil|ansuran|hutang|bayar bank|transfer|pindah)\b/i.test(piece);
            return {text:textOnly||piece,amount:amounts.length===1?Number(amounts[0][1]):'',date:dateValid(date)?date:'',...choice,
                type:!choice.category && !/\b(belanja|beli|gaji|bonus|pendapatan|upah|jualan)\b/i.test(piece)?'':choice.type,
                savingsAccountId:'',isBill:false,isDebtPayment:false,debtId:null,
                warning:[amounts.length!==1?'Lengkapkan satu jumlah RM untuk draf ini.':'',!dateValid(date)?'Sahkan tarikh; ayat mengandungi tarikh tidak jelas.':'',suspicious?'Semak sama ada ini bil, bayaran hutang atau pindahan.':'',!choice.category?'Pilih jenis dan kategori yang sesuai.':''].filter(Boolean).join(' ')};
        });
    }
    function nextCommit(state,items,{key,editId=null}={}) {
        const s=clone(state);
        if(key && Object.hasOwn(s.commits,key))return {state:s,ids:s.commits[key],duplicate:true};
        if(!Array.isArray(items)||!items.length||items.length>20)throw Error('Draf transaksi tidak sah.');
        const ids=[]; let nextId=Math.max(Date.now(),...s.transactions.map(t=>t.id+1),0);
        for(const item of items){
            validateTx(item);
            const t={...item,amount:cents(item.amount)/100,text:item.text.trim()};
            for(const f of ['source','warning','learnText'])delete t[f];
            if(t.type==='savings'){
                t.category='Simpanan';t.isBill=false;t.isDebtPayment=false;t.debtId=null;
                if(!s.savings.some(a=>String(a.id)===String(t.savingsAccountId)))throw Error('Pilih akaun simpanan yang masih wujud.');
            }else{
                if(!s.categories[t.type].includes(t.category))throw Error('Pilih kategori sedia ada yang sah.');
                t.savingsAccountId=null;
                if(t.type!=='expense'){t.isBill=false;t.isDebtPayment=false;t.debtId=null;}
                if(t.isDebtPayment&&!s.debts.some(d=>String(d.id)===String(t.debtId)))throw Error('Pilih hutang yang sah.');
            }
            const old=editId?s.transactions.find(t=>t.id===editId):null;
            if(editId&&!old)throw Error('Transaksi yang diedit tidak lagi wujud.');
            t.id=old?old.id:nextId++;
            // Reverse old transfer before applying updated transfer, exactly once.
            if(old?.type==='savings'){
                const a=s.savings.find(a=>String(a.id)===String(old.savingsAccountId));
                if(a)a.amount=Math.max(0,Math.round(a.amount*100)-cents(old.amount))/100;
            }
            if(t.type==='savings') {const a=s.savings.find(a=>String(a.id)===String(t.savingsAccountId));a.amount=(Math.round(a.amount*100)+cents(t.amount))/100;}
            s.debts.forEach(d=>{if(Array.isArray(d.payments))d.payments=d.payments.filter(p=>p.txId!==t.id);});
            if(t.isDebtPayment){const d=s.debts.find(d=>String(d.id)===String(t.debtId));d.payments=d.payments||[];d.payments.push({id:t.id,txId:t.id,amount:t.amount,date:t.date});}
            if(old)s.transactions[s.transactions.findIndex(x=>x.id===old.id)]={...old,...t};else s.transactions.push(t);
            if(t.isBill)s.dismissed=s.dismissed.filter(n=>normal(n)!==normal(t.text));
            ids.push(t.id);
        }
        if(key)s.commits[key]=ids;
        return {state:s,ids,duplicate:false};
    }
    function totals(list){const out={income:0,expense:0,savings:0};list.forEach(t=>{if(Object.hasOwn(out,t.type))out[t.type]+=cents(t.amount);});return Object.fromEntries(Object.entries(out).map(([k,v])=>[k,v/100]));}
    async function requestDemo(payload,{fetchImpl=fetch,timeout=6000}={}){
        const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),timeout);
        try{
            const response=await fetchImpl('/api/ai/parse',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),cache:'no-store',signal:controller.signal});
            if(!response.ok)throw Error('Sambungan demo gagal ('+response.status+').');
            const data=await response.json();
            if(!object(data)||data.schemaVersion!==1||data.mode!=='demo'||data.provider!==null||!Array.isArray(data.candidates)||data.candidates.length>20)throw Error('Respons demo tidak sah.');
            for(const t of data.candidates){if(!object(t)||typeof t.text!=='string'||!['','expense','income','savings'].includes(t.type)||typeof t.category!=='string'||(t.date!==''&&!dateValid(t.date))||(t.amount!==''&&(()=>{try{cents(t.amount);return false;}catch{return true;}})()))throw Error('Respons draf tidak sah.');}
            return data;
        }finally{clearTimeout(timer);}
    }
    return {KEYS,JOURNAL,dateValid,cents,validateTx,validateValue,backup,importChanges,snapshot,write,recover,ruleKey,malaysiaDate,choose,parse,nextCommit,totals,requestDemo};
});
