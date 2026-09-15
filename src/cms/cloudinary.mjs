const MAX=10*1024*1024;
export async function upload(req,env,user){
 if(!env.CLOUDINARY_CLOUD_NAME||!env.CLOUDINARY_API_KEY||!env.CLOUDINARY_API_SECRET)return new Response(JSON.stringify({error:'Cloudinary secrets are not configured'}),{status:500,headers:{'content-type':'application/json'}});
 const f=await req.formData(),file=f.get('file');
 if(!(file instanceof File))return err('Image file is required');
 if(file.size>MAX)return err('Image is larger than 10 MB');
 if(!String(file.type).startsWith('image/'))return err('Only images are allowed');
 const timestamp=Math.floor(Date.now()/1000),folder='tanzimfc/articles',base=`folder=${folder}&timestamp=${timestamp}`;
 const dig=new Uint8Array(await crypto.subtle.digest('SHA-1',new TextEncoder().encode(base+env.CLOUDINARY_API_SECRET)));
 const signature=[...dig].map(x=>x.toString(16).padStart(2,'0')).join('');
 const body=new FormData();body.set('file',file);body.set('api_key',env.CLOUDINARY_API_KEY);body.set('timestamp',String(timestamp));body.set('folder',folder);body.set('signature',signature);
 const r=await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(env.CLOUDINARY_CLOUD_NAME)}/image/upload`,{method:'POST',body}),x=await r.json().catch(()=>({}));
 if(!r.ok)return new Response(JSON.stringify({error:x?.error?.message||'Cloudinary upload failed'}),{status:502,headers:{'content-type':'application/json'}});
 return new Response(JSON.stringify({ok:true,image:{secureUrl:x.secure_url,publicId:x.public_id,width:x.width,height:x.height,format:x.format,uploadedBy:user.username}}),{status:201,headers:{'content-type':'application/json'}})
}
const err=m=>new Response(JSON.stringify({error:m}),{status:400,headers:{'content-type':'application/json'}});
