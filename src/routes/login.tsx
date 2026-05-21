import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { Eye, EyeOff } from "lucide-react";
import { useApp } from "@/lib/spectr-store";
import { SpectrLogo } from "@/components/spectr/Logo";

export const Route = createFileRoute("/login")({ component: () => <AuthPage initialTab="login" /> });

function emailValid(e: string) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e); }

export function AuthPage({ initialTab }: { initialTab: "login" | "signup" }) {
  const { state, update } = useApp();
  const navigate = useNavigate();
  const [tab, setTab] = useState<"login" | "signup">(initialTab);
  useEffect(() => { setTab(initialTab); }, [initialTab]);

  useEffect(() => {
    if (state.isAuthenticated) {
      navigate({ to: state.setupComplete ? "/transform" : "/setup" });
    }
  }, [state.isAuthenticated, state.setupComplete, navigate]);

  // form state
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [pwd, setPwd] = useState("");
  const [pwd2, setPwd2] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [showPwd2, setShowPwd2] = useState(false);
  const [errs, setErrs] = useState<Record<string, string>>({});

  const switchTab = (t: "login" | "signup") => {
    setTab(t); setErrs({});
    window.history.replaceState(null, "", t === "login" ? "/login" : "/signup");
  };

  const onSignup = (e: FormEvent) => {
    e.preventDefault();
    const er: Record<string, string> = {};
    if (!name.trim()) er.name = "Full name is required";
    if (!email.trim()) er.email = "Email is required";
    else if (!emailValid(email)) er.email = "Please enter a valid email";
    if (!pwd) er.pwd = "Password is required";
    if (!pwd2) er.pwd2 = "Please confirm your password";
    else if (pwd !== pwd2) er.pwd2 = "Passwords do not match";
    setErrs(er);
    if (Object.keys(er).length) return;
    const user = { name: name.trim(), email: email.trim().toLowerCase(), password: pwd };
    update({
      users: [...state.users.filter((u) => u.email !== user.email), user],
      user, isAuthenticated: true, setupComplete: false, setupStep: 1,
    });
    navigate({ to: "/setup" });
  };

  const onLogin = (e: FormEvent) => {
    e.preventDefault();
    const er: Record<string, string> = {};
    if (!email.trim()) er.email = "Email is required";
    else if (!emailValid(email)) er.email = "Please enter a valid email";
    if (!pwd) er.pwd = "Password is required";
    setErrs(er);
    if (Object.keys(er).length) return;
    const found = state.users.find((u) => u.email === email.trim().toLowerCase() && u.password === pwd);
    if (!found) {
      // allow first-time demo log-in by creating user too — but per spec we'd just error
      setErrs({ pwd: "Invalid email or password" }); return;
    }
    update({ user: found, isAuthenticated: true });
    navigate({ to: state.setupComplete ? "/transform" : "/setup" });
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-10" style={{ background: "var(--color-surface)" }}>
      <div className="mb-6"><SpectrLogo size={40} showTag /></div>
      <div className="w-full max-w-[440px] spectr-card overflow-hidden">
        <div className="flex border-b" style={{ borderColor: "var(--color-border)" }}>
          {(["login", "signup"] as const).map((t) => (
            <button key={t} onClick={() => switchTab(t)}
              className="flex-1 py-3 text-sm font-semibold transition-colors"
              style={{
                color: tab === t ? "var(--color-primary)" : "var(--color-text-secondary)",
                borderBottom: `2px solid ${tab === t ? "var(--color-primary)" : "transparent"}`,
                background: "white",
              }}>
              {t === "login" ? "Log In" : "Sign Up"}
            </button>
          ))}
        </div>
        <div className="p-6 transition-opacity" key={tab} style={{ animation: "spectr-slide-in-right 0.25s ease" }}>
          {tab === "signup" ? (
            <form onSubmit={onSignup} className="space-y-4">
              <Field label="Full Name" error={errs.name}>
                <input className="spectr-input" placeholder="Your full name" value={name} onChange={(e) => setName(e.target.value)} />
              </Field>
              <Field label="Email" error={errs.email}>
                <input className="spectr-input" placeholder="you@company.com" value={email} onChange={(e) => setEmail(e.target.value)} />
              </Field>
              <Field label="Password" error={errs.pwd}>
                <PasswordInput value={pwd} onChange={setPwd} show={showPwd} setShow={setShowPwd} placeholder="Create a password" />
              </Field>
              <Field label="Confirm Password" error={errs.pwd2}>
                <PasswordInput value={pwd2} onChange={setPwd2} show={showPwd2} setShow={setShowPwd2} placeholder="Confirm your password" />
              </Field>
              <button type="submit" className="spectr-btn-primary w-full">Create Account</button>
              <p className="text-sm text-center" style={{ color: "var(--color-text-secondary)" }}>
                Already have an account?{" "}
                <button type="button" onClick={() => switchTab("login")} className="font-semibold" style={{ color: "var(--color-primary)" }}>Log In</button>
              </p>
            </form>
          ) : (
            <form onSubmit={onLogin} className="space-y-4">
              <Field label="Email" error={errs.email}>
                <input className="spectr-input" placeholder="you@company.com" value={email} onChange={(e) => setEmail(e.target.value)} />
              </Field>
              <Field label="Password" error={errs.pwd}>
                <PasswordInput value={pwd} onChange={setPwd} show={showPwd} setShow={setShowPwd} placeholder="Your password" />
                <button type="button" className="text-xs mt-2 font-semibold" style={{ color: "var(--color-primary)" }}>Forgot password?</button>
              </Field>
              <button type="submit" className="spectr-btn-primary w-full">Log In</button>
              <p className="text-sm text-center" style={{ color: "var(--color-text-secondary)" }}>
                Don't have an account?{" "}
                <button type="button" onClick={() => switchTab("signup")} className="font-semibold" style={{ color: "var(--color-primary)" }}>Sign Up</button>
              </p>
            </form>
          )}
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

function PasswordInput({ value, onChange, show, setShow, placeholder }:
  { value: string; onChange: (v: string) => void; show: boolean; setShow: (v: boolean) => void; placeholder: string }) {
  return (
    <div className="relative">
      <input className="spectr-input pr-10" type={show ? "text" : "password"} placeholder={placeholder}
        value={value} onChange={(e) => onChange(e.target.value)} />
      <button type="button" onClick={() => setShow(!show)}
        className="absolute right-3 top-1/2 -translate-y-1/2"
        style={{ color: "var(--color-text-secondary)" }}>
        {show ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  );
}
