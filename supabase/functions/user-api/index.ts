import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
const url = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
const db = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
const authClient = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
function isAllowedOrigin(origin: string) { try { const u = new URL(origin); if (u.protocol === "http:" && ["localhost", "127.0.0.1"].includes(u.hostname) && u.port === "5173") return true; return u.protocol === "https:" && (u.hostname === "invest-broker.vercel.app" || (u.hostname.startsWith("invest-broker-") && u.hostname.endsWith(".vercel.app"))); } catch { return false; } }
function json(req: Request, body: unknown, status = 200) {
  const origin = req.headers.get("origin") ?? "";
  const headers = new Headers({"content-type":"application/json","cache-control":"no-store","vary":"Origin"});
  if (isAllowedOrigin(origin)) { headers.set("access-control-allow-origin",origin); headers.set("access-control-allow-headers","authorization, apikey, content-type, x-client-info"); headers.set("access-control-allow-methods","GET, POST, OPTIONS"); }
  return new Response(JSON.stringify(body),{status,headers});
}
Deno.serve(async req => {
  if (req.method === "OPTIONS") return json(req,{});
  if (!["GET","POST"].includes(req.method)) return json(req,{error:"Method not allowed; financial mutations are not enabled."},405);
  const origin=req.headers.get("origin")??"";
  if (origin && !isAllowedOrigin(origin)) return json(req,{error:"Origin not allowed"},403);
  const header=req.headers.get("authorization")??"";
  const token=header.startsWith("Bearer ")?header.slice(7):"";
  if (!token) return json(req,{error:"Authentication required"},401);
  const {data:{user},error:authError}=await authClient.auth.getUser(token);
  if(authError||!user) return json(req,{error:"Invalid or expired session"},401);
  if(user.app_metadata?.role==="admin") return json(req,{error:"Use the Admin API for privileged accounts"},403);
  const route=new URL(req.url).pathname.split("/").filter(Boolean).slice(-1)[0]??"me";
  const {data:profile,error:profileError}=await db.from("profiles").select("id,approval_status,account_status").eq("id",user.id).maybeSingle();
  if(profileError) return json(req,{error:"Unable to verify account approval"},500);
  if(!profile) return json(req,{error:"Customer profile is not provisioned"},403);
  if(route!=="me"&&route!=="profile"&&profile.approval_status!=="approved") {
    return json(req,{error:profile.approval_status==="rejected"?"Account application rejected":"Administrator approval is required before account access"},403);
  }
  if(route!=="me"&&route!=="profile"&&profile.account_status!=="active") {
    return json(req,{error:"This account is not active"},403);
  }
  try {
    if (req.method === "POST" && route === "support") {
      const payload = await req.json().catch(() => null);
      const subject = typeof payload?.subject === "string" ? payload.subject.trim().slice(0,200) : "Customer support";
      const body = typeof payload?.body === "string" ? payload.body.trim() : "";
      if (!body || body.length > 10000) return json(req,{error:"Message must contain between 1 and 10000 characters"},400);
      const { data, error } = await db.from("support_messages").insert({user_id:user.id,sender_id:user.id,sender_role:"user",subject,body}).select("id,subject,body,sender_role,created_at").single();
      if (error) throw error;
      return json(req,{data},201);
    }
    if (req.method === "POST") return json(req,{error:"This action is not enabled"},405);
    if(route==="me"||route==="profile"){
      const {data,error}=await db.from("profiles").select("id,user_code,full_name,phone,kyc_status,account_status,approval_status,created_at,updated_at").eq("id",user.id).maybeSingle();
      if(error) throw error; return json(req,{data});
    }
    const map:Record<string,{table:string;select:string;owner:string;limit:number}> = {
      wallet:{table:"wallets",select:"id,wallet_code,user_id,currency,status,created_at",owner:"user_id",limit:1},
      investments:{table:"investments",select:"id,investment_code,plan_id,principal,currency,status,started_at,maturity_at,created_at",owner:"user_id",limit:100},
      transactions:{table:"ledger_entries",select:"id,wallet_id,entry_type,amount,currency,status,reference,related_entity_type,related_entity_id,description,created_at,posted_at",owner:"user_id",limit:200},
      deposits:{table:"deposits",select:"id,deposit_code,amount,currency,status,provider,created_at,confirmed_at",owner:"user_id",limit:100},
      withdrawals:{table:"withdrawals",select:"id,withdrawal_code,amount,currency,status,created_at,reviewed_at,completed_at",owner:"user_id",limit:100},
      support:{table:"support_messages",select:"id,subject,body,sender_role,read_at,created_at",owner:"user_id",limit:100}
    };
    if(route==="investment-plans"){
      const {data,error}=await db.from("investment_plans").select("id,name,description,currency,minimum_amount,maximum_amount,duration_days,return_rate,return_method,withdrawal_window_days,terms_version").eq("is_active",true).order("minimum_amount").limit(100);
      if(error) throw error; return json(req,{data:data??[]});
    }
    const spec=map[route]; if(!spec) return json(req,{error:"Route not found"},404);
    let q=db.from(spec.table).select(spec.select).eq(spec.owner,user.id).order("created_at",{ascending:false}).limit(spec.limit);
    if(route==="wallet") q=db.from(spec.table).select(spec.select).eq(spec.owner,user.id).limit(1);
    const {data,error}=await q; if(error) throw error;
    return json(req,{data:route==="wallet"?(data?.[0]??null):(data??[])});
  } catch(error) { console.error("user-api error",error); return json(req,{error:"Unable to retrieve requested data"},500); }
});