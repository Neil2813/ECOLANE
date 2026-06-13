import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Mail, Lock, User, Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { EcoLogo } from "@/components/eco-logo";

export const Route = createFileRoute("/auth/signup")({
  component: SignUpPage,
});

function SignUpPage() {
  const navigate = useNavigate();
  const [show, setShow] = useState(false);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem("ecolens:auth", "demo");
    navigate({ to: "/map" });
  };

  return (
    <div className="mx-auto flex min-h-screen max-w-md items-center justify-center bg-background px-6 py-10 grid-bg">
      <form onSubmit={submit} className="w-full rounded-3xl border border-border bg-card/80 p-8 backdrop-blur">
        <div className="flex flex-col items-center gap-2 text-center">
          <EcoLogo size={36} />
          <h1 className="text-2xl font-bold">Create your EcoLens</h1>
          <p className="text-xs text-muted-foreground">Start breathing smarter today</p>
        </div>

        <div className="mt-8 space-y-4">
          <Field label="Full name" icon={<User className="h-4 w-4" />}>
            <input required placeholder="Jane Doe" className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground" />
          </Field>
          <Field label="Email" icon={<Mail className="h-4 w-4" />}>
            <input type="email" required placeholder="you@ecolens.net" className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground" />
          </Field>
          <Field label="Password" icon={<Lock className="h-4 w-4" />}>
            <input type={show ? "text" : "password"} required placeholder="At least 8 characters" className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground" />
            <button type="button" onClick={() => setShow(!show)} className="text-muted-foreground">
              {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </Field>
        </div>

        <button type="submit" className="mt-6 w-full rounded-2xl bg-eco-orange py-3.5 text-base font-semibold text-background">
          Create Account
        </button>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          By continuing you agree to our Terms & Privacy Policy.
        </p>

        <div className="mt-5 border-t border-border pt-4 text-center text-sm">
          <Link to="/auth/signin" className="text-muted-foreground">
            Already have an account?{" "}
            <span className="text-eco-cream underline decoration-eco-green underline-offset-4">Sign In</span>
          </Link>
        </div>
      </form>
    </div>
  );
}

function Field({ label, icon, children }: { label?: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      {label && <div className="mb-2 font-mono text-xs uppercase tracking-widest text-muted-foreground">{label}</div>}
      <div className="flex items-center gap-3 rounded-2xl border border-border bg-input px-4 py-3">
        <span className="text-muted-foreground">{icon}</span>
        {children}
      </div>
    </div>
  );
}
