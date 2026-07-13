import { getSession } from "@/lib/auth";
import { firmObligations } from "@/lib/obligations";
import { CURRENT_QUARTER } from "@/lib/periods";
import Chrome from "./Chrome";

// Authenticated pages get the full Chrome (sidebar + topbar + Copilot);
// standalone pages (login, magic-link) render without it.
export default async function AppShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) return <>{children}</>;

  const obligations = await firmObligations(session.firmId, CURRENT_QUARTER);
  const clientsNeedingAttention = new Set(
    obligations.filter((o) => o.status === "missing" || o.reviewCount > 0).map((o) => o.clientId),
  ).size;
  const vatDue = obligations.filter((o) => o.status === "ready").length;
  const reviewItems = obligations.reduce((s, o) => s + o.reviewCount, 0);

  return (
    <Chrome name={session.name} badges={{ clients: clientsNeedingAttention, vat: vatDue, review: reviewItems }}>
      {children}
    </Chrome>
  );
}
