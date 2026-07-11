import { redirect } from "next/navigation";
import LoginForm from "@/components/LoginForm";
import { getSession } from "@/lib/auth";
import { ensureDemoData, DEMO_EMAIL, DEMO_PASSWORD } from "@/lib/seed";

export default async function LoginPage() {
  ensureDemoData(); // make sure the demo firm/user/client exist
  const session = await getSession();
  if (session) redirect("/dashboard");

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
      <h1 className="text-3xl font-bold tracking-tight">
        Ledger<span className="text-indigo-600">AI</span> UK
      </h1>
      <p className="mt-1 text-slate-500">Sign in to the demo practice.</p>

      <div className="mt-8 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <LoginForm demoEmail={DEMO_EMAIL} demoPassword={DEMO_PASSWORD} />
      </div>

      <p className="mt-4 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
        Demo credentials are pre-filled: <b>{DEMO_EMAIL}</b> / <b>{DEMO_PASSWORD}</b>
      </p>
    </main>
  );
}
