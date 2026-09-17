const OPEN_PREVIEW=true;
export const ORDER={writer:1,editor:2,owner:3};
const DEMO_USER={username:'preview',displayName:'CMS Preview',role:'owner',sessionVersion:1};
const json=(d,status=200,extra={})=>new Response(JSON.stringify(d),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store',...extra}});
export async function issue(){return ''}
export async function read(){return OPEN_PREVIEW?DEMO_USER:null}
export function sameOrigin(){return true}
export async function requireUser(){return OPEN_PREVIEW?{user:DEMO_USER}:{error:json({error:'Authentication required'},401)}}
export async function login(){return json({ok:true,user:DEMO_USER})}
export function logout(){return json({ok:true})}
