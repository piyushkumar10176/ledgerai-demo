import { resolveMagicLink } from "@/lib/magiclink";
import MagicUpload from "@/components/MagicUpload";

// PUBLIC page — no login. The token is the authorisation.
export default async function MagicLinkPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const target = await resolveMagicLink(token);

  if (!target)
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 text-center">
        <h1 className="text-xl font-semibold">Link not found</h1>
        <p className="mt-2 text-stone-500">This upload link is invalid or has expired. Ask your accountant for a new one.</p>
      </main>
    );

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
      <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
        <div className="text-xs font-medium uppercase tracking-wide text-brand-600">Secure upload</div>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">Hi {target.clientName.split(" ")[0]} 👋</h1>
        <p className="mt-2 text-sm text-stone-600">
          Your accountant needs your latest records for your quarterly tax update.
          Upload below — <b>no login, no app, no password</b>. Takes 20 seconds.
        </p>
        <div className="mt-5"><MagicUpload token={token} /></div>
        <p className="mt-4 text-center text-[11px] text-stone-400">
          Demo magic link · uploads are categorised automatically by your accountant&apos;s AI.
        </p>
      </div>
    </main>
  );
}
