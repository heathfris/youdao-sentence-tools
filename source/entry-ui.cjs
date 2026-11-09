function installFactoryHook(req,id,extend){
 function wrap(factory){
  if(factory.__ydSentenceTools)return factory;
  const wrapped=function(module,exports,...args){
   factory.call(this,module,exports,...args);
   try{extend(exports.default||module.exports.default,req);}
   catch(error){console.warn('Youdao sentence tools unavailable:',error?.message);}
  };
  wrapped.__ydSentenceTools=true;
  return wrapped;
 }
 if(req.m[id])req.m[id]=wrap(req.m[id]);
 const chunks=self.webpackChunkdict_desk_10,push=chunks.push;
 chunks.push=function(chunk){
  if(chunk[1]?.[id])chunk[1][id]=wrap(chunk[1][id]);
  return push.call(this,chunk);
 };
}
module.exports={installFactoryHook};
