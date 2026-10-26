import type { Request, Response, NextFunction } from "express";
import { getAuth, clerkClient } from "@clerk/express";

/** The only account allowed into the admin panel. */
export const ADMIN_EMAIL = (process.env.ADMIN_EMAIL ?? "rozhnyay@gmail.com").trim().toLowerCase();

interface Identity {
  userId: string | null;
  email: string | null;
  isAdmin: boolean;
}

const cache = new Map<string, { value: Identity; expires: number }>();

export async function resolveIdentity(req: Request): Promise<Identity> {
  const auth = getAuth(req);
  const userId = (auth?.sessionClaims?.userId as string | undefined) || auth?.userId || null;
  if (!userId) return { userId: null, email: null, isAdmin: false };

  const hit = cache.get(userId);
  if (hit && hit.expires > Date.now()) return hit.value;

  const user = await clerkClient.users.getUser(userId);
  const verified = user.emailAddresses.filter((e) => e.verification?.status === "verified");
  const primary =
    user.emailAddresses.find((e) => e.id === user.primaryEmailAddressId)?.emailAddress ?? null;
  const isAdmin = verified.some((e) => e.emailAddress.trim().toLowerCase() === ADMIN_EMAIL);
  const value: Identity = { userId, email: primary, isAdmin };
  cache.set(userId, { value, expires: Date.now() + 60_000 });
  return value;
}

export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  try {
    const identity = await resolveIdentity(req);
    if (!identity.userId) {
      res.status(401).json({ error: "Потрібно увійти" });
      return;
    }
    if (!identity.isAdmin) {
      res.status(403).json({ error: "Доступ заборонено" });
      return;
    }
    next();
  } catch (err) {
    req.log.error({ err }, "Admin check failed");
    res.status(500).json({ error: "Помилка перевірки доступу" });
  }
}
