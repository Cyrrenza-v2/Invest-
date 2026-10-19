import React, {useEffect,useMemo,useState} from "react";
import {createRoot} from "react-dom/client";
import {createClient} from "@supabase/supabase-js";
import {Activity,AlertTriangle,ArrowDownLeft,ArrowUpRight,BadgeCheck,Banknote,BriefcaseBusiness,ChartNoAxesCombined,CheckCircle2,ChevronRight,ClipboardCheck,FileBarChart2,FileClock,FileText,Landmark,LayoutDashboard,LockKeyhole,LogOut,Menu,MessageSquareText,RefreshCw,Search,Settings,ShieldAlert,ShieldCheck,Users,Wallet,X,BrainCircuit,CalendarClock} from "lucide-react";
import { Analytics } from "@vercel/analytics/react";
import "./admin.css";
import { getAdminPath, resolveAdminRoute } from "./routing.js";
const URL=import.meta.env.VITE_SUPABASE_URL||"https://rjgzvpkyccfpnpzlbcuc.supabase.co";
const KEY=import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const db=KEY?createClient(URL,KEY,{auth:{storageKey:"invest-broker-admin-auth-v1",persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}}):null;
const adminApi=`${URL}/functions/v1/admin-api`;
async function callAdminApi(session,route,options={},refreshSession){const {expectArray=true,...fetchOptions}=options;let activeSession=session;for(let attempt=0;attempt<2;attempt++){const response=await fetch(`${adminApi}/${route}`,{...fetchOptions,headers:{Authorization:`Bearer ${activeSession?.access_token||""}`,apikey:KEY,"Content-Type":"application/json",...(fetchOptions.headers||{})}});const payload=await response.json().catch(()=>null);if(response.status===401&&attempt===0&&refreshSession){activeSession=await refreshSession();if(activeSession)continue;}if(!response.ok)throw new Error(`Admin API ${route} failed (${response.status}): ${payload?.error||response.statusText||"request rejected"}`);if(!payload||!Object.prototype.hasOwnProperty.call(payload,"data"))throw new Error(`Admin API ${route} returned an invalid response payload`);if(expectArray&&!Array.isArray(payload.data))throw new Error(`Admin API ${route} returned an unexpected data shape`);return payload.data;}throw new Error(`Admin API ${route} session refresh failed; sign in again`);}
const fmt=(n,currency="USD")=>new Intl.NumberFormat("en-US",{style:"currency",currency,maximumFractionDigits:2}).format(Number(n||0));
const dt=v=>v?new Intl.DateTimeFormat("en-NG",{dateStyle:"medium"}).format(new Date(v)):"—";
const nav=[["Dashboard",LayoutDashboard],["Wallets",Wallet],["Users",Users],["Investments",BriefcaseBusiness],["Investment Plans",ChartNoAxesCombined],["Profit Management",Banknote],["Deposits",ArrowDownLeft],["Withdrawals",ArrowUpRight],["Treasury",Landmark],["Compliance",ShieldAlert],["AI Assistant",BrainCircuit],["Reports",FileBarChart2],["Audit Logs",FileClock],["Settings",Settings]];
const tableFor={"Wallets":"wallets","Users":"profiles","Investments":"investments","Investment Plans":"investment_plans","Profit Management":"ledger_entries","Deposits":"deposits","Withdrawals":"withdrawals","Treasury":"treasury_accounts","Compliance":"compliance_cases","Audit Logs":"audit_logs"};
function AdminApp(){
 const [session,setSession]=useState(null),[roleChecked,setRoleChecked]=useState(false),[mfaVerified,setMfaVerified]=useState(false),[mfaEnrolled,setMfaEnrolled]=useState(null),[enrollment,setEnrollment]=useState(null),[section,setSection]=useState(()=>resolveAdminRoute(window.location.pathname).section),[rows,setRows]=useState({}),[loading,setLoading]=useState(false),[liveStatus,setLiveStatus]=useState("connecting"),[notice,setNotice]=useState(""),[email,setEmail]=useState("udofiaasianubong583@gmail.com"),[password,setPassword]=useState(""),[confirmPassword,setConfirmPassword]=useState(""),[authMode,setAuthMode]=useState("login"),[mfaCode,setMfaCode]=useState(""),[busy,setBusy]=useState(false),[search,setSearch]=useState(""),[navOpen,setNavOpen]=useState(false),[aiPrompt,setAiPrompt]=useState(""),[aiMessages,setAiMessages]=useState([{by:"assistant",text:"I can help prepare read-only analyses from verified platform records. I cannot approve payments, modify the ledger, or bypass compliance."}]),[adminCurrency,setAdminCurrency]=useState("USD");
 const manager=session?.user?.app_metadata?.role==="admin"; const adminReady=!!session&&manager&&mfaVerified;
 useEffect(()=>{const syncRoute=()=>setSection(resolveAdminRoute(window.location.pathname).section);syncRoute();window.addEventListener("popstate",syncRoute);return()=>window.removeEventListener("popstate",syncRoute)},[]);
 useEffect(()=>{if(!db){setRoleChecked(true);return;} db.auth.getSession().then(async({data})=>{setSession(data.session);if(data.session&&data.session.user?.app_metadata?.role==="admin"){const {data:aal}=await db.auth.mfa.getAuthenticatorAssuranceLevel();setMfaVerified(aal?.currentLevel==="aal2");const {data:factors}=await db.auth.mfa.listFactors();setMfaEnrolled(!!factors?.totp?.some(f=>f.status==="verified"));}setRoleChecked(true)});const {data:sub}=db.auth.onAuthStateChange((_e,s)=>{setSession(s);if(!s){setMfaVerified(false);setMfaEnrolled(null);setEnrollment(null);}setRoleChecked(true)});return()=>sub.subscription.unsubscribe()},[]);
 const bootstrapAdmin=async activeSession=>{
  const response=await fetch(`${URL}/functions/v1/admin-bootstrap`,{method:"POST",headers:{Authorization:`Bearer ${activeSession.access_token}`,apikey:KEY,"Content-Type":"application/json"},body:JSON.stringify({})});
  const payload=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(payload.error||"Primary administrator setup could not be completed");
  return payload.data;
 };
 const setupAdmin=async e=>{
  e.preventDefault();
  if(!db){setNotice("The secure Supabase connection is not configured in this deployment.");return;}
  if(email.trim().toLowerCase()!=="udofiaasianubong583@gmail.com"){setNotice("Only the designated administrator email can be used.");return;}
  if(password.length<8){setNotice("Create a password with at least 8 characters.");return;}
  if(password!==confirmPassword){setNotice("The password and confirmation do not match.");return;}
  setBusy(true);setNotice("");
  try{
   const {data,error}=await db.auth.signUp({email:"udofiaasianubong583@gmail.com",password,options:{data:{full_name:"Primary Administrator"}}});
   if(error)throw error;
   setPassword("");setConfirmPassword("");
   if(data.session){
    try{await bootstrapAdmin(data.session);}catch(error){await db.auth.signOut();setSession(null);throw error;}
    await db.auth.signOut();setSession(null);setAuthMode("login");
    setNotice("Your account setup is complete. Sign in with your email and newly created password, then finish authenticator security.");
   }else{
    setAuthMode("login");
    setNotice("Account registration started. If email confirmation is enabled, open the confirmation message for this address, then return here and sign in with your new password. Admin access is assigned only after the email is confirmed.");
   }
  }catch(error){
   const message=error?.message||"Administrator setup failed.";
   if(/already registered|already exists|user already/i.test(message)){setAuthMode("login");setNotice("An account already exists for the designated email. Use the normal login flow; if it is email-confirmed, the secure setup will finish during sign-in.");}
   else setNotice(message);
  }finally{setBusy(false);}
 };
 const signIn=async e=>{
  e.preventDefault();
  if(!db){setNotice("Configure VITE_SUPABASE_PUBLISHABLE_KEY in this deployment first.");return;}
  setBusy(true);setNotice("");
  try{
   const {data,error}=await db.auth.signInWithPassword({email:email.trim(),password});
   if(error)throw error;
   let activeSession=data.session;
   let activeUser=data.user;
   if((activeUser?.email??"").toLowerCase()==="udofiaasianubong583@gmail.com"&&activeUser?.app_metadata?.role!=="admin"){
    await bootstrapAdmin(activeSession);
    const refreshed=await db.auth.refreshSession();
    if(refreshed.error||!refreshed.data.session)throw refreshed.error||new Error("Session refresh failed after administrator setup");
    activeSession=refreshed.data.session;activeUser=refreshed.data.user;
   }
   setSession(activeSession);
   if(activeUser?.app_metadata?.role!=="admin"){
    await db.auth.signOut();setSession(null);setMfaVerified(false);setMfaEnrolled(null);
    setNotice("Access denied. This portal is restricted to the single designated primary administrator.");return;
   }
   const {data:assurance}=await db.auth.mfa.getAuthenticatorAssuranceLevel();
   if(assurance?.currentLevel==="aal2"){setMfaVerified(true);setMfaEnrolled(true);setNotice("Multi-factor authentication already verified.");}
   else{
    setMfaVerified(false);
    const {data:factors}=await db.auth.mfa.listFactors();
    const factor=factors?.totp?.find(f=>f.status==="verified");
    setMfaEnrolled(!!factor);
    if(!factor)setNotice("Password accepted. Set up an authenticator to secure this administrator account before continuing.");
    else setNotice("Password accepted. Enter the current code from your authenticator to complete secure admin login.");
   }
  }catch(error){setNotice(error?.message||"Secure login failed. Check your email, password, and email confirmation status.");}
  finally{setBusy(false);}
 };
 const startMfaEnrollment=async()=>{
  if(!db||!session||!manager)return;
  setBusy(true);setNotice("");
  try{
   const {data:listed,error:listError}=await db.auth.mfa.listFactors();
   if(listError)throw listError;
   const verified=listed?.totp?.find(f=>f.status==="verified");
   if(verified){
    setEnrollment(null);setMfaEnrolled(true);setMfaCode("");
    setNotice("An authenticator is already verified for this account. Enter the current six-digit code from that authenticator to continue; no new QR code is needed.");
    return;
   }
   const stale=(listed?.all||listed?.totp||[]).find(f=>f.factor_type==="totp"&&f.friendly_name==="Invest Broker Admin"&&f.status!=="verified");
   if(stale){
    const {error:removeError}=await db.auth.mfa.unenroll({factorId:stale.id});
    if(removeError)throw new Error("Could not remove the unfinished authenticator setup: "+removeError.message);
   }
   const {data,error}=await db.auth.mfa.enroll({factorType:"totp",friendlyName:"Invest Broker Admin"});
   if(error)throw error;
   setEnrollment(data);setMfaEnrolled(false);
   setNotice("Scan this new QR code with your authenticator app, then enter the current six-digit code. Ignore any older Invest Broker Admin entry in the app.");
  }catch(error){
   setNotice("Could not start authenticator setup: "+(error?.message||"Unknown error"));
  }finally{setBusy(false);}
 };
 const restartMfaEnrollment=async()=>{
  if(!db||!session||!manager)return;
  setBusy(true);setNotice("");
  try{
   if(enrollment?.id){
    const {error:removeError}=await db.auth.mfa.unenroll({factorId:enrollment.id});
    if(removeError)throw new Error("Could not invalidate the exposed or unfinished setup key: "+removeError.message);
   }
   setEnrollment(null);setMfaCode("");
   const {data:listed,error:listError}=await db.auth.mfa.listFactors();
   if(listError)throw listError;
   const verified=listed?.totp?.find(f=>f.status==="verified");
   if(verified){setMfaEnrolled(true);setNotice("A verified authenticator already exists. Keep it and use its current code; a new setup key was not created.");return;}
   const stale=(listed?.all||listed?.totp||[]).find(f=>f.factor_type==="totp"&&f.friendly_name==="Invest Broker Admin"&&f.status!=="verified");
   if(stale){const {error:removeError}=await db.auth.mfa.unenroll({factorId:stale.id});if(removeError)throw removeError;}
   const {data,error}=await db.auth.mfa.enroll({factorType:"totp",friendlyName:"Invest Broker Admin"});
   if(error)throw error;
   setEnrollment(data);setMfaEnrolled(false);
   setNotice("A fresh authenticator key was generated. Remove the old Invest Broker Admin entry from your authenticator app, scan this new QR code, and wait for a new six-digit code.");
  }catch(error){setNotice("Could not restart authenticator setup: "+(error?.message||"Unknown error"));}
  finally{setBusy(false);}
 };
 const verifyEnrollment=async()=>{
  if(!db||!session||!enrollment?.id)return;
  const code=mfaCode.trim();
  if(!/^\d{6}$/.test(code)){setNotice("Enter the current six-digit code from the newly scanned authenticator entry.");return;}
  setBusy(true);setNotice("");
  try{
   const {error}=await db.auth.mfa.challengeAndVerify({factorId:enrollment.id,code});
   if(error){setNotice("Authenticator verification failed. Keep this page open, wait for the next code, and check your device date/time is set to automatic. If this setup key was exposed, tap Restart authenticator setup to invalidate it and generate a new QR code. ("+error.message+")");return;}
   setMfaCode("");setEnrollment(null);setMfaEnrolled(true);setMfaVerified(true);setNotice("Authenticator enrolled and verified. Admin access is unlocked.");await loadData();
  }catch(error){setNotice("Authenticator verification could not complete: "+(error?.message||"Unknown error"));}
  finally{setBusy(false);}
 };
 const verifyMfa=async()=>{if(!db||!session)return;setBusy(true);const {data:factors}=await db.auth.mfa.listFactors();const factor=factors?.totp?.find(f=>f.status==="verified");if(!factor){setBusy(false);setMfaEnrolled(false);setNotice("No verified authenticator is enrolled. Set one up to continue.");return;}const {error}=await db.auth.mfa.challengeAndVerify({factorId:factor.id,code:mfaCode.trim()});setBusy(false);if(error){setNotice("MFA verification failed: "+error.message);return;}setMfaCode("");setMfaVerified(true);setNotice("Multi-factor authentication verified.");await loadData();};
 const refreshAdminSession=async()=>{if(!db)return null;const {data,error}=await db.auth.refreshSession();if(error||!data.session)return null;setSession(data.session);return data.session;};
 const signOut=async()=>{if(db)await db.auth.signOut();setSession(null);setMfaVerified(false);setRows({});setNotice("Signed out.");};
 const reviewUser=async(target,action)=>{if(!session||!manager||!mfaVerified)return;if(!window.confirm((action==="approve"?"Approve":"Reject")+" this customer account? This decision will be recorded in the audit log."))return;setBusy(true);setNotice("");try{await callAdminApi(session,"users",{method:"POST",expectArray:false,body:JSON.stringify({user_id:target.id,action,reason:action==="approve"?"Approved by primary administrator":"Rejected by primary administrator"})},refreshAdminSession);setNotice("Account "+(action==="approve"?"approved":"rejected")+". The review has been audited.");await loadData();}catch(error){setNotice(error.message||"The account review could not be completed.");}finally{setBusy(false);}};
 const loadData=async(silent=false)=>{
  if(!db||!session||!manager||!mfaVerified)return;
  if(!silent){setLoading(true);setNotice("");}
  const routes=[["profiles","users"],["wallets","wallets"],["investments","investments"],["investment_plans","investment-plans"],["ledger_entries","returns"],["deposits","deposits"],["withdrawals","withdrawals"],["treasury_accounts","treasury"],["compliance_cases","compliance"],["audit_logs","audit-logs"]];
  const results=await Promise.all(routes.map(async([key,route])=>{try{return [key,await callAdminApi(session,route,{},refreshAdminSession)];}catch(error){return [key,{error}];}}));
  const next={user_complaints:[],wallets:[]};const failed=[];
  for(const [key,result] of results){if(result?.error){next[key]=[];failed.push(key);}else next[key]=result||[];}
  setRows(next);setLoading(false);
  setNotice(current=>failed.length?"Some records could not be loaded from the secured Admin API: "+failed.join(", "):current.startsWith("Some records could not be loaded from the secured Admin API:")?"":current);
 };
 useEffect(()=>{if(session&&manager&&mfaVerified)loadData()},[session?.user?.id,session?.access_token,manager,mfaVerified]);
 useEffect(()=>{
  if(!db||!session||!manager||!mfaVerified){setLiveStatus("offline");return;}
  let disposed=false;
  const tables=["profiles","investments","investment_plans","ledger_entries","deposits","withdrawals","treasury_accounts","compliance_cases","audit_logs","support_messages","user_complaints","user_bank_accounts","user_documents","user_notifications"];
  const channel=db.channel("invest-broker-admin-live-phase2");
  tables.forEach(table=>channel.on("postgres_changes",{event:"*",schema:"public",table},()=>{if(!disposed)loadData(true);}));
  channel.subscribe(status=>{if(disposed)return;if(status==="SUBSCRIBED")setLiveStatus("live");else if(["CHANNEL_ERROR","TIMED_OUT","CLOSED"].includes(status))setLiveStatus("reconnecting");});
  const fallback=window.setInterval(()=>{if(!disposed&&document.visibilityState==="visible")loadData(true);},10000);
  return()=>{disposed=true;window.clearInterval(fallback);db.removeChannel(channel);};
 },[session?.user?.id,session?.access_token,manager,mfaVerified]);
 const users=rows.profiles||[],investments=rows.investments||[],deposits=rows.deposits||[],withdrawals=rows.withdrawals||[],ledger=rows.ledger_entries||[];
 const inCurrency=(record)=>String(record?.currency||"").toUpperCase()===adminCurrency;
  const currencyInvestments=investments.filter(inCurrency);
  const currencyWithdrawals=withdrawals.filter(inCurrency);
  const currencyLedger=ledger.filter(inCurrency);
  const totalInvested=currencyInvestments.filter(x=>["active","matured","under_review"].includes(x.status)).reduce((a,x)=>a+Number(x.principal||0),0);
 const pendingWithdrawals=currencyWithdrawals.filter(x=>["pending","under_review","approved","processing"].includes(x.status));
 const postedProfit=currencyLedger.filter(x=>x.entry_type==="profit_credit"&&x.status==="posted").reduce((a,x)=>a+Math.abs(Number(x.amount||0)),0);
 const pendingKyc=users.filter(x=>x.kyc_status==="pending"||x.kyc_status==="in_review");
 const pendingApprovals=users.filter(x=>x.approval_status==="pending");
 const currencyScoped=["Wallets","Investments","Investment Plans","Profit Management","Deposits","Withdrawals","Treasury"].includes(section);
  const currentRows=(rows[tableFor[section]]||[]).filter(x=>(!currencyScoped||inCurrency(x))&&JSON.stringify(x).toLowerCase().includes(search.toLowerCase()));
 const wallets=rows.wallets||[]; const walletsUSD=wallets.filter(x=>String(x.currency||"").toUpperCase()==="USD"); const walletsNGN=wallets.filter(x=>String(x.currency||"").toUpperCase()==="NGN");
 const sendAi=()=>{const p=aiPrompt.trim();if(!p)return;setAiMessages(m=>[...m,{by:"user",text:p},{by:"assistant",text:answerReadOnly(p,rows,adminCurrency)}]);setAiPrompt("");};
 if(!adminReady){return <div className="admin-login-shell"><div className="admin-login-card"><div className="admin-logo"><div><ShieldCheck size={24}/></div><span>INVEST BROKER<small>SECURE MANAGEMENT</small></span></div><div className="admin-eyebrow">RESTRICTED ACCESS</div><h1>Admin Portal</h1><p className="admin-login-sub">Create your one-time administrator account, then sign in normally. Access is restricted to the designated email and requires multi-factor authentication.</p>{notice&&<div className="admin-notice"><AlertTriangle size={16}/><span>{notice}</span></div>}{(!session||!manager)?(!session&&authMode==="setup"?<form onSubmit={setupAdmin} className="admin-login-form">
<label>Administrator email<input type="email" autoComplete="username" value={email} readOnly required/></label>
<label>Create password<input type="password" autoComplete="new-password" value={password} onChange={e=>setPassword(e.target.value)} minLength={8} required placeholder="Create your password"/></label>
<label>Confirm password<input type="password" autoComplete="new-password" value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} minLength={8} required placeholder="Confirm your password"/></label>
<button className="admin-primary" disabled={busy}>{busy?"Creating secure account…":"Continue"} <ChevronRight size={17}/></button>
<p className="admin-setup-note">This setup is restricted to the one designated administrator. Your password is entered only in this form; do not share it in chat.</p>
<button type="button" className="admin-link" onClick={()=>{setAuthMode("login");setNotice("");setPassword("");setConfirmPassword("");}}>Already created the account? Log in</button>
</form>:<form onSubmit={signIn} className="admin-login-form">
<label>Email address<input type="email" autoComplete="username" value={email} onChange={e=>setEmail(e.target.value)} required placeholder="udofiaasianubong583@gmail.com"/></label>
<label>Password<input type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} required placeholder="Your password"/></label>
<button className="admin-primary" disabled={busy}>{busy?"Checking credentials…":"Secure login"} <ChevronRight size={17}/></button>

</form>):null}{session&&manager&&(mfaEnrolled===false?<div className="admin-login-form"><p>Set up an authenticator app (for example, Google Authenticator, Microsoft Authenticator, or 1Password) to secure admin access.</p>{!enrollment?<button type="button" className="admin-primary" disabled={busy} onClick={startMfaEnrollment}>{busy?"Preparing setup…":"Set up authenticator"} <ShieldCheck size={17}/></button>:<><img src={enrollment.totp?.qr_code} alt="Authenticator setup QR code" style={{display:"block",width:190,height:190,margin:"8px auto",background:"#fff",padding:8,borderRadius:8}}/><p>Can’t scan? Enter this setup key manually:</p><code style={{display:"block",overflowWrap:"anywhere",padding:10,background:"rgba(127,127,127,.12)",borderRadius:6}}>{enrollment.totp?.secret}</code><label>6-digit authenticator code<input inputMode="numeric" pattern="[0-9]{6}" maxLength={6} value={mfaCode} onChange={e=>setMfaCode(e.target.value)} placeholder="123456" required/></label><button type="button" className="admin-primary" disabled={busy||mfaCode.trim().length!==6} onClick={verifyEnrollment}>{busy?"Verifying…":"Verify and enable MFA"} <ShieldCheck size={17}/></button><button type="button" className="admin-secondary" disabled={busy} onClick={restartMfaEnrollment}>Restart authenticator setup</button></>}<button type="button" className="admin-link" onClick={signOut}>Cancel and sign out</button></div>:<form className="admin-login-form" onSubmit={e=>{e.preventDefault();verifyMfa()}}><label>Authenticator code<input inputMode="numeric" pattern="[0-9]{6}" maxLength={6} value={mfaCode} onChange={e=>setMfaCode(e.target.value)} placeholder="6-digit code" required/></label><button className="admin-primary" disabled={busy}>{busy?"Verifying…":"Verify MFA"} <ShieldCheck size={17}/></button><button type="button" className="admin-link" onClick={signOut}>Cancel and sign out</button></form>)}<div className="admin-login-foot"><LockKeyhole size={14}/> Only the confirmed designated email can claim the single primary-admin slot. Customer accounts cannot use this setup flow.</div></div></div>}
 return <div className="admin-shell"><aside className={"admin-sidebar "+(navOpen?"open":"")}><div className="admin-logo"><div><ShieldCheck size={23}/></div><span>INVEST BROKER<small>ADMIN CONTROL CENTER</small></span><button className="admin-icon mobile-only" onClick={()=>setNavOpen(false)}><X size={18}/></button></div><div className="admin-side-label">MANAGEMENT</div><nav>{nav.map(([label,Icon])=><button key={label} onClick={()=>{const path=getAdminPath(label);if(window.location.pathname!==path)window.history.pushState({},"",path);setSection(label);setNavOpen(false);setSearch("");setNotice("")}} className={"admin-nav "+(section===label?"selected":"")}><Icon size={17}/><span>{label}</span>{label==="Withdrawals"&&pendingWithdrawals.length>0&&<i>{pendingWithdrawals.length}</i>}</button>)}</nav><div className="admin-side-foot"><div className="admin-secure"><ShieldCheck size={18}/><b>Secure operations</b><p>Money movement stays server-authorized. AI is advisory only.</p></div><div className="admin-identity"><div className="admin-avatar">{session.user.email?.slice(0,1).toUpperCase()}</div><div><b>{session.user.email}</b><small>{session.user.app_metadata?.role}</small></div><button onClick={signOut} title="Sign out"><LogOut size={16}/></button></div></div></aside>{navOpen&&<button className="admin-scrim" onClick={()=>setNavOpen(false)} aria-label="Close navigation"/>}<main className="admin-main"><header className="admin-topbar"><button className="admin-icon mobile-only" onClick={()=>setNavOpen(true)}><Menu size={20}/></button><div className="admin-crumb">Management <span>/</span> <b>{section}</b></div><div className="admin-top-right"><label className="admin-currency-control">Currency <select aria-label="Admin currency" value={adminCurrency} onChange={e=>setAdminCurrency(e.target.value)}><option value="USD">USD · US Dollar</option><option value="NGN">NGN · Nigerian Naira</option></select></label><span className="admin-role-pill"><i/>{session.user.app_metadata?.role?.toUpperCase()} ACCESS</span><button className="admin-icon" onClick={loadData} title="Refresh records"><RefreshCw size={17}/></button><button className="admin-icon" onClick={signOut} title="Sign out"><LogOut size={17}/></button></div></header><div className="admin-content"><div className="admin-heading"><div><div className="admin-eyebrow">INVEST BROKER / MANAGEMENT</div><h1>{section}</h1><p>{description(section)}</p></div><span className="admin-readonly"><LockKeyhole size={13}/> Financial actions restricted</span></div>{notice&&<div className="admin-notice wide"><AlertTriangle size={16}/><span>{notice}</span><button onClick={()=>setNotice("")}><X size={14}/></button></div>}
 {section==="Dashboard"&&<><div className="admin-wallet-overview"><section className="admin-wallet-card"><div className="admin-wallet-card-top"><span>USD WALLET</span><b>US Dollar</b></div><strong>{walletsUSD.length.toLocaleString("en-US")}</strong><p>Wallet account(s) recorded in USD</p><div className="admin-wallet-balance">Available balance <b>Pending reconciliation</b></div></section><section className="admin-wallet-card"><div className="admin-wallet-card-top"><span>NGN WALLET</span><b>Nigerian Naira</b></div><strong>{walletsNGN.length.toLocaleString("en-NG")}</strong><p>Wallet account(s) recorded in NGN</p><div className="admin-wallet-balance">Available balance <b>Pending reconciliation</b></div></section></div><div className="admin-metrics"><AdminMetric icon={Users} title="Registered users" value={users.length.toLocaleString("en-NG")} detail={pendingKyc.length+" pending KYC"} tone="blue"/><AdminMetric icon={BriefcaseBusiness} title="Invested principal" value={fmt(totalInvested,adminCurrency)} detail={investments.filter(x=>x.status==="active").length+" active investments"} tone="violet"/><AdminMetric icon={ArrowUpRight} title="Withdrawal queue" value={fmt(pendingWithdrawals.reduce((a,x)=>a+Number(x.amount||0),0),adminCurrency)} detail={pendingWithdrawals.length+" awaiting status progression"} tone="amber"/><AdminMetric icon={Banknote} title="Posted profit credits" value={fmt(postedProfit,adminCurrency)} detail="Posted ledger entries only" tone="green"/></div><div className="admin-grid"><section className="admin-card"><div className="admin-card-head"><div><h2>Pending actions</h2><p>Review queues from current records</p></div><ClipboardCheck size={18}/></div><div className="admin-queue"><Queue icon={Users} label="New account approvals" value={pendingApprovals.length} onClick={()=>{setSection("Users");window.history.pushState({},"",getAdminPath("Users"));}}/><Queue icon={BadgeCheck} label="KYC reviews" value={pendingKyc.length} onClick={()=>setSection("Users")}/><Queue icon={ArrowUpRight} label="Withdrawal requests" value={pendingWithdrawals.length} onClick={()=>setSection("Withdrawals")}/><Queue icon={ShieldAlert} label="Compliance cases" value={(rows.compliance_cases||[]).filter(x=>!["resolved","closed"].includes(x.status)).length} onClick={()=>setSection("Compliance")}/><Queue icon={MessageSquareText} label="Customer complaints" value={(rows.user_complaints||[]).filter(x=>!["resolved","closed"].includes(x.status)).length} onClick={()=>setSection("Compliance")}/></div></section><section className="admin-card"><div className="admin-card-head"><div><h2>Recent activity</h2><p>Latest recorded ledger events</p></div><Activity size={18}/></div><AdminTable columns={[["Reference",r=>r.reference],["Type",r=>r.entry_type?.replaceAll("_"," ")],["Amount",r=>r.currency?fmt(r.amount,r.currency):"Currency not set"],["Status",r=><AdminStatus value={r.status}/>]]} rows={currencyLedger.slice(0,7)} empty="No ledger events recorded"/></section></div><div className="admin-warning"><AlertTriangle size={18}/><div><b>Production safety gate</b><p>Dashboard figures are calculated from the currently readable database records. Empty tables mean no records have been loaded—not a zero-risk or reconciled financial position. Do not approve or move customer funds until the server-side transaction workflows and payment/custody provider are verified.</p></div></div></>}
 {tableFor[section]&&<section className="admin-card table-card"><div className="admin-card-head"><div><h2>{section}</h2><p>{currentRows.length} record(s) visible to your authorized role</p></div><div className="admin-search"><Search size={16}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder={"Search "+section.toLowerCase()+"…"}/></div></div>{section==="Wallets"&&<div className="admin-inline-warning"><ShieldCheck size={15}/> USD and NGN wallets are kept separate. Available balances remain pending reconciliation until the secure backend exposes a verified, reconciled balance; this view does not estimate or convert balances.</div>}{section==="Investment Plans"&&<div className="admin-inline-warning"><LockKeyhole size={15}/> Plan creation and financial-rule changes are disabled until audited server-side mutations are deployed.</div>}{section==="Withdrawals"&&<div className="admin-inline-warning"><LockKeyhole size={15}/> Approve, reject, hold and payment processing are intentionally disabled. Use the secure workflow once available.</div>}{section==="Treasury"&&<div className="admin-inline-warning"><ShieldCheck size={15}/> Treasury records are company-only. Customer wallets and treasury are never combined into one balance.</div>}<AdminTable columns={section==="Users"?[...columnsFor(section),["Review",r=>r.approval_status==="pending"?<div style={{display:"flex",gap:8,flexWrap:"wrap"}}><button className="admin-primary" disabled={busy} onClick={()=>reviewUser(r,"approve")}>Approve</button><button className="admin-secondary" disabled={busy} onClick={()=>reviewUser(r,"reject")}>Reject</button></div>:<AdminStatus value={r.approval_status}/>]]:columnsFor(section)} rows={currentRows} empty="No records available to this account"/></section>}
 {section==="AI Assistant"&&<section className="admin-card ai-card"><div className="ai-head"><div className="ai-symbol"><BrainCircuit size={22}/></div><div><h2>AI Investment Assistant</h2><p>Read-only analysis • no financial authority</p></div><span className="ai-badge">ADVISORY ONLY</span></div><div className="ai-conversation">{aiMessages.map((m,i)=><div key={i} className={"ai-message "+m.by}><div className="ai-message-label">{m.by==="user"?"YOU":"AI ASSISTANT"}</div><p>{m.text}</p></div>)}</div><div className="ai-prompts">{["How many investments mature this week?","Summarize pending withdrawals","Show KYC review workload"].map(p=><button key={p} onClick={()=>setAiPrompt(p)}>{p}</button>)}</div><form className="ai-input" onSubmit={e=>{e.preventDefault();sendAi()}}><input value={aiPrompt} onChange={e=>setAiPrompt(e.target.value)} placeholder="Ask for a read-only summary…"/><button className="admin-primary" disabled={!aiPrompt.trim()}>Analyze <ChevronRight size={15}/></button></form><p className="ai-disclaimer">This prototype answers from records currently loaded in the browser. It is not connected to an AI model or live analytical backend. It cannot execute actions.</p></section>}
 {section==="Reports"&&<div className="admin-grid">{[["Financial report","Ledger totals and transaction status"],["Investment report","Plan uptake, principal and maturity"],["Profit/returns","Posted profit credits versus pending"],["Deposit report","Provider-confirmed funding status"],["Withdrawal report","Request status and settlement outcomes"],["Compliance report","KYC, risk cases and complaints"],["Reconciliation","Ledger versus provider statements"],["Audit report","Sensitive action history"]].map(([t,d])=><section className="admin-card report-card" key={t}><FileBarChart2 size={20}/><h3>{t}</h3><p>{d}</p><button className="admin-secondary" onClick={()=>setNotice("Report generation is not enabled until the server-side report and export service is implemented.")}>Generate report <ChevronRight size={14}/></button></section>)}</div>}
 {section==="Settings"&&<section className="admin-card"><h2>Management settings</h2><p className="admin-muted">Admin security and platform configuration.</p><div className="admin-setting-row"><ShieldCheck size={18}/><div><b>Multi-factor authentication</b><small>Required for sensitive admin actions. Current session assurance is checked at login.</small></div><span className="admin-status pending">Verify before action</span></div><div className="admin-setting-row"><FileClock size={18}/><div><b>Audit logging</b><small>Financial mutations must be audited by the trusted server workflow.</small></div><span className="admin-status">Backend required</span></div><div className="admin-setting-row"><Landmark size={18}/><div><b>Payment / custody provider</b><small>No provider is currently configured for live money movement in this foundation.</small></div><span className="admin-status pending">Not configured</span></div></section>}
 <footer className="admin-footer"><span>Invest Broker · Admin Control Center</span><span><LockKeyhole size={13}/> Restricted access · Read-only foundation</span><span>{loading?"Refreshing…":liveStatus==="live"?"Live updates connected":liveStatus==="reconnecting"?"Live updates reconnecting":"Live updates offline"}</span></footer></div></main></div>
}
function description(s){return ({Dashboard:"Operational overview and action queues from the shared backend.",Wallets:"Separate USD and NGN customer wallet accounts; balances appear only after backend reconciliation.",Users:"Customer profiles and verification status. Sensitive profile changes require an audited workflow.",Investments:"All investment records permitted by your manager role.", "Investment Plans":"Configured products and terms. Financial rule changes must be audited.", "Profit Management":"Posted ledger profit credits; projected and accrued returns need a verified profit engine.",Deposits:"Provider-verified funding requests and their current statuses.",Withdrawals:"Withdrawal queue. Approval and payment execution remain server-controlled.",Treasury:"Company treasury records, separate from customer wallets.",Compliance:"Compliance cases and customer complaints.", "AI Assistant":"Ask for read-only summaries of loaded records.",Reports:"Report categories; exports are disabled until the reporting service is ready.", "Audit Logs":"Recorded administrative and financial events.",Settings:"Security and platform configuration status."})[s]||"Authorized management workspace."}
function AdminMetric({icon:Icon,title,value,detail,tone}){return <div className="admin-metric"><div className={"admin-metric-icon "+tone}><Icon size={19}/></div><span>{title}</span><strong>{value}</strong><small>{detail}</small></div>}
function Queue({icon:Icon,label,value,onClick}){return <button className="admin-queue-row" onClick={onClick}><span><Icon size={17}/>{label}</span><b>{value}</b><ChevronRight size={15}/></button>}
function AdminStatus({value}){return <span className={"admin-status "+(value==="active"||value==="completed"||value==="posted"||value==="verified"?"good":["pending","under_review","processing","in_review"].includes(value)?"pending":"")}>{(value||"unknown").replaceAll("_"," ")}</span>}
function AdminTable({columns,rows,empty}){return rows?.length?<div className="admin-table-scroll"><table className="admin-table"><thead><tr>{columns.map(([name])=><th key={name}>{name}</th>)}</tr></thead><tbody>{rows.map((r,i)=><tr key={r.id||i}>{columns.map(([name,render])=><td key={name}>{render(r)??"—"}</td>)}</tr>)}</tbody></table></div>:<div className="admin-empty"><div><FileText size={22}/></div><b>{empty}</b><p>Only records permitted by your manager/admin role appear here.</p></div>}
function columnsFor(section){const defs={
"Wallets":[["Wallet",r=>r.wallet_code||r.id],["Customer",r=>r.user_id],["Currency",r=>r.currency||"Currency not set"],["Available balance",r=>"Pending reconciliation"],["Status",r=><AdminStatus value={r.status}/>],["Created",r=>dt(r.created_at)]],
"Users":[["User ID",r=>r.user_code],["Name",r=>r.full_name],["KYC",r=><AdminStatus value={r.kyc_status}/>],["Approval",r=><AdminStatus value={r.approval_status}/>],["Account",r=><AdminStatus value={r.account_status}/>],["Created",r=>dt(r.created_at)]],
"Investments":[["Investment",r=>r.investment_code],["Customer",r=>r.user_id],["Principal",r=>r.currency?fmt(r.principal,r.currency):"Currency not set"],["Plan",r=>r.plan_id],["Maturity",r=>dt(r.maturity_at)],["Status",r=><AdminStatus value={r.status}/>]],
"Investment Plans":[["Plan",r=>r.name],["Minimum",r=>r.currency?fmt(r.minimum_amount,r.currency):"Currency not set"],["Maximum",r=>r.maximum_amount?(r.currency?fmt(r.maximum_amount,r.currency):"Currency not set"):"No cap"],["Duration",r=>r.duration_days+" days"],["Return method",r=>r.return_method],["Rate",r=>r.return_rate],["Status",r=><AdminStatus value={r.is_active?"active":"disabled"}/>]],
"Profit Management":[["Reference",r=>r.reference],["Customer",r=>r.user_id],["Type",r=>r.entry_type?.replaceAll("_"," ")],["Amount",r=>r.currency?fmt(r.amount,r.currency):"Currency not set"],["Date",r=>dt(r.created_at)],["Status",r=><AdminStatus value={r.status}/>]],
"Deposits":[["Reference",r=>r.deposit_code],["Customer",r=>r.user_id],["Amount",r=>r.currency?fmt(r.amount,r.currency):"Currency not set"],["Provider",r=>r.provider||"—"],["Date",r=>dt(r.created_at)],["Status",r=><AdminStatus value={r.status}/>]],
"Withdrawals":[["Reference",r=>r.withdrawal_code],["Customer",r=>r.user_id],["Amount",r=>r.currency?fmt(r.amount,r.currency):"Currency not set"],["Requested",r=>dt(r.created_at)],["Status",r=><AdminStatus value={r.status}/>]],
"Treasury":[["Account",r=>r.account_name||r.name||r.id],["Currency",r=>r.currency],["Balance",r=>r.balance==null?"—":r.currency?fmt(r.balance,r.currency):"Currency not set"],["Status",r=><AdminStatus value={r.status}/>]],
"Compliance":[["Case",r=>r.case_code||r.id],["Customer",r=>r.user_id],["Type",r=>r.case_type||r.category],["Risk",r=>r.risk_level],["Created",r=>dt(r.created_at)],["Status",r=><AdminStatus value={r.status}/>]],
"Audit Logs":[["Event",r=>r.action||r.event_type],["Actor",r=>r.actor_id||r.user_id],["Entity",r=>r.entity_type],["Entity ID",r=>r.entity_id],["Time",r=>dt(r.created_at)]]
};return defs[section]||[]}
function answerReadOnly(p,rows,currency="USD"){const q=p.toLowerCase();if(q.includes("matur")||q.includes("week")){const end=Date.now()+7*86400000;const items=(rows.investments||[]).filter(x=>x.maturity_at&&new Date(x.maturity_at).getTime()>=Date.now()&&new Date(x.maturity_at).getTime()<=end);return "From currently loaded investment records, "+items.length+" investment(s) have a maturity date in the next 7 days, with total principal "+fmt(items.reduce((s,x)=>s+Number(x.principal||0),0))+". This is a browser-side summary of accessible records, not a settlement instruction."}if(q.includes("withdraw")){const items=(rows.withdrawals||[]).filter(x=>["pending","under_review","approved","processing"].includes(x.status));return "Currently loaded records show "+items.length+" withdrawal request(s) in an open/processing status, totaling "+fmt(items.reduce((s,x)=>s+Number(x.amount||0),0))+". No request was approved or changed."}if(q.includes("kyc")||q.includes("identity")){const items=(rows.profiles||[]).filter(x=>["pending","in_review"].includes(x.kyc_status));return "Currently loaded customer profiles include "+items.length+" KYC review(s) pending or in review. This summary does not make verification decisions."}return "I can provide read-only summaries for maturing investments, withdrawal queues and KYC workload from records already loaded. For other questions, a protected server-side analytics/AI service must be configured. No data or financial state was changed."}
createRoot(document.getElementById("admin-root")).render(<><AdminApp/><Analytics/></>);
