import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { reviewQueue } from "@/lib/transactions";
import { SELF_EMPLOYMENT_CATEGORIES, PROPERTY_CATEGORIES } from "@/lib/hmrc-categories";
import ReviewQueue from "@/components/ReviewQueue";

export default async function ReviewPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const items = await reviewQueue(session.firmId);

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <h1 className="text-2xl font-bold tracking-tight">Exception review queue</h1>
      <p className="text-sm text-stone-500">
        One keyboard-light queue across <b>all clients</b> — only low-confidence AI decisions surface.
        Review ~{items.length} exceptions, not every transaction.
      </p>
      <div className="mt-6">
        <ReviewQueue
          items={items}
          seCategories={SELF_EMPLOYMENT_CATEGORIES.map((c) => ({ code: c.code, label: c.label, direction: c.direction }))}
          propertyCategories={PROPERTY_CATEGORIES.map((c) => ({ code: c.code, label: c.label, direction: c.direction }))}
        />
      </div>
    </main>
  );
}
