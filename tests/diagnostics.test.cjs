const {test}=require('node:test');const assert=require('node:assert/strict');
test('sanitized network, HTTP, response parsing and schema diagnostics with mocked fetch only',async()=>{
 const {extract}=await import('../backend/deepseek.mjs');
 const payload={message:'PRIVATE FINANCIAL MESSAGE',referenceDate:'2026-11-05',categories:{expense:['Makan'],income:['Gaji']},recent:[]};
 const options={key:'FAKE_SECRET_DO_NOT_LOG',model:'deepseek-flash',maxAttempts:1};
 async function expect(fetchImpl,stage,status,code){
  let error;try{await extract(payload,{...options,fetchImpl});}catch(e){error=e;}
  assert.ok(error?.diagnostic);const d=error.diagnostic;assert.equal(d.stage,stage);assert.equal(d.httpStatus,status);assert.equal(d.errorCode,code);assert.equal(d.endpoint,'https://api.deepseek.com/chat/completions');assert.equal(d.model,'deepseek-flash');
  const serialized=JSON.stringify(d);for(const secret of ['FAKE_SECRET','PRIVATE FINANCIAL','Authorization','RAW_PROVIDER_MESSAGE'])assert.equal(serialized.includes(secret),false);
 }
 await expect(async()=>{throw Object.assign(Error('PRIVATE FINANCIAL MESSAGE FAKE_SECRET_DO_NOT_LOG'),{cause:{code:'ENOTFOUND'}});},'network',null,'ENOTFOUND');
 await expect(async()=>({ok:false,status:401,json:async()=>({error:{code:'invalid_api_key',message:'RAW_PROVIDER_MESSAGE FAKE_SECRET_DO_NOT_LOG'}})}),'http',401,'invalid_api_key');
 await expect(async()=>({ok:false,status:402,json:async()=>({error:{code:'PRIVATE FINANCIAL MESSAGE'}})}),'http',402,'UNRECOGNIZED_CODE');
 await expect(async()=>({ok:true,status:200,json:async()=>{throw Error('RAW_PROVIDER_MESSAGE');}}),'response_parsing',200,'RESPONSE_JSON');
 await expect(async()=>({ok:true,status:200,json:async()=>({choices:[{finish_reason:'stop',message:{content:'PRIVATE FINANCIAL MESSAGE'}}]})}),'response_parsing',200,'CONTENT_JSON');
 await expect(async()=>({ok:true,status:200,json:async()=>({choices:[{finish_reason:'stop',message:{content:'{}'}}]})}),'response_validation',200,'SCHEMA');
});
