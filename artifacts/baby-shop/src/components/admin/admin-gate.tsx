import type { ReactNode } from "react";
import { Link } from "wouter";
import { useClerk } from "@clerk/react";
import { Lock, ShieldX } from "lucide-react";
import { useGetMe } from "@workspace/api-client-react";
import { LogoMark } from "@/components/store/logo";
import { AdminLayout } from "./admin-layout";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex min-h-[100dvh] items-center justify-center overflow-hidden bg-sidebar px-4 text-sidebar-foreground">
      <div className="blob absolute -left-24 -top-24 h-80 w-80 bg-primary/30" />
      <div className="blob absolute -bottom-32 -right-20 h-96 w-96 bg-secondary/20" />
      <div className="relative w-full max-w-md rounded-[2rem] border border-sidebar-border bg-sidebar-accent/60 p-8 text-center backdrop-blur">{children}</div>
    </div>
  );
}

export function AdminGate({ children }: { children: ReactNode }) {
  const { data: me, isLoading, isError, refetch } = useGetMe();
  const { signOut } = useClerk();
  if (isLoading) return <div className="flex min-h-[100dvh] items-center justify-center bg-sidebar"><LogoMark className="h-14 w-14 animate-pulse" /></div>;
  if (isError) return <Shell><h1 className="font-display text-xl font-bold">Не вдалося перевірити доступ</h1><button onClick={() => refetch()} className="mt-5 rounded-full bg-primary px-6 py-3 font-semibold text-primary-foreground" data-testid="button-retry-me">Спробувати знову</button></Shell>;
  if (!me?.signedIn) return (
    <Shell>
      <div className="mx-auto mb-5 grid h-16 w-16 place-items-center rounded-2xl bg-primary"><Lock className="h-7 w-7 text-primary-foreground" /></div>
      <h1 className="font-display text-2xl font-bold">Вхід для власника</h1>
      <p className="mt-2 text-sm text-sidebar-foreground/70">Тут живуть замовлення, статистика й синхронізація зі складом. Увійдіть, щоб продовжити.</p>
      <Link href="/sign-in" className="mt-6 flex h-12 items-center justify-center rounded-full bg-primary font-bold text-primary-foreground" data-testid="link-admin-sign-in">Увійти</Link>
      <Link href="/" className="mt-3 block text-sm text-sidebar-foreground/60 hover:text-sidebar-foreground">Повернутися до магазину</Link>
    </Shell>
  );
  if (!me.isAdmin) return (
    <Shell>
      <div className="mx-auto mb-5 grid h-16 w-16 place-items-center rounded-2xl bg-destructive"><ShieldX className="h-7 w-7 text-white" /></div>
      <h1 className="font-display text-2xl font-bold">Доступ заборонено</h1>
      <p className="mt-2 text-sm text-sidebar-foreground/70">Обліковий запис <b className="text-sidebar-foreground">{me.email}</b> не має прав власника магазину.</p>
      <button type="button" onClick={() => signOut({ redirectUrl: basePath || "/" })} className="mt-6 h-12 w-full rounded-full bg-primary font-bold text-primary-foreground" data-testid="button-denied-sign-out">Вийти з акаунта</button>
      <Link href="/" className="mt-3 block text-sm text-sidebar-foreground/60 hover:text-sidebar-foreground">До магазину</Link>
    </Shell>
  );
  return <AdminLayout>{children}</AdminLayout>;
}
