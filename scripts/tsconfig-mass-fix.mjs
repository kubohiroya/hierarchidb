#!/usr/bin/env node
/**
 * tsconfig-mass-fix.mjs
 * TS 4.9 前提の安定化ポリシーを一括適用します。
 *
 * 使い方:
 *   node scripts/tsconfig-mass-fix.mjs            # 乾式（差分のみ表示）
 *   node scripts/tsconfig-mass-fix.mjs --apply    # 実書き込み
 *   node scripts/tsconfig-mass-fix.mjs --apply --run-typecheck  # 書き込み後に pnpm -w typecheck 実行
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

const args = new Set(process.argv.slice(2));
const APPLY = args.has('--apply');
const RUN_TYPECHECK = args.has('--run-typecheck');

const CWD = process.cwd();
const IGNORE_DIRS = new Set(['node_modules', '.git', 'dist', 'build', 'coverage', '.turbo', '.next', 'out']);

// 既知の例外: 第三者型のノイズ、TS5前提のd.tsなど
const SKIP_LIBCHECK = new Set([
  'packages/ui/map',
  'packages/util',
  'packages/ui/i18n',
  'packages/runtime-shared/batch-processor',
  'packages/ui/dialog',
  'packages/ui/tour',
  'packages/feature/download',
]);

// 既知: jest/vitest/vite の ambient を避けて types を制限する
const TYPES_NODE = new Set([
  'packages/ui/core',
  'packages/ui/i18n',
  'packages/common/api',
]);

// 既知: DOM 型が必要
const ADD_DOM_LIB = new Set([
  'packages/common/api',
]);

function stripJsonc(s){
  let out='',i=0,inStr=false,q='',esc=false,inLine=false,inBlock=false;
  while(i<s.length){
    const ch=s[i],nx=s[i+1];
    if(inLine){ if(ch==='\n'){inLine=false;out+=ch;} i++; continue; }
    if(inBlock){ if(ch==='*'&&nx=== '/') {inBlock=false; i+=2; continue;} i++; continue; }
    if(inStr){ out+=ch; if(esc){esc=false;} else if(ch==='\\'){esc=true;} else if(ch===q){inStr=false;q='';} i++; continue; }
    if(ch==='"'||ch==='\''){ inStr=true;q=ch; out+=ch; i++; continue; }
    if(ch==='/'&&nx==='/' ){ inLine=true; i+=2; continue; }
    if(ch==='/'&&nx==='*' ){ inBlock=true; i+=2; continue; }
    out+=ch; i++;
  }
  // 末尾カンマ除去
  let res='',str=false,qq='',es=false;
  for(let j=0;j<out.length;j++){
    const c=out[j];
    if(str){ res+=c; if(es){es=false;} else if(c==='\\'){es=true;} else if(c===qq){str=false;qq='';} continue; }
    if(c==='"'||c==='\''){str=true;qq=c;res+=c;continue;}
    if(c===','){
      let k=j+1; while(k<out.length && /\s/.test(out[k])) k++;
      if(out[k]===']'||out[k]==='}') { j=k-1; continue; }
    }
    res+=c;
  }
  return res;
}

async function findTsconfigs(dir, acc){
  const ents = await fs.readdir(dir, { withFileTypes: true });
  for(const e of ents){
    if(e.isDirectory()){
      if(IGNORE_DIRS.has(e.name)) continue;
      await findTsconfigs(path.join(dir, e.name), acc);
    }else if(e.isFile()){
      const n = e.name.toLowerCase();
      if(n==='tsconfig.json' || (n.startsWith('tsconfig') && n.endsWith('.json'))){
        acc.push(path.join(dir, e.name));
      }
    }
  }
}

function relFromRoot(p){ return path.relative(CWD, p).replace(/\\/g,'/'); }
function relDir(p){ return relFromRoot(path.dirname(p)); }

function normalizeTsconfig(json, pkgRelPath){
  const j = json; j.compilerOptions ||= {}; const co = j.compilerOptions;

  // 1) moduleResolution を node に統一
  if(co.moduleResolution && /^(bundler|nodenext|node16)$/i.test(String(co.moduleResolution))){
    co.moduleResolution = 'node';
  }
  // 2) jsx を react-jsx に統一
  if(co.jsx && co.jsx !== 'react-jsx') co.jsx = 'react-jsx';
  // 3) include から外部パッケージのソース参照（../../common/types/src/**）を除去
  if(Array.isArray(j.include)){
    j.include = j.include.filter(p => !p.includes('../../common/types/src/'));
  }
  // 4) rootDir を src に戻す（src が参照されている場合）
  if(Array.isArray(j.include) && j.include.some(p=>String(p).startsWith('src'))){
    co.rootDir = 'src';
  }
  // 5) 既知パッケージに skipLibCheck
  if(SKIP_LIBCHECK.has(pkgRelPath)) co.skipLibCheck = true;
  // 6) 既知パッケージは types=["node"] に限定
  if(TYPES_NODE.has(pkgRelPath)) co.types = ['node'];
  // 7) DOM ライブラリ追加
  if(ADD_DOM_LIB.has(pkgRelPath)){
    const need = new Set(['ES2022','DOM','DOM.Iterable']);
    const cur = new Set(co.lib || []);
    co.lib = Array.from(new Set([...cur, ...need]));
  }
  return j;
}

async function main(){
  const files=[]; await findTsconfigs(CWD, files);
  const changes=[];
  for(const f of files){
    const rel = relFromRoot(f);
    const pkgRel = relDir(f);
    let json; try{ json = JSON.parse(stripJsonc(await fs.readFile(f,'utf8')));}catch{ continue; }
    const before = JSON.stringify(json);
    const afterObj = normalizeTsconfig(json, pkgRel);
    const after = JSON.stringify(afterObj);
    if(before !== after){
      changes.push(rel);
      if(APPLY){ await fs.writeFile(f, JSON.stringify(afterObj,null,2)+'\n', 'utf8'); }
    }
  }
  if(changes.length===0){ console.log('No changes.'); }
  else{
    console.log((APPLY?'Applied':'Would change')+` ${changes.length} file(s):`);
    changes.forEach(c=>console.log(' - '+c));
  }
  if(APPLY && RUN_TYPECHECK){
    await new Promise((resolve)=>{
      const p = spawn('pnpm',['-w','typecheck'],{stdio:'inherit', shell:true});
      p.on('close',()=>resolve());
    });
  }
}

main().catch(e=>{ console.error(e); process.exit(1); });

