import { getSession } from "@/lib/auth";
import Sidebar from "./Sidebar";

// Renders the sidebar app shell for authenticated pages; standalone pages
// (login, magic-link) render without it.
export default async function AppShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) return <>{children}</>;

  return (
    <div className="min-h-screen">
      <Sidebar name={session.name} />
      <div className="lg:pl-60">{children}</div>
    </div>
  );
}
