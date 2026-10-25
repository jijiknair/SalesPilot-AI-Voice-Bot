import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { WebSocket } from 'ws';
import { DEFAULT_PRODUCT_CONFIG } from '../src/config/defaultConfig.ts';
const base = process.env.SALESPILOT_TEST_URL || 'http://localhost:3000';
const evidence = { date: new Date().toISOString(), checks: [], diagnosticConversation: [], note: 'Real Gemini API requests; diagnostic text exchange only. No call records or substitute recordings were saved.' };
async function post(path, body) {
 const started = Date.now();
 const res = await fetch(base + path, {method:'POST', headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(60000)});
 const data = await res.json();
 return {status:res.status, data, ms:Date.now()-started};
}
const messages=[];
const initialHistory = await (await fetch(base + '/api/calls')).json();
for (const text of [
 'What is the exact monthly price per user for FlowCRM? Please answer my pricing question directly.',
 'How do the automated follow-up reminders help avoid missed sales opportunities?',
 'I need automated follow-up reminders for my team. Unclear pricing is an objection for me. Please follow up next week with confirmed pricing; I am not agreeing to a demo or purchase.'
]) {
 messages.push({sender:'customer',text});
 const result=await post('/api/gemini/chat-turn',{messages,userMessage:text,productConfig:DEFAULT_PRODUCT_CONFIG});
 evidence.checks.push({feature:'chat-turn',...result});
 assert.equal(result.status,200,JSON.stringify(result));
 messages.push({sender:'ai',text:result.data.reply});
 console.log('CHAT',result.ms+'ms',result.data.reply);
}
assert.notEqual(messages[1].text,messages[3].text);
evidence.diagnosticConversation=messages;
const summary=await post('/api/gemini/summarize',{transcript:messages,productConfig:DEFAULT_PRODUCT_CONFIG,durationSeconds:0});
console.log('SUMMARY',JSON.stringify(summary));
evidence.checks.push({feature:'summary',...summary});
assert.equal(summary.status,200);
assert.equal(summary.data.finalSalesStatus,'Follow-up Required');
assert.ok(summary.data.customerRequirements.length);
assert.ok(summary.data.customerObjections.length);
assert.ok(summary.data.recommendedNextSteps.length);
const noResponse=await post('/api/gemini/summarize',{transcript:[],productConfig:DEFAULT_PRODUCT_CONFIG});
assert.equal(noResponse.data.finalSalesStatus,'No Response');
assert.deepEqual(noResponse.data.customerRequirements,[]);
evidence.checks.push({feature:'no-response',...noResponse});
const tts=await post('/api/gemini/tts',{text:messages[3].text,voiceName:'Zephyr'});
assert.equal(tts.status,200,JSON.stringify(tts));
const bytes=Buffer.from(tts.data.audioBase64,'base64');
assert.ok(bytes.length>1000);
evidence.checks.push({feature:'real-generated-speech',status:tts.status,ms:tts.ms,mimeType:tts.data.mimeType,bytes:bytes.length,header:bytes.subarray(0,12).toString('hex'),note:'Not played, stored as a call recording, or substituted for captured microphone audio.'});
console.log('TTS',JSON.stringify(evidence.checks.at(-1)));
const live=await new Promise((resolve,reject)=>{
 const ws=new WebSocket(base.replace(/^http/, 'ws') + '/live');
 const result={ready:false,audioBytes:0,aiText:'',finished:false};
 const timer=setTimeout(()=>{ws.close();reject(new Error('Live timeout '+JSON.stringify(result)));},45000);
 ws.on('open',()=>ws.send(JSON.stringify({type:'start',productConfig:DEFAULT_PRODUCT_CONFIG})));
 ws.on('message',(data)=>{
   const msg=JSON.parse(data.toString());
   if(msg.type==='error'){clearTimeout(timer);ws.close();reject(new Error(msg.error));}
   if(msg.type==='ready')result.ready=true;
   if(msg.type==='audio')result.audioBytes+=Buffer.from(msg.audio,'base64').length;
   if(msg.type==='ai_text')result.aiText+=msg.text;
   if(msg.type==='turn_complete'){result.finished=true;clearTimeout(timer);ws.close();resolve(result);}
 });
 ws.on('error',(error)=>{clearTimeout(timer);reject(error);});
});
console.log('LIVE',JSON.stringify(live));
assert.ok(live.ready && live.audioBytes>0 && live.aiText && live.finished);
evidence.checks.push({feature:'live-bridge-greeting-and-transcription',...live,note:'Real Gemini Live audio/transcript received. No microphone uplink, audible playback, or real voice conversation verified.'});
const finalHistory = await (await fetch(base + '/api/calls')).json();
assert.deepEqual(finalHistory, initialHistory, 'Diagnostics must not alter user call history.');
evidence.checks.push({feature:'user-history-preserved',unchanged:true});
await fs.mkdir('artifacts', {recursive:true});
await fs.writeFile('artifacts/api-verification.json',JSON.stringify(evidence,null,2));
console.log('Saved sanitized verification results.');
