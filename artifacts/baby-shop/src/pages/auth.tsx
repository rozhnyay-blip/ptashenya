import type { ReactNode } from "react";
import { Link } from "wouter";
import { SignIn, SignUp } from "@clerk/react";
import { ArrowLeft } from "lucide-react";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex min-h-[100dvh] flex-col items-center justify-center overflow-hidden bg-secondary/60 px-4 py-10">
      <div className="blob absolute -left-32 -top-32 h-96 w-96 bg-primary/25" />
      <div className="blob absolute -bottom-40 -right-24 h-[28rem] w-[28rem] bg-accent" />
      <img src={`${basePath}/chick.png`} alt="" className="absolute bottom-4 left-4 hidden h-40 w-40 animate-floaty object-contain md:block" />
      <Link href="/" className="relative mb-6 inline-flex items-center gap-1.5 rounded-full bg-card/80 px-4 py-2 text-sm font-semibold backdrop-blur" data-testid="link-auth-back"><ArrowLeft className="h-4 w-4" />До магазину</Link>
      <div className="relative w-full">{children}</div>
    </div>
  );
}

export function SignInPage() {
  return <AuthShell><SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} fallbackRedirectUrl={`${basePath}/admin`} forceRedirectUrl={`${basePath}/admin`} /></AuthShell>;
}
export function SignUpPage() {
  return <AuthShell><SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} fallbackRedirectUrl={`${basePath}/admin`} forceRedirectUrl={`${basePath}/admin`} /></AuthShell>;
}
