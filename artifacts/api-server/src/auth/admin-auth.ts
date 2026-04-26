import type { NextFunction, Request, RequestHandler, Response } from "express";
import jwt from "jsonwebtoken";
import type { JwtPayload, SignOptions } from "jsonwebtoken";
import { db } from "@workspace/db";
import { adminsTable } from "../../../../lib/db/src/schema/admins";
import { eq } from "drizzle-orm";

export const ADMIN_COOKIE_NAME = "admin_session";
const ADMIN_TOKEN_TTL_MS = 1000 * 60 * 60 * 12;
const ADMIN_TOKEN_TTL_SECONDS = Math.floor(ADMIN_TOKEN_TTL_MS / 1000);

const allowedRoles = new Set(["super_admin", "staff"] as const);

export type AdminRole = "super_admin" | "staff";

export type AdminJwtPayload = JwtPayload & {
  adminId: number;
  role: AdminRole;
};

function getAdminJwtSecret(): string {
  const secret = process.env["ADMIN_JWT_SECRET"]?.trim() || process.env["JWT_SECRET"]?.trim();
  if (!secret) {
    throw new Error("ADMIN_JWT_SECRET must be set");
  }
  return secret;
}

export function normalizeAdminEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isAdminRole(value: string): value is AdminRole {
  return allowedRoles.has(value as AdminRole);
}

export function getAdminCookieOptions() {
  const isProduction = process.env.NODE_ENV === "production";

  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? ("none" as const) : ("lax" as const),
    maxAge: ADMIN_TOKEN_TTL_MS,
    path: "/",
  };
}

export function signAdminToken(payload: { adminId: number; role: AdminRole }): string {
  const options: SignOptions = { expiresIn: ADMIN_TOKEN_TTL_SECONDS };
  return jwt.sign(payload, getAdminJwtSecret(), options);
}

export function setAdminSessionCookie(
  res: Response,
  payload: { adminId: number; role: AdminRole },
): void {
  res.cookie(ADMIN_COOKIE_NAME, signAdminToken(payload), getAdminCookieOptions());
}

export function clearAdminSessionCookie(res: Response): void {
  res.clearCookie(ADMIN_COOKIE_NAME, getAdminCookieOptions());
}

export function verifyAdminToken(token: string): AdminJwtPayload {
  const decoded = jwt.verify(token, getAdminJwtSecret());
  if (
    !decoded ||
    typeof decoded !== "object" ||
    typeof decoded["adminId"] !== "number" ||
    typeof decoded["role"] !== "string" ||
    !isAdminRole(decoded["role"])
  ) {
    throw new Error("Invalid admin token");
  }

  return decoded as AdminJwtPayload;
}

async function loadAdminFromRequest(req: Request) {
  if (req.admin) {
    return req.admin;
  }

  const token = req.cookies?.[ADMIN_COOKIE_NAME];
  if (!token || typeof token !== "string") {
    return null;
  }

  const payload = verifyAdminToken(token);
  const [admin] = await db
    .select({
      id: adminsTable.id,
      email: adminsTable.email,
      role: adminsTable.role,
      createdAt: adminsTable.createdAt,
    })
    .from(adminsTable)
    .where(eq(adminsTable.id, payload.adminId))
    .limit(1);

  if (!admin || !isAdminRole(admin.role)) {
    return null;
  }

  req.admin = {
    id: admin.id,
    email: admin.email,
    role: admin.role,
    createdAt: admin.createdAt,
  };

  return req.admin;
}

export const requireAdminAuth: RequestHandler = async (req, res, next) => {
  try {
    const admin = await loadAdminFromRequest(req);
    if (!admin) {
      clearAdminSessionCookie(res);
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    next();
  } catch (_error) {
    clearAdminSessionCookie(res);
    res.status(401).json({ error: "Unauthorized" });
  }
};

export function requireAdminRole(...roles: AdminRole[]): RequestHandler {
  return (req, res, next) => {
    if (!req.admin) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    if (!roles.includes(req.admin.role)) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    next();
  };
}

type LoginAttemptState = {
  count: number;
  firstAttemptAt: number;
  blockedUntil: number | null;
};

const MAX_LOGIN_ATTEMPTS = 5;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_BLOCK_MS = 15 * 60 * 1000;
const loginAttempts = new Map<string, LoginAttemptState>();

function getLoginAttemptKey(req: Request, email: string): string {
  const ip = req.ip || req.socket.remoteAddress || "unknown";
  return `${ip}:${normalizeAdminEmail(email)}`;
}

function getAttemptState(key: string): LoginAttemptState {
  const now = Date.now();
  const existing = loginAttempts.get(key);
  if (!existing || now - existing.firstAttemptAt > LOGIN_WINDOW_MS) {
    const nextState = { count: 0, firstAttemptAt: now, blockedUntil: null };
    loginAttempts.set(key, nextState);
    return nextState;
  }
  return existing;
}

export function ensureLoginAttemptAllowed(req: Request, email: string): void {
  const key = getLoginAttemptKey(req, email);
  const state = getAttemptState(key);
  const now = Date.now();

  if (state.blockedUntil && state.blockedUntil > now) {
    const retryAfterSeconds = Math.ceil((state.blockedUntil - now) / 1000);
    const error = new Error("Too many login attempts");
    (error as Error & { retryAfterSeconds?: number }).retryAfterSeconds = retryAfterSeconds;
    throw error;
  }
}

export function registerFailedLoginAttempt(req: Request, email: string): number | null {
  const key = getLoginAttemptKey(req, email);
  const state = getAttemptState(key);
  state.count += 1;

  if (state.count >= MAX_LOGIN_ATTEMPTS) {
    state.blockedUntil = Date.now() + LOGIN_BLOCK_MS;
    return Math.ceil(LOGIN_BLOCK_MS / 1000);
  }

  return null;
}

export function resetLoginAttempts(req: Request, email: string): void {
  loginAttempts.delete(getLoginAttemptKey(req, email));
}

export function withAsyncRoute(
  handler: (req: Request, res: Response, next: NextFunction) => Promise<void>,
): RequestHandler {
  return (req, res, next) => {
    void handler(req, res, next).catch(next);
  };
}
