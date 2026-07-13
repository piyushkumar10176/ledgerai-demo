import { many, run } from "./db";

// MOCK mandation checker. Real product calls HMRC's ITSA Status + Business
// Details APIs per client. Here we derive a deterministic status from the
// client's estimated income (mocked) so the demo shows a realistic mix.

export interface MandationResult {
  clientId: number;
  status: "mandated" | "voluntary" | "not_mandated";
  wave: string | null;
  agentAuth: string;
}

// Deterministic pseudo "qualifying income" from the client id, used only to
// bucket demo clients into MTD waves.
function mockQualifyingIncome(clientId: number): number {
  const buckets = [65000, 42000, 28000, 95000, 18000, 55000];
  return buckets[clientId % buckets.length];
}

function bucket(income: number): { status: MandationResult["status"]; wave: string | null } {
  if (income > 50000) return { status: "mandated", wave: "2026" };
  if (income > 30000) return { status: "mandated", wave: "2027" };
  if (income > 20000) return { status: "mandated", wave: "2028" };
  return { status: "not_mandated", wave: null };
}

// Run the (mock) mandation check across every client in the firm and persist it.
export async function runMandationCheck(firmId: number): Promise<MandationResult[]> {
  const clients = await many<{ id: number; agent_auth_status: string }>(
    `SELECT id, agent_auth_status FROM clients WHERE firm_id = ?`,
    [firmId],
  );
  const results: MandationResult[] = [];
  for (const c of clients) {
    const b = bucket(mockQualifyingIncome(c.id));
    await run(
      `UPDATE clients SET mandation_status = ?, mandation_wave = ? WHERE id = ?`,
      [b.status, b.wave, c.id],
    );
    results.push({
      clientId: c.id,
      status: b.status,
      wave: b.wave,
      agentAuth: c.agent_auth_status,
    });
  }
  return results;
}
