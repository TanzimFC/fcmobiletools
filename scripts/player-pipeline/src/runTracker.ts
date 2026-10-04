import { config } from "./config.ts";

const base = () => config.supabaseUrl.replace(/\/$/, "") + "/rest/v1";

function headers() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("Missing server-side Supabase key");
  return { apikey:key, Authorization:"Bearer "+key, "Content-Type":"application/json" };
}

async function request(path:string, method:string, body?:unknown) {
  const response = await fetch(base()+"/"+path, {
    method,
    headers:headers(),
    body:body === undefined ? undefined : JSON.stringify(body)
  });
  if (!response.ok) throw new Error("run tracker failed: "+response.status);
  return response;
}

export async function startRun(sourceName:string, mode:string) {
  const response = await request("player_sync_runs","POST",[{source_name:sourceName,mode,status:"started"}]);
  return response;
}

export async function saveRejected(runId:string, rows:unknown[]) {
  if (!rows.length) return;
  await request("player_import_quarantine","POST",rows.map((row:any)=>({...row,sync_run_id:runId})));
}