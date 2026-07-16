import crypto from "node:crypto";
import { one, run } from "./db";

// Magic-link data collection: a per-client token gives a no-login upload page
// (PRD §6.2 — "zero client behaviour change"). SMS/email delivery is mocked.

export async function createMagicLink(
  firmId: number,
  clientId: number,
): Promise<string> {
  const token = crypto.randomBytes(18).toString("base64url");
  const expires = new Date(Date.now() + 14 * 24 * 3600 * 1000).toISOString();
  await run(
    `INSERT INTO magic_links (firm_id, client_id, token, expires_at)
     VALUES (?, ?, ?, ?)`,
    [firmId, clientId, token, expires],
  );
  return token;
}

export interface MagicLinkTarget {
  clientId: number;
  firmId: number;
  clientName: string;
  used_at: string | null;
  expires_at: string | null;
}

export async function resolveMagicLink(
  token: string,
): Promise<MagicLinkTarget | null> {
  const row = await one<{
    client_id: number;
    firm_id: number;
    name: string;
    used_at: string | null;
    expires_at: string | null;
  }>(
    `SELECT m.client_id, m.firm_id, c.name, m.used_at, m.expires_at
       FROM magic_links m JOIN clients c ON c.id = m.client_id
      WHERE m.token = ?`,
    [token],
  );
  if (!row) return null;
  // Enforce the lifetime (security audit fix): an expired link is dead. Links
  // stay multi-use WITHIN the window (clients upload several times), so used_at
  // is an audit stamp, not a lock.
  if (row.expires_at && new Date(row.expires_at).getTime() < Date.now())
    return null;
  return {
    clientId: row.client_id,
    firmId: row.firm_id,
    clientName: row.name,
    used_at: row.used_at,
    expires_at: row.expires_at,
  };
}

/** Revoke every live link for a client (e.g. sent to the wrong number). */
export async function revokeMagicLinks(firmId: number, clientId: number): Promise<void> {
  await run(
    `UPDATE magic_links SET expires_at = datetime('now')
      WHERE firm_id = ? AND client_id = ?`,
    [firmId, clientId],
  );
}

export async function markMagicLinkUsed(token: string): Promise<void> {
  await run(`UPDATE magic_links SET used_at = datetime('now') WHERE token = ?`, [
    token,
  ]);
}
