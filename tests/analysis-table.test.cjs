const {test}=require('node:test'),assert=require('node:assert/strict');
const A=require('../js/finance-analysis.js');
const categories={expense:['Makan','Kategori panjang <script>','Lain'],income:['Niaga'],savings:['Simpan']};
const tx=[{id:1,type:'expense',category:'Makan',amount:12,date:'2026-11-05',text:'Makan'}, {id:2,type:'expense',category:'Kategori panjang <script>',amount:1234567.89,date:'2026-11-01',text:'Bayaran sekali'}, {id:3,type:'expense',category:'Lain',amount:5,date:'2026-11-06'}, {id:4,type:'income',category:'Niaga',amount:80,date:'2026-11-05'}, {id:5,type:'savings',category:'Simpan',amount:50,date:'2026-11-05'}];
const q={op:'total',period:'month',month:null,type:'expense',category:null};
const run=q=>A.run(tx,{},q,{today:'2026-11-05',categories});
test('structured expense table reconciles, excludes transfers/income/future; persists large and unsafe text as data',()=>{
 const r=run(q),v=A.presentation(r,tx);assert.equal(v.total,123457989);assert.equal(v.rows.reduce((s,r)=>s+r.amount,0),v.total);assert.equal(v.rows.length,2);assert.equal(v.rows[0].category,'Kategori panjang <script>');assert.equal(A.money(v.total),'RM 1,234,579.89');assert.deepEqual(JSON.parse(JSON.stringify(v)),v);assert.match(v.title,/November 2026/);assert.match(v.title,/2026-11-05/);assert.ok(v.observations.length<=3);assert.doesNotMatch(v.observations.join(' '),/komitmen|boros/);
});
test('empty period and matched comparison with zero prior are explicit; historic context retained',()=>{
 const r=run({...q,op:'compare'}),v=A.presentation(r,tx);assert.equal(r.prior.end,'2026-10-05');assert.match(v.observations.at(-1),/asas sebelumnya sifar/);assert.doesNotMatch(v.observations.join(' '),/Infinity|NaN/);
 const empty=run({...q,month:'2026-09'});assert.equal(A.presentation(empty,tx).rows.length,0);
 const follow=A.run(tx,{}, {...q,op:'compare',period:'followup_previous'}, {today:'2026-12-20',categories,last:{q:r.q,range:r.range}});assert.equal(follow.range.end,'2026-11-05');assert.equal(follow.prior.end,'2026-10-05');
});
