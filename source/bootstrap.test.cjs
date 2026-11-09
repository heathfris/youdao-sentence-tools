const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const {createExtension}=require('./extension.cjs');
const {installFactoryHook}=require('./entry-ui.cjs');

test('the bootstrap extends both lazy roots without eagerly loading collection requests',async()=>{
 for(const [pathname,id]of [['/html/ydDict/mini.html',14806],['/html/index_v2.html',96239]]){
  const chunks=[],self={webpackChunkdict_desk_10:chunks};
  vm.runInNewContext(createExtension(''),{self,location:{pathname},console,window:{}},{timeout:1000});
  assert.equal(chunks.length,1);const entry=chunks.shift();
  const base={name:'original',setup(){},render(){}};
  const root=id===14806?{components:{DictContent:{components:{FanyiMini:base}},TranslateResult:base}}:{components:{SentenceList:{components:{Sentence:base}}}};
  function req(module){
   if(module===46069)return {shallowRef:value=>({value})};
   if(module===92109)return {A:{state:{}}};
   throw Error('Unexpected eager dependency '+module);
  }
  req.m={};chunks.push=chunk=>{Object.assign(req.m,chunk[1]);return 1;};
  await entry[2](req);
  let calls=0;
  chunks.push([[123],{[id]:(module,exports)=>{calls++;exports.default=root;},456:()=>{}}]);
  const module={exports:{}},exports={};req.m[id](module,exports,req);
  assert.equal(calls,1);assert.equal(exports.default,root);assert.equal(root.__ydSentenceVoice,true);
  if(id===14806){assert.equal(root.__ydSentenceCollection,true);assert.equal(root.components.DictContent.components.FanyiMini.extends,base);}
  else assert.equal(root.components.SentenceList.components.Sentence.setup,base.setup);
  assert.equal(typeof req.m[456],'function');
 }
});

test('an already registered factory runs before its extension and unrelated modules remain unchanged',()=>{
 const events=[],root={},foreign=()=>{};
 const context={self:{webpackChunkdict_desk_10:[]},console};
 vm.createContext(context);
 const req={m:{123(module,exports){events.push('original');exports.default=root;},456:foreign}};
 const extend=component=>{assert.equal(component,root);events.push('extension');};
 context.req=req;context.extend=extend;
 vm.runInContext(`(${installFactoryHook})(req,123,extend)`,context);
 req.m[123]({exports:{}},{},req);
 assert.deepEqual(events,['original','extension']);assert.equal(req.m[456],foreign);
});

test('unrelated client pages do not install feature extensions',()=>{
 const self={};
 vm.runInNewContext(createExtension(''),{self,location:{pathname:'/html/ydDict/settings.html'}},{timeout:1000});
 assert.equal(self.webpackChunkdict_desk_10,undefined);
});
