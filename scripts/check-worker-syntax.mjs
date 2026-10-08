import { readdir, readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';

const roots=['src'];
const files=[];
async function walk(dir){
  for(const name of await readdir(dir,{withFileTypes:true})){
    const p=path.join(dir,name.name);
    if(name.isDirectory()) await walk(p);
    else files.push(p);
  }
}
for(const root of roots) await walk(root);

const sourceFiles=files.filter((file)=>/\.(?:astro|c?m?js|ts|tsx|css|json)$/i.test(file));

for(const file of sourceFiles){
  const raw=await readFile(file);
  if(raw.includes(0)){
    throw new Error(`Source encoding check failed: ${file} contains NUL bytes. The file is likely UTF-16 or otherwise incorrectly encoded; save it as UTF-8.`);
  }
}

const jsFiles=files.filter((file)=>/\.m?js$/i.test(file));

for(const file of jsFiles){
  await new Promise((resolve,reject)=>{
    const child=spawn(process.execPath,['--check',file],{stdio:'inherit'});
    child.on('error',reject);
    child.on('exit',code=>code===0?resolve():reject(new Error(`Syntax check failed: ${file}`)));
  });
}

console.log(`Source encoding check passed: ${sourceFiles.length} source file(s).`);
console.log(`Syntax check passed: ${jsFiles.length} JavaScript module(s).`);
