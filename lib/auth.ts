import crypto from "node:crypto";
import { cookies } from "next/headers";
import { one } from "./db";

// DEMO auth: hashed passwords (scrypt) + a signed session cookie (HMAC).
// Simple by design — the FRD's real target is Keycloak. See NOTES.md.
const SECRET =
  process.env.SESSION_SECRET || "ledgerai-demo-dev-secret-change-me";
const COOKIE = "ledgerai_session";

export function hashPassword(pw: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(pw, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(pw: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const test = crypto.scryptSync(pw, salt, 64).toString("hex");
  const a = Buffer.from(hash, "hex");
  const b = Buffer.from(test, "hex");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export interface Session {
  userId: number;
  firmId: number;
  name: string;
  email: string;
}

function sign(payload: string): string {
  return crypto.createHmac("sha256", SECRET).update(payload).digest("base64url");
}

function serialize(s: Session): string {
  const body = Buffer.from(JSON.stringify(s)).toString("base64url");
  return `${body}.${sign(body)}`;
}

function deserialize(token: string): Session | null {
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  if (sign(body) !== sig) return null; // tamper check
  try {
    return JSON.parse(Buffer.from(body, "base64url").toString());
  } catch {
    return null;
  }
}

export async function authenticate(
  email: string,
  password: string,
): Promise<Session | null> {
  const u = await one<{
    id: number;
    firm_id: number;
    name: string;
    email: string;
    password_hash: string;
  }>(`SELECT * FROM users WHERE email = ?`, [email.trim().toLowerCase()]);
  if (!u) return null;
  if (!verifyPassword(password, u.password_hash)) return null;
  return { userId: u.id, firmId: u.firm_id, name: u.name, email: u.email };
}

export async function setSessionCookie(s: Session): Promise<void> {
  const jar = await cookies();
  jar.set(COOKIE, serialize(s), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 8,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const jar = await cookies();
  jar.delete(COOKIE);
}

export async function getSession(): Promise<Session | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  return token ? deserialize(token) : null;
}
