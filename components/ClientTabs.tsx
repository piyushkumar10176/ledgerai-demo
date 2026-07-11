import Link from "next/link";

const TABS = [
  { key: "overview", label: "Overview", href: "" },
  { key: "import", label: "Bank import", href: "/import" },
  { key: "receipts", label: "Receipts & review", href: "/receipts" },
  { key: "vat", label: "VAT return", href: "/vat" },
];

export default function ClientTabs({
  clientId,
  active,
}: {
  clientId: number;
  active: string;
}) {
  return (
    <nav className="mt-4 flex gap-1 border-b border-slate-200">
      {TABS.map((t) => {
        const on = t.key === active;
        return (
          <Link
            key={t.key}
            href={`/clients/${clientId}${t.href}`}
            className={
              "border-b-2 px-4 py-2 text-sm " +
              (on
                ? "border-indigo-600 font-medium text-indigo-700"
                : "border-transparent text-slate-500 hover:text-slate-800")
            }
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
