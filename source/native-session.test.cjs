const {test}=require('node:test');
const assert=require('node:assert/strict');
const {installSentenceCollection}=require('./install-ui.cjs');
const {createCollector}=require('./collector.cjs');
const sentence={original:'This is a session regression test.',translation:'这是一条会话回归测试。',from:'en',to:'zh-CHS'};
const settle=async()=>{for(let i=0;i<8;i++)await new Promise(setImmediate);};
function fixture(t,{localLogin=false,nativeLogin=true}={}){
 const calls=[],messages=[],mounts=[],watchers=[];
 let loginCalls=0,loginEvent;
 function triggerWatchers(){for(const watcher of watchers){const next=watcher.get(),key=JSON.stringify(next);if(key!==watcher.key){watcher.key=key;watcher.cb(next);}}}
 const account={loaded:false,isLogin:false,userId:''};
 const store={state:{user:{isLogin:localLogin},'write/account':account},dispatch:async(name,value)=>{
  calls.push(['dispatch',name,value]);assert.equal(name,'write/account/getAccountInfo');
  await Promise.resolve();Object.assign(account,{loaded:true,isLogin:value===false?false:nativeLogin,userId:value===false||!nativeLogin?'':'account-A'});
  triggerWatchers();
  return {...account};
 }};
 const globals={window:{ydk:{login:()=>{loginCalls++;},onLoginStatusChanged:options=>{loginEvent=options.success;}},addEventListener(){},removeEventListener(){}},navigator:{onLine:true},document:{hidden:false,addEventListener(){},removeEventListener(){}}};
 for(const [key,value]of Object.entries(globals)){const previous=Object.getOwnPropertyDescriptor(globalThis,key);Object.defineProperty(globalThis,key,{configurable:true,value});t.after(()=>previous?Object.defineProperty(globalThis,key,previous):delete globalThis[key]);}
 const Vue={getCurrentInstance:()=>({proxy:{$toast:message=>messages.push(message)}}),shallowRef:initial=>{let value=initial;return {get value(){return value;},set value(next){value=next;triggerWatchers();}};},h:(type,props,children)=>({type,props,children}),cloneVNode:node=>({...node}),onMounted:cb=>mounts.push(cb),onBeforeUnmount(){},watch:(source,cb,options)=>{const get=Array.isArray(source)?()=>source.map(read=>read()):source;watchers.push({get,cb,key:JSON.stringify(get())});if(options?.immediate)cb(get());}};
 const base={name:'sentence',render:()=>({props:{class:'buttons'},children:[]})};
 const root={components:{DictContent:{components:{FanyiMini:base}},TranslateResult:base}};
 let id='';
 function req(module){if(module===46069)return Vue;if(module===92109)return {A:store};if(module===9371)return {bE:async(url,data)=>{const op=url.split('/').at(-1);calls.push([op,data]);if(op==='add')id='created';if(op==='cancel')id='';return {code:0,data:{id}};}};throw Error('Unexpected module '+module);}
 req.e=async()=>{};
 installSentenceCollection(root,req,createCollector);
 const tree=root.components.DictContent.components.FanyiMini.render.call({result:{source:sentence.original,fanyi:{tran:sentence.translation,lanFrom:sentence.from,lanTo:sentence.to}}});
 const button=tree.children[0].type;
 const render=button.setup({sentence});
 return {calls,messages,store,render,mount:async()=>{mounts.forEach(cb=>cb());await settle();},loginCalls:()=>loginCalls,setNativeLogin:value=>{nativeLogin=value;},loginEvent:async value=>{assert.ok(loginEvent,'native session listener is registered');await loginEvent(value);await settle();}};
}
test('a logged-in native account can save while the mini page user store remains at its default false',async t=>{
 const f=fixture(t);await f.mount();await f.render().props.onClick();await settle();
 assert.equal(f.render().props['aria-pressed'],true,'the real native session must permit collection');
 assert.equal(f.loginCalls(),0,'collection must not launch the login flow');
 assert.equal(f.calls.filter(call=>call[0]==='add').length,1);
 assert.equal(f.store.state.user.isLogin,false,'the unrelated mini page default stays untouched');
});
test('a stale page login flag cannot save after the native account logs out',async t=>{
 const f=fixture(t,{localLogin:true,nativeLogin:true});await f.mount();
 f.setNativeLogin(false);await f.loginEvent({status:false,msg:'logout'});
 await f.render().props.onClick();await settle();
 assert.equal(f.calls.filter(call=>call[0]==='add').length,0);
 assert.equal(f.loginCalls(),0);
 assert.equal(f.render().props['aria-pressed'],false);
 assert.ok(f.messages.some(message=>message.text.includes('登录')));
});
