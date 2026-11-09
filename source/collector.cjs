function createCollector({post,notify=()=>{},onChange=()=>{},online=()=>true,loggedIn=()=>true}) {
  const state={context:null,id:'',busy:false,known:false,error:''};
  let revision=0,key='',disposed=false;
  const change=values=>{Object.assign(state,values);onChange({...state});};
  const permitted=(quiet=false)=>{
    const error=!state.context?.original?'':!online()?'网络不可用，请联网后重试':!loggedIn()?'登录有道后才能收藏句子':'';
    if(error){change({error,known:false});if(!quiet)notify(error);return false;}
    return !!state.context?.original&&!disposed;
  };
  const checked=response=>{
    if(response?.code!==0)throw Error(response?.msg||response?.errMsg||'请求失败，请稍后重试');
    return response.data||{};
  };
  async function lookup(quiet=true){
    if(!permitted(quiet)||state.busy)return;
    const current=revision,context=state.context;
    change({busy:true,error:''});
    try{
      const data=checked(await post('iscollected/single',{original:context.original,translation:context.translation}));
      if(current===revision&&!disposed)change({id:data.id?String(data.id):'',known:true});
    }catch(error){
      if(current===revision&&!disposed){change({known:false,error:error?.message||'无法确认收藏状态，请重试'});if(!quiet)notify(state.error);}
    }finally{if(current===revision&&!disposed)change({busy:false});}
  }
  async function setContext(value){
    const context={original:String(value?.original||'').trim(),translation:String(value?.translation||'').trim(),from:value?.from||'auto',to:value?.to||'auto'};
    const next=JSON.stringify(context);
    if(next===key&&(state.busy||state.known))return;
    key=next;revision++;
    change({context,id:'',busy:false,known:false,error:''});
    await lookup();
  }
  async function refresh(sessionChanged=false){
    if((state.busy&&!sessionChanged)||disposed)return;
    revision++;change({id:'',known:false,busy:false});await lookup();
  }
  async function toggle(){
    if(state.busy||!permitted())return;
    if(!state.known){await lookup(false);return;}
    const current=revision,context=state.context,savedId=state.id;
    change({busy:true,error:''});
    try{
      if(savedId){
        checked(await post('cancel',{id:savedId}));
        if(current===revision&&!disposed){change({id:'',known:true});notify('已取消句子收藏');}
      }else{
        const data=checked(await post('add',{...context,source:'',type:15}));
        if(!data.id)throw Error('收藏结果未确认，请点击重试查询');
        if(current===revision&&!disposed){change({id:String(data.id),known:true});notify('句子已收藏到单词本');}
      }
    }catch(error){
      if(current===revision&&!disposed){change({known:false,error:error?.message||'请求失败，请重试查询收藏状态'});notify(state.error);}
    }finally{if(current===revision&&!disposed)change({busy:false});}
  }
  return {state,setContext,refresh,toggle,dispose(){disposed=true;revision++;}};
}
module.exports={createCollector};
