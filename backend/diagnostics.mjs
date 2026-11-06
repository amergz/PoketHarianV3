import {appendFileSync,mkdirSync} from 'node:fs';
const messages={
 CONFIG_MISSING:'AI belum disambungkan: konfigurasi key belum tersedia.',
 CONFIG_BASE:'Base URL tidak dibenarkan; gunakan https://api.deepseek.com.',
 NETWORK:'Permintaan rangkaian gagal; tiada respons HTTP diterima.',
 TIMEOUT:'Permintaan tamat masa; tiada respons HTTP diterima.',
 RESPONSE_JSON:'Badan respons HTTP bukan JSON yang boleh diproses.',
 INCOMPLETE:'Respons model tidak lengkap atau content tiada.',
 CONTENT_JSON:'Content model bukan JSON yang sah.',
 SCHEMA:'JSON model gagal validasi kontrak operasi aplikasi.',
 HTTP:'DeepSeek memulangkan respons HTTP gagal.'
};
const networkCodes=new Set(['ENOTFOUND','EAI_AGAIN','ECONNREFUSED','ECONNRESET','ETIMEDOUT','ENETUNREACH','EHOSTUNREACH','CERT_HAS_EXPIRED','DEPTH_ZERO_SELF_SIGNED_CERT','UNABLE_TO_VERIFY_LEAF_SIGNATURE','UND_ERR_CONNECT_TIMEOUT','UND_ERR_HEADERS_TIMEOUT','UND_ERR_SOCKET']);
const providerCodes=new Set(['invalid_api_key','authentication_error','insufficient_balance','insufficient_quota','invalid_request_error','invalid_request','rate_limit_exceeded','rate_limit_error','server_error','model_not_found','context_length_exceeded','invalid_parameter']);
export function failure({stage,status=null,kind,code=null,model,attempt=1,validation=null,requestId=null,usage=null,shape=null}){
 const safeModel=typeof model==='string'&&/^deepseek-[a-z0-9-]{1,64}$/.test(model)?model:'[model konfigurasi tidak dikenali]';
 const safeCode=networkCodes.has(code)||providerCodes.has(code)?code:code?'UNRECOGNIZED_CODE':kind;
 let message=messages[kind]||messages.HTTP;
 if(stage==='http'){
  const known={400:'Permintaan ditolak: format atau parameter tidak sah.',401:'Pengesahan ditolak oleh penyedia.',402:'Penyedia melaporkan baki tidak mencukupi.',403:'Akses ditolak oleh penyedia.',404:'Endpoint atau model tidak ditemui.',422:'Parameter permintaan tidak dapat diproses.',429:'Had kadar atau kuota penyedia dicapai.',500:'Ralat dalaman penyedia.',502:'Gateway penyedia gagal.',503:'Penyedia tidak tersedia.',504:'Gateway penyedia tamat masa.'};
  message=known[status]||message;
 }
 const diagnostic={timestamp:new Date().toISOString(),stage,httpStatus:Number.isInteger(status)?status:null,errorCode:safeCode,message,endpoint:'https://api.deepseek.com/chat/completions',model:safeModel,attempt};
 if(/^[a-zA-Z0-9-]{8,100}$/.test(requestId))diagnostic.requestId=requestId;
 if(usage)diagnostic.usage=usage;if(shape)diagnostic.shape=shape;
 if(validation){diagnostic.boundary='backend.contract.check';diagnostic.validation={path:/^\$(?:\.[a-zA-Z]+|\[\d+\])*$/.test(validation.path)?validation.path:'$',expected:String(validation.expected).slice(0,100),received:['missing','null','array','object','string','number','boolean','undefined'].includes(validation.received)?validation.received:'unknown'};}
 const error=new Error(message);error.status=stage==='configuration'?503:502;error.diagnostic=diagnostic;return error;
}
export function recordFailure(error){
 if(!error?.diagnostic)return;
 // Only constructed allowlisted metadata; never serialize request/error objects or upstream text.
 const d=error.diagnostic;
 const safe={timestamp:d.timestamp,stage:d.stage,httpStatus:d.httpStatus,errorCode:d.errorCode,message:d.message,endpoint:d.endpoint,model:d.model,attempt:d.attempt,...(d.validation?{validation:d.validation,boundary:d.boundary,requestId:d.requestId,usage:d.usage,shape:d.shape}:{})};
 try{const dir=new URL('../test-results/',import.meta.url);mkdirSync(dir,{recursive:true});appendFileSync(new URL('deepseek-diagnostics.jsonl',dir),JSON.stringify(safe)+'\n');}catch{console.error('Log diagnostik tidak dapat ditulis.');}
 console.error(JSON.stringify(safe));
}

export function recordCall({requestId,source,model,status,httpStatus}){
 const safe={requestId:/^[a-zA-Z0-9-]{8,100}$/.test(requestId)?requestId:null,source:source==='DeepSeek'?'DeepSeek':'local',model:/^deepseek-[a-z0-9-]{1,64}$/.test(model)?model:null,status:['success','network','http','response_parsing','response_validation','configuration'].includes(status)?status:'failed',httpStatus:Number.isInteger(httpStatus)?httpStatus:null};
 console.info(JSON.stringify(safe));
}
