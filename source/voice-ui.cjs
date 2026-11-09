function createEnglishSpeaker(Vue){
 return {
  name:'YoudaoEnglishSentenceSpeaker',props:{text:{type:String,default:''},label:{type:String,default:''}},
  setup(props){
   const player=Vue.ref(null),playing=Vue.ref(false);
   const text=Vue.computed(()=>String(props.text||'').trim());
   const stop=()=>{if(playing.value){player.value?.stopVoice();playing.value=false;}};
   Vue.watch(()=>props.text,stop);
   Vue.onBeforeUnmount(stop);Vue.onDeactivated(stop);
   return ()=>{
    const VoicePlayer=Vue.resolveComponent('VoicePlayer');
    const title=playing.value?'停止播放英语原句':'播放英语原句';
    return Vue.h('span',{
     class:'yd-source-voice',role:'button',tabindex:text.value?0:-1,title,'aria-label':title,'aria-pressed':playing.value,'aria-disabled':!text.value,
     'data-yd-source-voice':'true',
     onClick:event=>{event.stopPropagation();if(!event.target?.closest?.('.pronounce')&&text.value)player.value?.playAudio();},
     onKeydown:event=>{if(event.key==='Enter'||event.key===' '){event.stopPropagation();event.preventDefault();if(text.value)player.value?.playAudio();}},
     style:{display:'inline-flex',alignItems:'center',verticalAlign:'middle',flexShrink:0,gap:'3px',whiteSpace:'nowrap',cursor:text.value?'pointer':'default'}
    },[
     ...(props.label?[Vue.h('span',{class:'yd-voice-label',style:{fontSize:'12px',lineHeight:'20px',opacity:'.8'}},props.label)]:[]),
     Vue.h(VoicePlayer,{ref:player,word:text.value?encodeURIComponent(text.value)+'&le=en':'',disabled:!text.value,size:'20px',onPlayStatusChange:value=>{playing.value=!!value;}})
    ]);
   };
  }
 };
}
function installMiniVoices(root,req,createSpeaker){
 if(root.__ydSentenceVoice)return root;
 const Vue=req(46069),Speaker=createSpeaker(Vue),dict=root.components?.DictContent?.components;
 if(!dict?.FanyiMini||!root.components?.TranslateResult)throw Error('Unknown mini voice component layout');
 function visit(node,text){
  if(!node||typeof node!=='object')return node;
  if(String(node.props?.class||'').split(/\s+/).includes('buttons')){
   const children=(Array.isArray(node.children)?node.children:[]).map(child=>{
    if(String(child?.type?.name||'').toLowerCase()!=='voiceplayer')return child;
    return Vue.h('span',{class:'yd-target-voice',key:'yd-target-'+text+'-'+child.props?.word,style:{display:'inline-flex',alignItems:'center',gap:'3px',whiteSpace:'nowrap',verticalAlign:'middle'}},[
     Vue.h('span',{class:'yd-voice-label',style:{fontSize:'12px',lineHeight:'20px',opacity:'.8'}},'译文'),child
    ]);
   });
   const copy=Vue.cloneVNode(node);
   const source=Vue.h(Speaker,{key:'yd-mini-source-voice',text:String(text||''),label:'原文'});
   const position=children.findIndex(child=>child?.props?.class==='yd-target-voice')+1;
   copy.children=[...children.slice(0,position),source,...children.slice(position)];
   copy.dynamicChildren=null;copy.patchFlag=-2;return copy;
  }
  if(!Array.isArray(node.children))return node;
  const children=node.children.map(child=>visit(child,text));
  if(children.every((child,index)=>child===node.children[index]))return node;
  const copy=Vue.cloneVNode(node);copy.children=children;copy.dynamicChildren=null;copy.patchFlag=-2;return copy;
 }
 const extend=(base,getText)=>({...base,name:'YoudaoVoice_'+(base.name||'Sentence'),render(...args){return visit(base.render.apply(this,args),getText(this));}});
 dict.FanyiMini=extend(dict.FanyiMini,vm=>vm.result?.source);
 root.components.TranslateResult=extend(root.components.TranslateResult,vm=>vm.keyword);
 Object.defineProperty(root,'__ydSentenceVoice',{value:true});return root;
}
function installSentenceVoices(root,req,createSpeaker){
 if(root.__ydSentenceVoice)return root;
 const Vue=req(46069),Speaker=createSpeaker(Vue),list=root.components?.SentenceList;
 const base=list?.components?.Sentence;
 if(!base||typeof base.render!=='function')throw Error('Unknown sentence book row component');
 function visit(node,text,id){
  if(!node||typeof node!=='object')return node;
  if(String(node.props?.class||'').split(/\s+/).includes('sentence-inner-container')){
   const copy=Vue.cloneVNode(node,{style:{...node.props?.style,paddingRight:'40px'}});
   copy.children=[...(Array.isArray(node.children)?node.children:[]),Vue.h(Speaker,{key:'yd-book-source-'+id,text:String(text||''),'data-test':'sentence-collect-source-voice',style:{position:'absolute',right:'8px',top:'8px'}})];
   copy.dynamicChildren=null;copy.patchFlag=-2;return copy;
  }
  if(!Array.isArray(node.children))return node;
  const children=node.children.map(child=>visit(child,text,id));
  if(children.every((child,index)=>child===node.children[index]))return node;
  const copy=Vue.cloneVNode(node);copy.children=children;copy.dynamicChildren=null;copy.patchFlag=-2;return copy;
 }
 list.components.Sentence={...base,name:'YoudaoSentenceVoiceRow',render(...args){return visit(base.render.apply(this,args),this.data?.original,this.data?.id);}};
 Object.defineProperty(root,'__ydSentenceVoice',{value:true});return root;
}
module.exports={createEnglishSpeaker,installMiniVoices,installSentenceVoices};
