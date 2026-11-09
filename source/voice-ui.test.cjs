const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createEnglishSpeaker,installMiniVoices,installSentenceVoices}=require('./voice-ui.cjs');
function fixture(){
 const hooks={watch:[],unmount:[],deactivate:[]},player={name:'voicePlayer'};
 const Vue={h:(type,props,children)=>({type,props:props||{},children:children||[]}),cloneVNode:(node,props)=>({...node,props:{...node.props,...props}}),resolveComponent:()=>player,ref:value=>({value}),computed:get=>({get value(){return get();}}),watch:(get,cb)=>hooks.watch.push({get,cb}),onBeforeUnmount:cb=>hooks.unmount.push(cb),onDeactivated:cb=>hooks.deactivate.push(cb)};
 return {Vue,hooks,player,req:id=>{assert.equal(id,46069);return Vue;}};
}
function childrenOfType(node,type){return (node.children||[]).filter(child=>child.type===type);}
test('both mini result branches put the Chinese target first and English original second, with each label before its icon',()=>{
 const f=fixture(),target={type:f.player,props:{word:'Chinese%20translation&le=zh'},children:[]},copy={type:'a',props:{class:'ic_copy'}},collect={type:'button',props:{class:'yd-sentence-collect'}};
 const base={name:'sentence',render:()=>({type:'div',props:{class:'buttons'},children:[target,copy,collect]})};
 const root={components:{DictContent:{components:{FanyiMini:base}},TranslateResult:base}};
 const Speaker={name:'testSpeaker'};
 installMiniVoices(root,f.req,()=>Speaker);
 for(const [component,context]of [[root.components.DictContent.components.FanyiMini,{result:{source:"If you're ready, let's go."}}],[root.components.TranslateResult,{keyword:"If you're ready, let's go."}]]){
  const tree=component.render.call(context);
  assert.equal(tree.children[0].children[0].children,'译文');
  assert.equal(tree.children[0].children[1],target);
  assert.equal(tree.children[1].type,Speaker);
  assert.equal(tree.children[1].props.text,"If you're ready, let's go.");
  assert.equal(tree.children[1].props.label,'原文');
  assert.equal(tree.children[2],copy);assert.equal(tree.children[3],collect);
 }
});
test('sentence rows keep original setup, scoped style, highlighted HTML and text refs while adding the raw source speaker',()=>{
 const f=fixture(),setup=()=>({originalHtml:'A <span class="highlight">future</span>.'});
 const original={type:'p',props:{class:'en-sentence',ref:'enSentenceRef',innerHTML:'A <span class="highlight">future</span>.'}};
 const base={__scopeId:'data-v-ac198712',setup,render:()=>({type:'div',props:{class:'sentence-container'},children:[{type:'div',props:{class:'sentence-inner-container'},children:[original]}]})};
 const root={components:{SentenceList:{components:{Sentence:base}}}},Speaker={name:'testSpeaker'};
 installSentenceVoices(root,f.req,()=>Speaker);
 const row=root.components.SentenceList.components.Sentence;
 assert.equal(row.setup,setup);assert.equal(row.__scopeId,base.__scopeId);
 const tree=row.render.call({data:{id:'row-A',original:'A future.'}}),inner=tree.children[0];
 assert.equal(inner.children[0],original);
 assert.equal(inner.props.style.paddingRight,'40px');
 const speech=childrenOfType(inner,Speaker)[0];assert.ok(speech);assert.equal(speech.props.text,'A future.');
});
test('the source speaker encodes the complete raw text and uses explicit English without a login call',()=>{
 const f=fixture(),text="  If you're ready & willing + able, let's go.\nA second line.  ";
 const render=createEnglishSpeaker(f.Vue).setup({text,label:'原文'}),tree=render(),voice=childrenOfType(tree,f.player)[0];
 assert.ok(voice);assert.equal(voice.props.word,encodeURIComponent(text.trim())+'&le=en');
 assert.equal(tree.children[0].children,'原文');assert.equal(tree.children[1],voice);
 assert.equal(tree.props.title,'播放英语原句');assert.equal(tree.props['aria-pressed'],false);
});
test('source labels and keyboard activation play, icon clicks do not play twice, and clicks never select the row',()=>{
 const f=fixture(),render=createEnglishSpeaker(f.Vue).setup({text:'A sentence.',label:''}),tree=render(),voice=childrenOfType(tree,f.player)[0];
 assert.ok(voice);let stopped=0,played=0,prevented=0;
 voice.props.ref.value={playAudio:()=>played++,stopVoice(){}};
 tree.props.onClick({target:{closest:()=>({})},stopPropagation:()=>stopped++});assert.equal(stopped,1);assert.equal(played,0);
 tree.props.onClick({target:{closest:()=>null},stopPropagation:()=>stopped++});assert.equal(stopped,2);assert.equal(played,1);
 tree.props.onKeydown({key:'Enter',stopPropagation:()=>stopped++,preventDefault:()=>prevented++});
 assert.equal(stopped,3);assert.equal(prevented,1);assert.equal(played,2);
});
test('changing text or leaving a kept-alive page stops only this speaker when it owns playback',()=>{
 const f=fixture(),props={text:'First sentence.',label:''},render=createEnglishSpeaker(f.Vue).setup(props),tree=render(),voice=childrenOfType(tree,f.player)[0];
 assert.ok(voice);let stopped=0;
 voice.props.ref.value={stopVoice:()=>stopped++};
 f.hooks.deactivate.forEach(cb=>cb());assert.equal(stopped,0);
 voice.props.onPlayStatusChange(true);assert.equal(render().props['aria-pressed'],true);
 props.text='Second sentence.';f.hooks.watch.forEach(w=>w.cb());assert.equal(stopped,1);
 voice.props.onPlayStatusChange(false);f.hooks.unmount.forEach(cb=>cb());assert.equal(stopped,1);
 voice.props.onPlayStatusChange(true);f.hooks.deactivate.forEach(cb=>cb());assert.equal(stopped,2);
});
test('empty text is disabled and cannot activate playback',()=>{
 const f=fixture(),render=createEnglishSpeaker(f.Vue).setup({text:'  ',label:''}),tree=render(),voice=childrenOfType(tree,f.player)[0];
 assert.ok(voice);assert.equal(voice.props.disabled,true);assert.equal(tree.props.tabindex,-1);
 let played=0;voice.props.ref.value={playAudio:()=>played++};
 tree.props.onKeydown({key:' ',stopPropagation(){},preventDefault(){}});assert.equal(played,0);
});
