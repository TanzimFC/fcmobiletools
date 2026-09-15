import { randomBytes, webcrypto } from 'node:crypto';
const password=process.argv[2];
if(!password){console.error('Usage: node scripts/cms-password.mjs "your-password"');process.exit(1)}
const iterations=210000,salt=randomBytes(16),key=await webcrypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveBits']);
const bits=new Uint8Array(await webcrypto.subtle.deriveBits({name:'PBKDF2',salt,iterations,hash:'SHA-256'},key,256));
const b64u=x=>Buffer.from(x).toString('base64url');
console.log(`pbkdf2$${iterations}$${b64u(salt)}$${b64u(bits)}`);
