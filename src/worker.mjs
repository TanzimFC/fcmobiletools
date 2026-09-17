const json=(data,status=200,headers={})=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8',...headers}});
import { REDEEM_CODES } from './data/redeemCodes.js';

export default {
  async fetch(request,env) {
    const url=new URL(request.url);
    if (url.pathname==='/admin' || url.pathname.startsWith('/admin/')) {
      return new Response('Not Found',{status:404,headers:{'content-type':'text/plain; charset=utf-8','cache-control':'no-store','x-robots-tag':'noindex, nofollow, noarchive'}});
    }
    if (url.pathname==='/api/public/redeem-codes') {
      return json({codes:REDEEM_CODES},200,{'cache-control':'no-store'});
    }
    if (url.pathname==='/api' || url.pathname.startsWith('/api/')) return json({error:'Not found'},404);
    if (url.pathname==='/redeem-codes' || url.pathname==='/redeem-codes/') {
      const response=await env.ASSETS.fetch(request);
      if (!response.headers.get('content-type')?.includes('text/html')) return response;
      const headers=new Headers(response.headers);
      headers.set('cache-control','no-store');
      return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
    }
    return env.ASSETS.fetch(request);
  }
};
