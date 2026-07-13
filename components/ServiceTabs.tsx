import Link from "next/link";
import { SERVICES, type ServiceKey } from "@/lib/services";

// Renders tabs ONLY for the services this client has selected, plus overview
// and a settings tab.
export default function ServiceTabs({
  clientId,
  active,
  services,
}: {
  clientId: number;
  active: string;
  services: ServiceKey[];
}) {
  const tabs = [
    { key: "overview", label: "Overview", href: "", emoji: "🏠" },
    ...SERVICES.filter((s) => services.includes(s.key)).map((s) => ({
      key: s.key,
      label: s.label,
      href: `/${s.href}`,
      emoji: s.emoji,
    })),
    { key: "services", label: "Services", href: "/services", emoji: "⚙️" },
  ];

  return (
    <nav className="mt-5 flex flex-wrap gap-1 border-b border-stone-200">
      {tabs.map((t) => {
        const on = t.key === active;
        return (
          <Link
            key={t.key}
            href={`/clients/${clientId}${t.href}`}
            className={
              "flex items-center gap-1.5 border-b-2 px-4 py-2.5 text-sm transition " +
              (on
                ? "border-brand-600 font-semibold text-brand-700"
                : "border-transparent text-stone-500 hover:text-stone-800")
            }
          >
            <span className="text-xs">{t.emoji}</span>
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
