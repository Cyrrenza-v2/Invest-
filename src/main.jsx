import React, { useCallback, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { getAccountAccess } from "./approval.js";
import { supabase, supabaseConfigReady, supabasePublicKey } from "./supabase.js";
import "./style.css";

const API_URL = (import.meta.env.VITE_SUPABASE_URL || "").replace(/\/$/, "");

function friendlyAuthError(error) {
  const message = String(error?.message || "Unable to sign in. Please try again.");
  if (/email not confirmed/i.test(message)) return "Please confirm your email address using the verification link we sent before signing in.";
  if (/invalid login credentials/i.test(message)) return "The email or password is incorrect.";
  if (/user already registered/i.test(message)) return "An account already exists for this email. Please sign in instead.";
  if (/password should be at least/i.test(message)) return "Choose a stronger password that meets the password requirements.";
  return message;
}

function App() {
  const [mode, setMode] = useState("login");
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [access, setAccess] = useState(null);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");

  const loadAccess = useCallback(async (activeSession, silent = false) => {
    if (!activeSession?.access_token || !supabase) return;
    if (!silent) setChecking(true);
    try {
      const response = await fetch(`${API_URL}/functions/v1/user-api/me`, {
        method: "GET",
        headers: {
          apikey: supabasePublicKey,
          Authorization: `Bearer ${activeSession.access_token}`,
          Accept: "application/json",
        },
        cache: "no-store",
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "We could not verify your account with the server.");
      const customerProfile = payload.data;
      setProfile(customerProfile || null);
      setAccess(getAccountAccess(customerProfile));
      setError("");
    } catch (e) {
      setAccess({ allowed: false, state: "verification_error", message: e.message || "Account verification failed. Please retry." });
    } finally {
      if (!silent) setChecking(false);
    }
  }, []);

  useEffect(() => {
    if (!supabase) return undefined;
    let mounted = true;
    supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (!mounted) return;
      if (sessionError) setError(friendlyAuthError(sessionError));
      setSession(data?.session ?? null);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (mounted) {
        setSession(nextSession);
        if (!nextSession) {
          setProfile(null);
          setAccess(null);
        }
      }
    });
    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (session) void loadAccess(session);
    else {
      setProfile(null);
      setAccess(null);
    }
  }, [session?.access_token, loadAccess]);

  useEffect(() => {
    if (!session || access?.state !== "pending") return undefined;
    const timer = setInterval(() => void loadAccess(session, true), 8000);
    return () => clearInterval(timer);
  }, [session?.access_token, access?.state, loadAccess]);

  async function submit(event) {
    event.preventDefault();
    setError("");
    setNotice("");
    setLoading(true);
    try {
      if (!supabase) throw new Error("The user app is not configured yet. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in the deployment environment.");
      const normalizedEmail = email.trim().toLowerCase();
      if (mode === "register") {
        if (!fullName.trim()) throw new Error("Enter your full name.");
        if (password.length < 8) throw new Error("Use a password with at least 8 characters.");
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: normalizedEmail,
          password,
          options: { data: { full_name: fullName.trim() } },
        });
        if (signUpError) throw signUpError;
        if (!data.session) {
          setNotice("Account created. Confirm your email using the verification link, then sign in. Administrator approval is a separate required step.");
        } else {
          setSession(data.session);
          setNotice("Account created. We are checking its approval status.");
        }
      } else {
        const { data, error: signInError } = await supabase.auth.signInWithPassword({
          email: normalizedEmail,
          password,
        });
        if (signInError) throw signInError;
        if (!data.session) throw new Error("Sign-in did not return a session. Please try again.");
        setSession(data.session);
        setNotice("Sign-in succeeded. Verifying administrator approval and account status…");
      }
    } catch (e) {
      setError(friendlyAuthError(e));
    } finally {
      setLoading(false);
    }
  }

  async function signOut() {
    setLoading(true);
    try {
      if (supabase) await supabase.auth.signOut();
      setSession(null);
      setProfile(null);
      setAccess(null);
      setNotice("You have been signed out.");
    } catch (e) {
      setError(friendlyAuthError(e));
    } finally {
      setLoading(false);
    }
  }

  async function recheck() {
    setError("");
    if (session) await loadAccess(session);
  }

  if (!supabaseConfigReady) {
    return <main className="page"><section className="panel"><Brand /><h1>Setup required</h1><p className="muted">The customer app needs the public Supabase project URL and anon/publishable key to authenticate users. Add <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> to the Vercel project environment and redeploy.</p><p className="small">Never add a service-role key to frontend environment variables.</p></section></main>;
  }

  if (session && access?.allowed) {
    return <main className="page"><section className="panel wide"><Brand /><div className="success-icon">✓</div><p className="eyebrow">ACCOUNT VERIFIED</p><h1>Welcome{profile?.full_name ? `, ${profile.full_name}` : ""}</h1><p className="muted">Your login is verified by Supabase and the backend confirms that your account is approved and active.</p><div className="details"><div><span>Customer ID</span><strong>{profile?.user_code || "Assigned"}</strong></div><div><span>Approval</span><strong className="green">{profile?.approval_status}</strong></div><div><span>Account status</span><strong className="green">{profile?.account_status}</strong></div></div><p className="small">This screen confirms account access only. Financial actions remain unavailable unless separately enabled.</p><button className="secondary full" onClick={signOut} disabled={loading}>Sign out</button></section></main>;
  }

  if (session && access && !access.allowed) {
    const pending = access.state === "pending";
    return <main className="page"><section className="panel wide"><Brand /><div className={pending ? "status-icon" : "status-icon muted-icon"}>{pending ? "…" : "!"}</div><p className="eyebrow">{pending ? "APPROVAL PENDING" : access.state === "rejected" ? "APPLICATION NOT APPROVED" : access.state === "inactive" ? "ACCOUNT INACTIVE" : "ACCOUNT CHECK"}</p><h1>{pending ? "Your account is created" : access.state === "rejected" ? "Approval was not granted" : "Access is not available yet"}</h1><p className="muted">{access.message}</p>{pending && <p className="small">This page checks again automatically every 8 seconds. Once the administrator approves and activates your account, access will update without creating another account.</p>}{error && <p className="alert error">{error}</p>}<button className="primary full" onClick={recheck} disabled={checking}>{checking ? "Checking…" : "Check approval status"}</button><button className="secondary full" onClick={signOut} disabled={loading}>Sign out</button></section></main>;
  }

  return <main className="page"><section className="panel"><Brand /><p className="eyebrow">CUSTOMER ACCOUNT</p><h1>{mode === "login" ? "Sign in" : "Create your account"}</h1><p className="muted">{mode === "login" ? "Use the email and password you registered with. Approved, active accounts can continue." : "Register once, confirm your email, then wait for administrator approval."}</p><form onSubmit={submit} noValidate>{mode === "register" && <label>Full name<input autoComplete="name" value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Your full name" required /></label>}<label>Email address<input type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" required /></label><label>Password<input type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} value={password} onChange={e => setPassword(e.target.value)} placeholder={mode === "login" ? "Your password" : "At least 8 characters"} minLength={8} required /></label>{error && <p role="alert" className="alert error">{error}</p>}{notice && <p role="status" className="alert notice">{notice}</p>}<button className="primary full" type="submit" disabled={loading}>{loading ? "Please wait…" : mode === "login" ? "Sign in securely" : "Create account"}</button></form><div className="switch">{mode === "login" ? "New to Invest Broker?" : "Already registered?"} <button className="link" onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); setNotice(""); }}> {mode === "login" ? "Create account" : "Sign in"}</button></div><p className="footnote">Access is granted only after email confirmation (when required), administrator approval, and active account status. Credentials are verified by Supabase; approval is verified by the backend.</p></section></main>;
}

function Brand() {
  return <div className="brand"><div className="brand-mark">IB</div><div><strong>INVEST BROKER</strong><span>Customer portal</span></div></div>;
}

createRoot(document.getElementById("root")).render(<React.StrictMode><App /></React.StrictMode>);
