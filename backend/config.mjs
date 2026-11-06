import {existsSync} from 'node:fs';
const envFile=new URL('./.env',import.meta.url);
const inherited=Object.hasOwn(process.env,'DEEPSEEK_API_KEY');
export function usableKey(value){
 if(typeof value!=='string'||!value.trim())return false;
 const v=value.trim();
 return !/[<>\s]/.test(v)&&!/(placeholder|your[_-]?(api[_-]?)?key|replace[_-]?me|paste[_-]?(key|here)|masukkan|contoh|changeme|^sk[-_]?(x+|test|example|demo)$)/i.test(v);
}
const envExists=existsSync(envFile);
if(process.env.NODE_ENV!=='production'&&process.env.POKET_KEY_SOURCE==='backend/.env')delete process.env.DEEPSEEK_API_KEY;
if(envExists&&process.env.NODE_ENV!=='production'){try{process.loadEnvFile(envFile);}catch{throw Error('backend/.env tidak dapat dimuatkan; kandungan tidak dilog.');}}
export function configuredAttempts(){const n=Number(process.env.DEEPSEEK_MAX_ATTEMPTS||2);if(![1,2].includes(n))throw Error('DEEPSEEK_MAX_ATTEMPTS mesti 1 atau 2.');return n;}
export function configurationStatus(){return {
 envFileExists:envExists,envFileLoaded:envExists&&process.env.NODE_ENV!=='production',
 keySource:process.env.NODE_ENV==='production'?'process-environment':inherited&&process.env.POKET_KEY_SOURCE!=='backend/.env'?'process-environment':envExists?'backend/.env':'not-configured',
 maxAttempts:configuredAttempts(),
 configured:usableKey(process.env.DEEPSEEK_API_KEY),
 keyState:!process.env.DEEPSEEK_API_KEY?.trim()?'missing':usableKey(process.env.DEEPSEEK_API_KEY)?'present-not-obvious-placeholder':'placeholder-or-invalid-format',
 adapter:'DeepSeek',connectionVerified:false
};}
