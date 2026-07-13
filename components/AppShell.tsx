import { getSession } from "@/lib/auth";
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
  return <Chrome name={session.name}>{children}</Chrome>;
}
