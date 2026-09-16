import { readdir } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';

const roots=['src'];
const files=[];
async function walk(dir){
  for(const name of await readdir(dir,{withFileTypes:true})){
    const p=path.join(dir,name.name);
    if(name.isDirectory()) await walk(p);
    else if(/\.m?js$/.test(name.name)) files.push(p);
  }
}
for(const root of roots) await walk(root);

for(const file of files){
  await new Promise((resolve,reject)=>{
    const child=spawn(process.execPath,['--check',file],{stdio:'inherit'});
    child.on('error',reject);
    child.on('exit',code=>code===0?resolve():reject(new Error(`Syntax check failed: ${file}`)));
  });
}
console.log(`Syntax check passed: ${files.length} JavaScript module(s).`);
