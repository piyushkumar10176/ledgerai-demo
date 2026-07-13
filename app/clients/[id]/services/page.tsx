import { redirect, notFound } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getClient } from "@/lib/data";
import { getClientServices, SERVICES } from "@/lib/services";
import ServiceTabs from "@/components/ServiceTabs";
import ServicesPicker from "@/components/ServicesPicker";

export default async function ServicesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  const { id } = await params;
  const clientId = Number(id);
  const client = await getClient(session.firmId, clientId);
  if (!client) notFound();
  const services = await getClientServices(clientId);

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <h1 className="text-2xl font-bold tracking-tight">{client.name}</h1>
      <ServiceTabs clientId={clientId} active="services" services={services} />
      <div className="mt-6 max-w-3xl">
        <h2 className="font-semibold">Which services does this client use?</h2>
        <p className="text-sm text-stone-500">Only the selected services appear as tabs for this client. A client can use any combination.</p>
        <div className="mt-4">
          <ServicesPicker
            clientId={clientId}
            all={SERVICES.map((s) => ({ key: s.key, label: s.label, desc: s.desc, emoji: s.emoji, chip: s.chip }))}
            selected={services}
          />
        </div>
      </div>
    </main>
  );
}
