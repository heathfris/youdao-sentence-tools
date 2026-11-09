function installSentenceCollection(root,req,createCollector){
  if(root.__ydSentenceCollection)return root;
  const Vue=req(46069),store=req(92109).A;
  const sentenceUrl='https://dict.youdao.com/dictserver/sentence/';
  const session=Vue.shallowRef({loaded:false,isLogin:false,userId:''});
  let sessionVersion=0,sessionRequest=null;
  function refreshSession(force=false){
    if(sessionRequest&&!force)return sessionRequest;
    const version=++sessionVersion;
    const request=Promise.resolve().then(()=>store.dispatch('write/account/getAccountInfo')).then(info=>{
      if(version===sessionVersion)session.value={loaded:true,isLogin:!!info.isLogin,userId:info.userId||''};
      return session.value;
    },()=>{
      if(version===sessionVersion)session.value={loaded:true,isLogin:false,userId:''};
      return session.value;
    });
    sessionRequest=request;
    request.finally(()=>{if(sessionRequest===request)sessionRequest=null;});
    return request;
  }
  window.ydk?.onLoginStatusChanged?.({success:event=>{
    if(event.msg==='cancel')return;
    if(event.status===false){sessionVersion++;sessionRequest=null;session.value={loaded:true,isLogin:false,userId:''};}
    else refreshSession(true);
  }});
  const Button={
    name:'YoudaoSentenceCollect',props:['sentence'],
    setup(props){
      const vm=Vue.getCurrentInstance().proxy;
      const value=Vue.shallowRef({id:'',busy:false,known:false,error:''});
      const model=createCollector({
        post:async(operation,data)=>{await req.e(2651);return req(9371).bE(sentenceUrl+operation,data,{needCommonParams:true,needSign:true});},
        online:()=>navigator.onLine!==false,
        loggedIn:()=>session.value.isLogin,
        onChange:state=>{value.value=state;},
        notify:text=>vm.$toast({text})
      });
      Vue.watch(()=>props.sentence,context=>model.setContext(context),{immediate:true,deep:true});
      Vue.watch([()=>session.value.isLogin,()=>session.value.userId],()=>model.refresh(true));
      const sync=async()=>{await refreshSession();await model.refresh();};
      const refresh=()=>{if(!document.hidden)sync();};
      Vue.onMounted(()=>{sync();window.addEventListener('focus',refresh);document.addEventListener('visibilitychange',refresh);});
      Vue.onBeforeUnmount(()=>{model.dispose();window.removeEventListener('focus',refresh);document.removeEventListener('visibilitychange',refresh);});
      return ()=>{
        const state=value.value;
        const title=state.busy?'正在处理收藏':state.error?'重试查询收藏状态':state.id?'取消句子收藏':'收藏句子';
        return Vue.h('button',{
          class:'yd-sentence-collect',type:'button',title,'aria-label':title,'aria-pressed':!!state.id,
          disabled:state.busy||!session.value.loaded,'data-sentence-collected':state.id?'true':'false',
          onClick:async()=>{await refreshSession();if(!session.value.isLogin){vm.$toast({text:'请先在有道主窗口登录，再收藏句子'});return;}await model.toggle();},
          style:{display:'inline-flex',alignItems:'center',justifyContent:'center',verticalAlign:'middle',flexShrink:'0',
            width:'24px',height:'24px',marginLeft:'6px',padding:'2px',border:0,borderRadius:'4px',
            background:'transparent',color:state.id?'#a78bfa':'inherit',opacity:state.busy?'.45':'.8',
            cursor:state.busy?'wait':'pointer'}
        },[Vue.h('svg',{width:20,height:20,viewBox:'0 0 24 24',fill:state.id?'currentColor':'none',stroke:'currentColor','stroke-width':1.5,'aria-hidden':'true'},[
          Vue.h('path',{d:'M12 3l2.78 5.63L21 9.54l-4.5 4.39 1.06 6.2L12 17.2l-5.56 2.93 1.06-6.2L3 9.54l6.22-.91L12 3z'})
        ])]);
      };
    }
  };
  function insert(node,context){
    if(!node||typeof node!=='object')return node;
    const classes=String(node.props?.class||'').split(/\s+/);
    if(classes.includes('buttons')){
      const copy=Vue.cloneVNode(node);copy.children=[...(Array.isArray(node.children)?node.children:[]),Vue.h(Button,{key:'youdao-sentence-collect',sentence:context})];
      copy.dynamicChildren=null;copy.patchFlag=-2;return copy;
    }
    if(!Array.isArray(node.children))return node;
    const children=node.children.map(child=>insert(child,context));
    if(children.every((child,index)=>child===node.children[index]))return node;
    const copy=Vue.cloneVNode(node);copy.children=children;copy.dynamicChildren=null;copy.patchFlag=-2;return copy;
  }
  function extend(base,context){
    if(!base||typeof base.render!=='function')throw Error('Unknown sentence result component');
    return {name:'YoudaoCollect_'+base.name,extends:base,
      render(...args){return insert(base.render.apply(this,args),context(this));}};
  }
  const components=root.components,dict=components?.DictContent?.components;
  if(!dict?.FanyiMini||!components?.TranslateResult)throw Error('Unknown mini component layout');
  const primary=extend(dict.FanyiMini,vm=>({original:vm.result?.source,translation:vm.result?.fanyi?.tran,from:vm.result?.fanyi?.lanFrom,to:vm.result?.fanyi?.lanTo}));
  const fallback=extend(components.TranslateResult,vm=>{
    const languages=String(vm.translate?.type||'').split('2');
    return {original:vm.keyword,translation:(vm.translate?.translateResult||[]).map(line=>line.map(part=>part.tgt||'').join('')).join('\n'),from:languages[0]||vm.lang,to:languages[1]};
  });
  dict.FanyiMini=primary;components.TranslateResult=fallback;
  Object.defineProperty(root,'__ydSentenceCollection',{value:true});
  return root;
}
module.exports={installSentenceCollection};
