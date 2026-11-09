const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),vm=require('node:vm');
const {createExtension}=require('./extension.cjs');

const defaultProfile=require('../profiles/11.3.26.0.json');
const sha256=value=>crypto.createHash('sha256').update(value).digest('hex');

function within(root,relative){
 const result=path.resolve(root,relative),difference=path.relative(root,result);
 if(difference==='..'||difference.startsWith('..'+path.sep)||path.isAbsolute(difference))throw Error('Path is outside the selected directory');
 return result;
}

function buildPatch({applicationDirectory,outputDirectory=path.resolve(__dirname,'../local'),profile=defaultProfile}){
 if(!applicationDirectory)throw Error('Usage: node source/build.cjs "D:\\Apps\\Youdao\\Dict"');
 const app=path.resolve(applicationDirectory),output=path.resolve(outputDirectory),html=within(app,profile.version+'/resultui/html');
 if(output===app||output.startsWith(app+path.sep))throw Error('Build output must be outside the Youdao installation');
 const executable=fs.readFileSync(within(app,'YoudaoDict.exe'));
 if(sha256(executable)!==profile.executableSha256)throw Error('Unsupported Youdao executable fingerprint; no files changed');
 for(const dependency of profile.dependencies){
  if(sha256(fs.readFileSync(within(html,dependency.path)))!==dependency.sha256)throw Error('Dependency fingerprint differs: '+dependency.path+'; no files changed');
 }
 const manifestPath=within(output,'manifest.json');
 const previous=fs.existsSync(manifestPath)?JSON.parse(fs.readFileSync(manifestPath,'utf8')):null;
 const previousTheme=previous?.version===profile.version?previous.files?.find(file=>file.path==='libs/theme-init.js'):null;
 const knownThemes=new Set([...profile.knownThemePatches,previousTheme?.patched].filter(Boolean));
 const originals=new Map();
 for(const file of profile.files){
  let bytes=fs.readFileSync(within(html,file.path));
  const current=sha256(bytes);
  if(current!==file.original){
   if(file.path!=='libs/theme-init.js'||!knownThemes.has(current))throw Error('Unknown file fingerprint: '+file.path+'. Restore an older entry-file patch first; no files changed');
   bytes=bytes.subarray(0,profile.themeOriginalBytes);
   if(sha256(bytes)!==file.original)throw Error('Original theme prefix fingerprint differs; no files changed');
  }
  originals.set(file.name,bytes);
  const backup=within(output,'original/'+file.name);
  if(fs.existsSync(backup)&&sha256(fs.readFileSync(backup))!==file.original)throw Error('Local original backup fingerprint differs: '+file.name+'; no files changed');
 }
 const main=originals.get('mainV2.js').toString('utf8');
 const marker=profile.sharedModule.id+':function',start=main.indexOf(marker),end=start<0?null:/},\d+:function\(/.exec(main.slice(start+20));
 if(start<0||!end)throw Error('Unsupported local collection helper; no files changed');
 const shared=main.slice(start,start+20+end.index+1);
 if(shared.length!==profile.sharedModule.length)throw Error('Unexpected local collection helper size; no files changed');
 const theme=Buffer.concat([originals.get('theme-init.js'),Buffer.from(createExtension(shared))]);
 new vm.Script(theme.toString('utf8'));
 const files=profile.files.map(file=>{
  const patched=file.name==='theme-init.js'?theme:originals.get(file.name);
  const old=previous?.version===profile.version?previous.files?.find(item=>item.path===file.path):null;
  const known=file.name==='theme-init.js'?profile.knownThemePatches:[];
  return {...file,patched:sha256(patched),previous:[...new Set([...known,...(old?.previous||[]),old?.patched].filter(hash=>hash&&hash!==file.original&&hash!==sha256(patched)))]};
 });
 const manifest={version:profile.version,patchRevision:profile.patchRevision,defaultApplicationDirectory:app,executableSha256:profile.executableSha256,files,dependencies:profile.dependencies};
 // All installed inputs and any existing original backups are validated before writing local output.
 fs.mkdirSync(within(output,'original'),{recursive:true});fs.mkdirSync(within(output,'patched'),{recursive:true});
 for(const file of files){
  const original=originals.get(file.name),backup=within(output,'original/'+file.name);
  if(!fs.existsSync(backup))fs.writeFileSync(backup,original);
  fs.writeFileSync(within(output,'patched/'+file.name),file.name==='theme-init.js'?theme:original);
 }
 fs.writeFileSync(manifestPath,JSON.stringify(manifest,null,2)+'\n');
 return manifest;
}

if(require.main===module){
 try{
  const manifest=buildPatch({applicationDirectory:process.argv[2],outputDirectory:process.argv[3]});
  console.log('Prepared revision '+manifest.patchRevision+' from this local Youdao installation.');
 }catch(error){console.error(error.message);process.exitCode=1;}
}

module.exports={buildPatch,sha256};
