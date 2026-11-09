const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {buildPatch,sha256}=require('./build.cjs');

// Fixtures contain only test-authored text, never Youdao resources.
function fixture(t){
 const prefix=path.resolve(os.tmpdir(),'youdao-tools-test-'),root=fs.mkdtempSync(prefix);
 t.after(()=>{const target=path.resolve(root);if(!target.startsWith(prefix))throw Error('Unexpected fixture cleanup target');fs.rmSync(target,{recursive:true,force:true});});
 const app=path.join(root,'app'),output=path.join(root,'state'),version='fixture';
 const html=path.join(app,version,'resultui/html');fs.mkdirSync(path.join(html,'js'),{recursive:true});fs.mkdirSync(path.join(html,'libs'),{recursive:true});
 const shared='69788:function(module,exports,req){exports.fixture=true;}';
 const contents={'js/mainV2.js':`var fixture={${shared},12345:function(){}};`,'js/mini.js':'void "mini fixture";','ydDict/mini.html':'<html>mini fixture</html>','index_v2.html':'<html>main fixture</html>','libs/theme-init.js':'void "theme fixture";\n'};
 fs.writeFileSync(path.join(app,'YoudaoDict.exe'),'executable fixture');
 const files=Object.entries(contents).map(([relative,text])=>{
  const target=path.join(html,relative);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,text);
  return {path:relative,name:path.basename(relative),original:sha256(Buffer.from(text))};
 });
 fs.writeFileSync(path.join(html,'js/dependency.js'),'dependency fixture');
 const profile={version,patchRevision:5,executableSha256:sha256(Buffer.from('executable fixture')),sharedModule:{id:69788,length:Buffer.byteLength(shared)},themeOriginalBytes:Buffer.byteLength(contents['libs/theme-init.js']),knownThemePatches:[],files,dependencies:[{path:'js/dependency.js',sha256:sha256(Buffer.from('dependency fixture'))}]};
 return {app,output,html,contents,profile,build:()=>buildPatch({applicationDirectory:app,outputDirectory:output,profile})};
}

test('building preserves original entries and produces verified local backups without changing the installation',t=>{
 const f=fixture(t),manifest=f.build();
 for(const file of manifest.files){
  assert.equal(sha256(fs.readFileSync(path.join(f.html,file.path))),file.original);
  assert.equal(sha256(fs.readFileSync(path.join(f.output,'original',file.name))),file.original);
  const actual=sha256(fs.readFileSync(path.join(f.output,'patched',file.name)));assert.equal(actual,file.patched);
  assert.equal(file.original===file.patched,file.name!=='theme-init.js');
 }
});

test('a previously generated theme can be rebuilt from its original prefix and local manifest',t=>{
 const f=fixture(t),first=f.build(),theme=first.files.find(file=>file.name==='theme-init.js');
 fs.copyFileSync(path.join(f.output,'patched/theme-init.js'),path.join(f.html,'libs/theme-init.js'));
 const second=f.build();assert.equal(second.files.find(file=>file.name==='theme-init.js').patched,theme.patched);
 assert.equal(sha256(fs.readFileSync(path.join(f.output,'original/theme-init.js'))),theme.original);
});

test('unknown installed fingerprints fail before creating backup or build output',t=>{
 for(const relative of ['js/dependency.js','libs/theme-init.js','js/mini.js']){
  const f=fixture(t);fs.appendFileSync(path.join(f.html,relative),' changed');
  assert.throws(f.build,/fingerprint/);assert.equal(fs.existsSync(f.output),false);
 }
});

test('a damaged original backup is rejected and never overwritten',t=>{
 const f=fixture(t);f.build();const backup=path.join(f.output,'original/theme-init.js');
 fs.writeFileSync(backup,'damaged backup');const manifest=fs.readFileSync(path.join(f.output,'manifest.json'));
 assert.throws(f.build,/backup fingerprint/);assert.equal(fs.readFileSync(backup,'utf8'),'damaged backup');
 assert.deepEqual(fs.readFileSync(path.join(f.output,'manifest.json')),manifest);
});
