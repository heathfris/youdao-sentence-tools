const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createCollector}=require('./collector.cjs');
const A={original:'I hope you have a good future.',translation:'我希望你有一个美好的未来。',from:'en',to:'zh-CHS'};
const B={...A,original:'Another sentence.',translation:'另一个句子。'};
const defer=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
function fixture(post,extra={}){const calls=[],messages=[];const c=createCollector({post:async(op,data)=>{calls.push([op,data]);return post(op,data);},notify:x=>messages.push(x),online:()=>true,loggedIn:()=>true,...extra});return {c,calls,messages};}
test('lookup carries the visible translation and restores a saved ID',async()=>{
 const {c,calls}=fixture(async()=>({code:0,data:{id:'existing'}}));
 await c.setContext(A);assert.equal(c.state.id,'existing');assert.equal(calls[0][1].translation,A.translation);
});
test('save updates only after server success and blocks a double click',async()=>{
 const save=defer();const {c,calls}=fixture(async op=>op==='add'?save.promise:{code:0,data:{}});
 await c.setContext(A);const first=c.toggle();const second=c.toggle();
 assert.equal(c.state.id,'');assert.equal(c.state.busy,true);assert.equal(calls.filter(x=>x[0]==='add').length,1);
 save.resolve({code:0,data:{id:'created'}});await Promise.all([first,second]);assert.equal(c.state.id,'created');
});
test('cancel uses the collection ID and clears it on confirmation',async()=>{
 const {c,calls}=fixture(async op=>({code:0,data:op==='iscollected/single'?{id:'existing'}:{}}));
 await c.setContext(A);await c.toggle();assert.equal(c.state.id,'');assert.deepEqual(calls[1],['cancel',{id:'existing'}]);
});
test('an old lookup cannot change a newly displayed sentence',async()=>{
 const old=defer();const {c}=fixture(async(_,data)=>data.original===A.original?old.promise:{code:0,data:{id:'B'}});
 const first=c.setContext(A);await c.setContext(B);old.resolve({code:0,data:{id:'A'}});await first;
 assert.equal(c.state.id,'B');assert.equal(c.state.context.original,B.original);
});
test('an old save cannot mark the next sentence as saved',async()=>{
 const save=defer();const {c}=fixture(async op=>op==='add'?save.promise:{code:0,data:{}});
 await c.setContext(A);const first=c.toggle();await c.setContext(B);save.resolve({code:0,data:{id:'A'}});await first;
 assert.equal(c.state.id,'');assert.equal(c.state.context.original,B.original);
});
test('a lost save response leaves the state unconfirmed; retry queries before writing',async()=>{
 let saved=false;const {c,calls}=fixture(async op=>{if(op==='add'){saved=true;throw Error('Connection lost');}return {code:0,data:saved?{id:'server-saved'}:{}};});
 await c.setContext(A);await c.toggle();assert.equal(c.state.id,'');assert.equal(c.state.known,false);
 await c.toggle();assert.equal(c.state.id,'server-saved');assert.equal(calls.filter(x=>x[0]==='add').length,1);
});
test('offline and logged-out clicks cannot write a collection',async()=>{
 for(const extra of [{online:()=>false},{loggedIn:()=>false}]){
  const {c,calls,messages}=fixture(async()=>({code:0,data:{}}),extra);await c.setContext(A);await c.toggle();
  assert.equal(calls.length,0);assert.equal(c.state.id,'');assert.ok(messages.length);
 }
});
test('a rejected cancel keeps the saved ID; empty text sends no request',async()=>{
 const {c}=fixture(async op=>op==='cancel'?{code:500,msg:'Rejected'}:{code:0,data:{id:'existing'}});
 await c.setContext(A);await c.toggle();assert.equal(c.state.id,'existing');
 const f=fixture(async()=>{throw Error('Unexpected request');});await f.c.setContext({...A,original:' '});assert.equal(f.calls.length,0);
});
test('logging out invalidates an outstanding save response',async()=>{
 const save=defer();let loggedIn=true;const {c}=fixture(async op=>op==='add'?save.promise:{code:0,data:{}},{loggedIn:()=>loggedIn});
 await c.setContext(A);const pending=c.toggle();loggedIn=false;await c.refresh(true);save.resolve({code:0,data:{id:'old-account'}});await pending;
 assert.equal(c.state.id,'');assert.equal(c.state.known,false);assert.equal(c.state.busy,false);
});
