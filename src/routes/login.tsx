import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { Eye, EyeOff } from "lucide-react";
import { useApp } from "@/lib/spectr-store";
import supabase from "@/lib/supabase";

export const Route = createFileRoute("/login")({ component: () => <AuthPage initialTab="login" /> });

function emailValid(e: string) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e); }

export function AuthPage({ initialTab }: { initialTab: "login" | "signup" }) {
  const { state } = useApp();
  const navigate = useNavigate();
  const [tab, setTab] = useState<"login" | "signup">(initialTab);
  useEffect(() => { setTab(initialTab); }, [initialTab]);

  useEffect(() => {
    if (localStorage.getItem("spectr-access-verified") !== "true") {
      navigate({ to: "/access" });
      return;
    }
    if (state.isAuthenticated) navigate({ to: "/companies" });
  }, [state.isAuthenticated, navigate]);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [pwd, setPwd] = useState("");
  const [pwd2, setPwd2] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [showPwd2, setShowPwd2] = useState(false);
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  const switchTab = (t: "login" | "signup") => {
    setTab(t); setErrs({}); setEmailSent(false);
    window.history.replaceState(null, "", t === "login" ? "/login" : "/signup");
  };

  const onSignup = async (e: FormEvent) => {
    e.preventDefault();
    const er: Record<string, string> = {};
    if (!name.trim()) er.name = "Full name is required";
    if (!email.trim()) er.email = "Email is required";
    else if (!emailValid(email)) er.email = "Please enter a valid email";
    if (!pwd) er.pwd = "Password is required";
    else if (pwd.length < 6) er.pwd = "Password must be at least 6 characters";
    if (!pwd2) er.pwd2 = "Please confirm your password";
    else if (pwd !== pwd2) er.pwd2 = "Passwords do not match";
    setErrs(er);
    if (Object.keys(er).length) return;

    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(), password: pwd,
      options: { data: { name: name.trim() } },
    });
    setLoading(false);

    if (error) {
      if (error.message.toLowerCase().includes("already registered")) {
        setErrs({ email: "An account with this email already exists" });
      } else { setErrs({ pwd: error.message }); }
      return;
    }
    if (data.user) {
      await supabase.from("profiles").upsert(
        { id: data.user.id, email: data.user.email!, full_name: name.trim() },
        { onConflict: "id" },
      );
    }
    if (data.session) { navigate({ to: "/companies" }); }
    else { setEmailSent(true); }
  };

  const onLogin = async (e: FormEvent) => {
    e.preventDefault();
    const er: Record<string, string> = {};
    if (!email.trim()) er.email = "Email is required";
    else if (!emailValid(email)) er.email = "Please enter a valid email";
    if (!pwd) er.pwd = "Password is required";
    setErrs(er);
    if (Object.keys(er).length) return;

    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(), password: pwd,
    });
    setLoading(false);
    if (error) { setErrs({ pwd: "Invalid email or password" }); }
  };

  const hasError = !!(errs.email || errs.pwd || errs.pwd2 || errs.name);

  return (
    <div style={{ height: "100vh", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", padding: 40 }}>
      {/* Shell frame */}
      <div style={{
        width: 1240, height: 760, display: "flex", borderRadius: 44,
        background: "linear-gradient(160deg,rgba(40,100,190,0.34),rgba(20,70,150,0.3))",
        border: "1px solid rgba(255,255,255,0.4)",
        backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)",
        boxShadow: "0 0 0 6px rgba(255,255,255,0.92), 0 50px 120px rgba(3,30,70,0.38)",
        overflow: "hidden",
      }}>

        {/* Left: form */}
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", padding: "36px 40px", boxSizing: "border-box" }}>
          {/* Logo */}
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: "#ffffff", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 8px 20px rgba(10,102,194,0.3)" }}>
              <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24">
                <polygon points="12,3 21,21 12,21" fill="#0a66c2" />
                <polygon points="12,3 12,21 3,21" fill="#0a66c2" fillOpacity="0.55" />
              </svg>
            </div>
            <div>
              <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: "0.02em", lineHeight: 1.1 }}>SPECTR</div>
              <div style={{ marginTop: 2, fontSize: 12, color: "rgba(255,255,255,0.88)" }}>Content Transformation Engine</div>
            </div>
          </div>

          {/* Form content */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
            <div style={{ width: 368 }}>
              {emailSent ? (
                <div style={{ textAlign: "center" }}>
                  <div style={{ width: 56, height: 56, borderRadius: 18, background: "rgba(255,255,255,0.18)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
                    <svg aria-hidden="true" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" />
                    </svg>
                  </div>
                  <h1 style={{ margin: 0, fontSize: 28, fontWeight: 300, letterSpacing: "-0.02em" }}>Check your email</h1>
                  <p style={{ marginTop: 10, fontSize: 15, color: "rgba(255,255,255,0.88)", lineHeight: 1.5 }}>
                    We sent a confirmation link to <strong>{email}</strong>. Click it to activate your account.
                  </p>
                  <button onClick={() => { setEmailSent(false); switchTab("login"); }}
                    className="spectr-btn-primary" style={{ marginTop: 28, width: "100%" }}>
                    Go to Log In
                  </button>
                </div>
              ) : (
                <>
                  <div style={{ textAlign: "center" }}>
                    <h1 style={{ margin: 0, fontSize: 34, fontWeight: 300, letterSpacing: "-0.02em", color: "#ffffff" }}>
                      {tab === "login" ? "Log In" : "Sign Up"}
                    </h1>
                    <p style={{ margin: "8px 0 0", fontSize: 15, color: "rgba(255,255,255,0.88)" }}>
                      {tab === "login" ? "Enter your credentials to get in" : "Create your account to get started"}
                    </p>
                  </div>

                  <div key={tab} style={{ marginTop: 28, display: "flex", flexDirection: "column", gap: 16, animation: "spectr-slide-in-right 0.25s ease" }}>
                    {tab === "signup" && (
                      <Field label="Full Name" error={errs.name}>
                        <input className="spectr-input" placeholder="Your full name" value={name} onChange={(e) => setName(e.target.value)} disabled={loading} />
                      </Field>
                    )}
                    <Field label="Email" error={errs.email}>
                      <input className="spectr-input" type="email" placeholder="you@company.com" value={email}
                        onChange={(e) => setEmail(e.target.value)} disabled={loading}
                        style={{ border: errs.email ? "1px solid #ffb4ab" : undefined }} />
                    </Field>
                    <Field label="Password" error={errs.pwd}>
                      <div style={{ position: "relative" }}>
                        <input className="spectr-input" type={showPwd ? "text" : "password"} placeholder="Your password"
                          value={pwd} onChange={(e) => setPwd(e.target.value)} disabled={loading}
                          style={{ paddingRight: 48, border: (errs.pwd && !errs.email) ? "1px solid #ffb4ab" : undefined }} />
                        <button type="button" onClick={() => setShowPwd((v) => !v)}
                          style={{ position: "absolute", right: 8, top: 6, width: 36, height: 36, border: 0, borderRadius: 8, background: "transparent", color: "rgba(255,255,255,0.88)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          {showPwd ? <EyeOff size={20} /> : <Eye size={20} />}
                        </button>
                      </div>
                    </Field>
                    {tab === "signup" && (
                      <Field label="Confirm Password" error={errs.pwd2}>
                        <div style={{ position: "relative" }}>
                          <input className="spectr-input" type={showPwd2 ? "text" : "password"} placeholder="Confirm your password"
                            value={pwd2} onChange={(e) => setPwd2(e.target.value)} disabled={loading} style={{ paddingRight: 48 }} />
                          <button type="button" onClick={() => setShowPwd2((v) => !v)}
                            style={{ position: "absolute", right: 8, top: 6, width: 36, height: 36, border: 0, borderRadius: 8, background: "transparent", color: "rgba(255,255,255,0.88)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            {showPwd2 ? <EyeOff size={20} /> : <Eye size={20} />}
                          </button>
                        </div>
                      </Field>
                    )}

                    {hasError && tab === "login" && (
                      <div className="spectr-alert-error">
                        <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}>
                          <circle cx="12" cy="12" r="9" /><path d="M12 8v5" /><path d="M12 16.5v.01" />
                        </svg>
                        <div>Email or password is incorrect. Check them and try again.</div>
                      </div>
                    )}

                    <button
                      onClick={tab === "login" ? onLogin as any : onSignup as any}
                      disabled={loading}
                      className="spectr-btn-primary"
                      style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}
                    >
                      {loading && (
                        <svg className="spectr-spin" aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0a66c2" strokeWidth="3" strokeLinecap="round">
                          <path d="M12 3a9 9 0 1 0 9 9" />
                        </svg>
                      )}
                      {loading ? (tab === "login" ? "Logging in" : "Creating account") : (tab === "login" ? "Log In" : "Create Account")}
                    </button>
                  </div>

                  <div style={{ marginTop: 20, textAlign: "center", fontSize: 14, color: "rgba(255,255,255,0.88)" }}>
                    {tab === "login" ? "Not a member?" : "Already have an account?"}
                    <button onClick={() => switchTab(tab === "login" ? "signup" : "login")}
                      style={{ marginLeft: 6, padding: 0, border: 0, background: "transparent", fontSize: 14, fontWeight: 600, color: "#ffffff", textDecoration: "underline", cursor: "pointer", fontFamily: "inherit" }}>
                      {tab === "login" ? "Create an account" : "Log in"}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Right: decorative blue panel */}
        <div style={{
          position: "relative", width: 600, height: 740, margin: "10px 10px 10px 0",
          borderRadius: 34, overflow: "hidden", flexShrink: 0,
          background: "linear-gradient(165deg,#8fc0f7 0%,#3b86dc 34%,#0a66c2 58%,#062a5c 100%)",
        }}>
          <svg aria-hidden="true" width="600" height="740" viewBox="0 0 600 740" style={{ position: "absolute", left: 0, top: 0 }}>
            <defs>
              <linearGradient id="rb1" x1="0" y1="1" x2="1" y2="0">
                <stop offset="0" stopColor="#ffffff" stopOpacity="0" />
                <stop offset="0.55" stopColor="#ffffff" stopOpacity="0.38" />
                <stop offset="1" stopColor="#ffffff" stopOpacity="0.8" />
              </linearGradient>
              <linearGradient id="rb2" x1="0" y1="1" x2="1" y2="0">
                <stop offset="0" stopColor="#9cc8fa" stopOpacity="0" />
                <stop offset="0.6" stopColor="#9cc8fa" stopOpacity="0.35" />
                <stop offset="1" stopColor="#ffffff" stopOpacity="0.6" />
              </linearGradient>
              <linearGradient id="rb3" x1="0" y1="1" x2="1" y2="0">
                <stop offset="0" stopColor="#2b7cd6" stopOpacity="0" />
                <stop offset="0.6" stopColor="#4f93e3" stopOpacity="0.5" />
                <stop offset="1" stopColor="#cfe4fc" stopOpacity="0.55" />
              </linearGradient>
              <radialGradient id="lglow" cx="50%" cy="50%" r="50%">
                <stop offset="0" stopColor="#ffffff" stopOpacity="0.85" />
                <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
              </radialGradient>
              <linearGradient id="lfade" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#021028" stopOpacity="0" />
                <stop offset="1" stopColor="#021028" stopOpacity="0.82" />
              </linearGradient>
            </defs>
            <circle cx="500" cy="170" r="260" fill="url(#lglow)" opacity="0.6" />
            <path d="M-40 700 C 90 690 190 560 300 470 S 520 260 650 120 L 650 330 C 540 420 440 560 320 640 S 120 770 -40 800 Z" fill="url(#rb3)" />
            <path d="M-40 640 C 100 620 190 480 310 410 S 520 210 650 70 L 650 250 C 550 350 450 500 330 570 S 110 700 -40 740 Z" fill="url(#rb2)" />
            <path d="M-40 580 C 110 550 200 410 320 350 S 520 170 650 30 L 650 170 C 560 270 460 430 340 500 S 120 630 -40 680 Z" fill="url(#rb1)" />
            <rect x="0" y="420" width="600" height="320" fill="url(#lfade)" />
          </svg>
          <div style={{ position: "absolute", top: 20, right: 20, width: 44, height: 44, borderRadius: 22, background: "#ffffff", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24">
              <polygon points="12,3 21,21 12,21" fill="#0a66c2" />
              <polygon points="12,3 12,21 3,21" fill="#0a66c2" fillOpacity="0.55" />
            </svg>
          </div>
          <div style={{ position: "absolute", left: 36, right: 36, bottom: 40, color: "#ffffff", fontSize: 34, lineHeight: 1.2, fontWeight: 300, letterSpacing: "-0.01em" }}>
            <div>The growth engine for</div>
            <div style={{ fontWeight: 700 }}>your startup.</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="spectr-label">{label}</label>
      {children}
      {error && <p className="field-error">{error}</p>}
    </div>
  );
}
