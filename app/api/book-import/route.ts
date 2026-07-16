import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { importClientBook } from "@/lib/book-import";
import { runMandationCheck } from "@/lib/mandation";

// TRI-01 + TRI-12: import the firm's client book (two CSVs) and immediately
// run the real mandation engine across it — upload a book, get the report.
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const form = await req.formData();
  const clientsFile = form.get("clients");
  if (!(clientsFile instanceof File))
    return NextResponse.json({ error: "Attach a 'clients' CSV file (and optionally 'income')." }, { status: 400 });
  if (clientsFile.size > 2_000_000)
    return NextResponse.json({ error: "clients.csv is too large (2 MB max)." }, { status: 400 });

  const incomeFile = form.get("income");
  if (incomeFile instanceof File && incomeFile.size > 2_000_000)
    // Error loudly (audit fix): silently dropping the income file would produce
    // a plausible-looking but wrong mandation report.
    return NextResponse.json({ error: "income.csv is too large (2 MB max)." }, { status: 400 });
  const incomeCsv = incomeFile instanceof File ? await incomeFile.text() : null;

  const result = await importClientBook(session.firmId, await clientsFile.text(), incomeCsv);
  await runMandationCheck(session.firmId);

  return NextResponse.redirect(new URL("/mandation?imported=1", req.url), 303);
}
