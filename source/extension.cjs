const {createCollector}=require('./collector.cjs');
const {installSentenceCollection}=require('./install-ui.cjs');
const {createEnglishSpeaker,installMiniVoices,installSentenceVoices}=require('./voice-ui.cjs');
const {installFactoryHook}=require('./entry-ui.cjs');

function createExtension(shared){
 const mini=`function(root,req){(${installSentenceCollection})(root,req,${createCollector});(${installMiniVoices})(root,req,${createEnglishSpeaker});}`;
 const book=`function(root,req){(${installSentenceVoices})(root,req,${createEnglishSpeaker});}`;
 return `\n;(()=>{const mini=/\\/mini\\.html$/.test(location.pathname),main=/\\/index_v2\\.html$/.test(location.pathname);if(!mini&&!main)return;(self.webpackChunkdict_desk_10=self.webpackChunkdict_desk_10||[]).push([[9182306],mini?{${shared}}:{},req=>Promise.resolve().then(()=>{(${installFactoryHook})(req,mini?14806:96239,mini?${mini}:${book});})]);})();\n`;
}

module.exports={createExtension};
