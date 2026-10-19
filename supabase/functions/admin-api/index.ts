import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { adminAuthorizationFailure } from "./authorization.js";
const url=Deno.env.get("SUPABASE_URL")!;
const serviceKey=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const anonKey=Deno.env.get("SUPABASE_ANON_KEY")!;
const db=createClient(url,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}});
const authClient=createClient(url,anonKey,{auth:{persistSession:false,autoRefreshToken:false}});
function isAllowedOrigin(origin: string) {
  try {
    const u = new URL(origin);
    if (u.protocol === "http:" && ["localhost", "127.0.0.1"].includes(u.hostname) && u.port === "5173") return true;
    return u.protocol === "https:" && (
      u.hostname === "invest-broker-user-portal-ecc83k.v2.appdeploy.ai" ||
      u.hostname === "invest-broker-admin-portal-jmjsyw.v2.appdeploy.ai" ||
      u.hostname === "invest-broker.vercel.app" ||
      u.hostname === "admin-invest-broker.vercel.app" ||
      u.hostname === "invest-broker-user.pages.dev" ||
      u.hostname.endsWith(".invest-broker-user.pages.dev") ||
      u.hostname === "invest-broker-admin.pages.dev" ||
      u.hostname.endsWith(".invest-broker-admin.pages.dev") ||
      (u.hostname.startsWith("invest-broker-") && u.hostname.endsWith(".vercel.app")) ||
      (u.hostname.startsWith("admin-invest-broker-") && u.hostname.endsWith(".vercel.app"))
    );
  } catch { return false; }
}
function json(req:Request,body:unknown,status=200){
 const origin=req.headers.get("origin")??"";
 const headers=new Headers({"content-type":"application/json","cache-control":"no-store","vary":"Origin"});
 if(isAllowedOrigin(origin)){headers.set("access-control-allow-origin",origin);headers.set("access-control-allow-headers","authorization, apikey, content-type, x-client-info");headers.set("access-control-allow-methods","GET, POST, OPTIONS");}
 return new Response(JSON.stringify(body),{status,headers});
}
Deno.serve(async req=>{
 if(req.method==="OPTIONS") return json(req,{});
 if(!["GET","POST"].includes(req.method)) return json(req,{error:"Method not allowed"},405);
 const origin=req.headers.get("origin")??"";
 if(origin&&!isAllowedOrigin(origin)) return json(req,{error:"Origin not allowed"},403);
 const header=req.headers.get("authorization")??"";
 const token=header.startsWith("Bearer ")?header.slice(7):"";
 if(!token) return json(req,{error:"Authentication required"},401);
 const {data:{user},error:authError}=await authClient.auth.getUser(token);
 if(authError||!user) return json(req,{error:"Invalid or expired session"},401);
 const {data:claimsData,error:claimsError}=await authClient.auth.getClaims(token);
 if(claimsError) return json(req,{error:"Unable to verify session assurance"},403);
 const {data:adminProfile,error:profileError}=await db.from("profiles").select("account_status,approval_status").eq("id",user.id).maybeSingle();
 if(profileError) return json(req,{error:"Unable to verify administrator account status"},500);
 const {data:control,error:controlError}=await db.from("platform_control").select("primary_admin_user_id").eq("singleton",true).maybeSingle();
 if(controlError) return json(req,{error:"Unable to verify primary administrator configuration"},500);
 const authorizationFailure=adminAuthorizationFailure({user,claims:claimsData?.claims,profile:adminProfile,primaryAdminId:control?.primary_admin_user_id});
 if(authorizationFailure) return json(req,{error:authorizationFailure.message},authorizationFailure.status);
 const urlObj=new URL(req.url); const route=urlObj.pathname.split("/").filter(Boolean).slice(-1)[0]??"dashboard";
 const allowedRoutes=new Set(["dashboard","wallets","users","investments","investment-plans","returns","deposits","withdrawals","compliance","treasury","audit-logs"]);
 if(!allowedRoutes.has(route)) return json(req,{error:"Route not found"},404);
 if(req.method==="POST") {
  if(route!=="users") return json(req,{error:"Only account approval actions are enabled in this endpoint"},405);
  const payload=await req.json().catch(()=>null);
  const action=payload?.action;
  const userId=typeof payload?.user_id==="string"?payload.user_id:"";
  if(!["approve","reject"].includes(action)||! /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId)) return json(req,{error:"Provide a valid user_id and approve/reject action"},400);
  const reason=typeof payload?.reason==="string"?payload.reason.trim().slice(0,500):"";
  const {data:updated,error:reviewError}=await db.rpc("review_customer_account",{p_user_id:userId,p_action:action,p_actor_id:user.id,p_reason:reason||null});
  if(reviewError) {
   const message=reviewError.message||"Account review failed";
   const status=message.includes("not found")?404:message.includes("Only pending")?409:400;
   return json(req,{error:message},status);
  }
  return json(req,{data:updated},200);
 }
 const limit=Math.min(Math.max(Number(urlObj.searchParams.get("limit")??100),1),200);
 try{
  if(route==="dashboard"){
   const results=await Promise.all([
    db.from("profiles").select("id",{count:"exact",head:true}).neq("id",control.primary_admin_user_id),
    db.from("investments").select("id",{count:"exact",head:true}).in("status",["active","matured"]),
    db.from("deposits").select("id",{count:"exact",head:true}).in("status",["pending","processing"]),
    db.from("withdrawals").select("id",{count:"exact",head:true}).in("status",["pending","under_review"]),
    db.from("compliance_cases").select("id",{count:"exact",head:true}).in("status",["open","in_review","on_hold"])
   ]);
   for(const result of results) if(result.error) throw result.error;
   return json(req,{data:{users:results[0].count??0,activeOrMaturedInvestments:results[1].count??0,pendingDeposits:results[2].count??0,pendingWithdrawals:results[3].count??0,openComplianceCases:results[4].count??0}});
  }
  const specs:Record<string,{table:string;select:string}> = {
   wallets:{table:"wallets",select:"id,wallet_code,user_id,currency,status,created_at"},
   users:{table:"profiles",select:"id,user_code,full_name,phone,kyc_status,account_status,approval_status,approval_reviewed_by,approval_reviewed_at,approval_reason,created_at,updated_at"},
   investments:{table:"investments",select:"id,investment_code,user_id,plan_id,principal,currency,status,started_at,maturity_at,created_at"},
   "investment-plans":{table:"investment_plans",select:"id,name,description,currency,minimum_amount,maximum_amount,duration_days,return_rate,return_method,withdrawal_window_days,is_active,terms_version,created_at,updated_at"},
   returns:{table:"ledger_entries",select:"id,user_id,wallet_id,entry_type,amount,currency,status,reference,related_entity_type,related_entity_id,description,created_at,posted_at"},
   deposits:{table:"deposits",select:"id,deposit_code,user_id,amount,currency,status,provider,provider_reference,created_at,confirmed_at"},
   withdrawals:{table:"withdrawals",select:"id,withdrawal_code,user_id,amount,currency,status,provider,provider_reference,reviewed_by,review_reason,created_at,reviewed_at,completed_at"},
   compliance:{table:"compliance_cases",select:"id,user_id,case_type,status,risk_level,summary,assigned_to,resolution,created_at,resolved_at"},
   treasury:{table:"treasury_accounts",select:"id,account_name,currency,provider,external_reference,status,created_at"},
   "audit-logs":{table:"audit_logs",select:"id,actor_id,actor_role,action,entity_type,entity_id,request_id,reason,before_state,after_state,created_at"}
  };
  const spec=specs[route]; if(!spec) return json(req,{error:"Route not found"},404);
  let query=db.from(spec.table).select(spec.select).order("created_at",{ascending:false}).limit(limit);
  const userId=urlObj.searchParams.get("user_id");
  if(userId&&["investments","returns","deposits","withdrawals"].includes(route)) query=query.eq("user_id",userId);
  if(route==="users") query=query.neq("id",control.primary_admin_user_id);
  const {data,error}=await query; if(error) throw error;
  return json(req,{data:data??[]});
 }catch(error){console.error("admin-api error",error);return json(req,{error:"Unable to retrieve requested admin data"},500);}
});