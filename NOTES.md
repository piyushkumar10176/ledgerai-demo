# LedgerAI UK — Demo Prototype · NOTES

**Status:** in progress · **Started:** 2026-07-11
**What this is:** a SIMPLE demo that proves the core LedgerAI UK flow end-to-end. Not production.

---

## The flow this demo proves
1. Firm user logs in (simple session auth).
2. Add a client (manual entry).
3. Correct double-entry ledger + chart of accounts.
4. Import a bank statement via CSV → see transactions.
5. Upload a receipt → OCR + AI categorisation → confidence score → below threshold goes to a review queue.
6. Generate a VAT return (9-box) with a **deterministic in-code calculation** → "Submit to HMRC" (mocked) → fake receipt.

---

## Stack actually used (demo simplifications vs the FRD plan)

| Layer | FRD plan | This demo | Why |
|---|---|---|---|
| App | .NET API + separate Next.js | **Single Next.js app** (TS + React + Tailwind), API via route handlers | One runnable thing; Node already installed; no .NET setup |
| Database | PostgreSQL | **SQLite** (`data/ledgerai.db`) via `better-sqlite3` | Zero setup, already installed; ledger correctness doesn't need Postgres |
| OCR + AI | PaddleOCR + OpenRouter | **Mocked** (stubbed extraction + deterministic confidence) | No API keys; threshold/review logic is fully real |
| HMRC submit | Real MTD OAuth + fraud headers | **Mocked** (fake receipt) | Per demo brief |
| Auth | Keycloak | **Simple session cookie + hashed password** | Per demo brief |
| Multi-tenancy | Full isolation + RLS | **`firm_id` on every row** (no hardening) | Not painful to harden later |

## What is REAL vs MOCKED (read this before demoing)
- **REAL:** double-entry ledger (debits = credits enforced), chart of accounts, CSV import, VAT 9-box math (deterministic code), review-queue threshold gating, audit of AI decisions.
- **MOCKED:** OCR text extraction + AI categorisation (returns sample fields + a computed confidence), HMRC submission (returns a fake receipt). Both are flagged in the UI and are the obvious next real steps.

## Deliberately NOT built (out of demo scope)
Open Banking / live bank feeds, real HMRC OAuth + fraud-prevention headers, Companies House lookup (manual client entry instead), Keycloak, full tenant-isolation hardening, payroll, corporation tax, MTD Income Tax quarterly updates, client portal.

> Note: the FRD (VAT-first) and PRD v2 (Income-Tax-first) disagree on direction. This demo follows the brief = **VAT 9-box**.

---

## Folder structure (planned)
```
ledgerai-demo/
  NOTES.md                  ← this file
  package.json
  app/
    layout.tsx, page.tsx    ← landing
    login/                  ← login screen
    dashboard/              ← after login
    clients/                ← client list + add + detail
    api/                    ← route handlers (auth, clients, ledger, import, receipts, vat)
  lib/
    db.ts                   ← SQLite connection + schema
    ledger.ts               ← double-entry posting (debits==credits)
    vat.ts                  ← DETERMINISTIC 9-box calculation
    ocr-mock.ts             ← mock OCR + AI categorisation
    auth.ts                 ← session cookie + password hashing
  data/
    ledgerai.db             ← SQLite file (gitignored)
    sample-bank.csv         ← sample statement for the demo
```

## Build order (pausing after each)
1. ✅ Scaffold + run (hello world in browser) — Next.js 16 + React 19 + Tailwind 3, SQLite driver installed & compiled
2. ✅ Data model + double-entry ledger + chart of accounts — pennies-only money, debits==credits enforced, append-only + reversals, deterministic VAT engine. Self-test: `GET /api/dev/ledger-selftest` (all pass).
3. ✅ Client management + login — session cookie + scrypt password; dashboard; add/list/view clients (auto-seeded COA); firm-scoped everywhere.
4. ✅ CSV bank import — load sample or upload CSV; categorise each line into a balanced posting with VAT split.
5. ✅ Receipt upload + mock OCR/AI + review queue — confidence gating (≥80% auto-post, else review); confirm/override/reject; every AI decision logged.
6. ✅ Deterministic VAT 9-box screen + mocked HMRC submit — figures from the ledger in code; fake HMRC receipt; submission history.

**All 6 steps complete. Full flow verified end-to-end.**

---

## How to run
```
cd ~/ledgerai-demo
npm install      # first time only
npm run dev      # then open http://localhost:3000
```
Verified working: Next.js 16.2.10 dev server, page renders at http://localhost:3000.

## Demo walkthrough (the flow to click through)
1. Open http://localhost:3000 → login is pre-filled (`demo@ledgerai.test` / `demo1234`) → **Sign in**.
2. **Clients** → open **Bright Bakery Ltd** (pre-seeded with a chart of accounts).
3. **Bank import** tab → **Load sample statement** (10 rows). For each line pick a
   category + VAT treatment → **Post**. Income (Sumup) → Sales / VAT 20%. Expenses:
   Flour Power → Cost of Goods Sold, Shell → Motor & Travel, Office World → Office
   Supplies, City Lettings → Rent / **No VAT**, British Gas → Utilities.
4. **Receipts & review** tab → click **Fuel receipt** (95% → auto-posts) and
   **Ambiguous café receipt** (61% → drops into the **review queue**). In the queue,
   optionally change the category, then **Confirm & post** (or Reject).
5. **VAT return** tab → the 9 boxes compute from the ledger (period Apr–Jun 2026).
   Review, then **Submit to HMRC (mock)** → a fake receipt (form bundle number) appears
   and the submission is saved to history.
6. **Reset demo data** (top-right on the dashboard) clears transactions to start over.

**Reconciled figures** if you categorise the full sample as above + both receipts:
Box 1 £1,300.00 · Box 4 £218.00 · **Box 5 (net VAT payable) £1,082.00** · Box 6 £6,500.00 · Box 7 £2,290.00. (Verified against the deterministic engine.)

## Hosting: Vercel + Turso
**Live link:** https://ledger-uk.vercel.app · login `demo@ledgerai.test` / `demo1234`

The app is deployed on Vercel with a Turso (libSQL) database.
- Vercel project: `ledger-uk` · Turso DB: `ledgerai` (aws-eu-west-1).
- Redeploy after code changes: `vercel deploy --prod --yes` (or connect the GitHub
  repo in the Vercel dashboard for auto-deploy on push to `main`).

- **Data layer:** `@libsql/client` (async). Local dev uses a file DB
  (`data/ledgerai.db`); production reads `TURSO_DATABASE_URL` + `TURSO_AUTH_TOKEN`.
  Same code path both places. See `lib/db.ts` and `.env.example`.
- **Reviewer login:** `demo@ledgerai.test` / `demo1234`.
- **Self-seed:** on first request the app seeds the demo firm/user + 3 sample clients
  (idempotent), so a brand-new Turso DB is populated automatically.
- **Deploy flow:** push to GitHub `main` → Vercel auto-builds & deploys.
  Env vars (`TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, `SESSION_SECRET`) set in the
  Vercel project settings.

Data persists in Turso (unlike an ephemeral host), so reviewer-added data sticks.
Dashboard has "Load sample data" and "Reset demo data" buttons.

> `share.sh` (Cloudflare tunnel) is left in the repo as a local-only fallback; not used for the hosted link.

## Correctness self-test
`GET /api/dev/ledger-selftest` posts a balanced sale + purchase, proves an unbalanced
entry is rejected, checks the trial balance, and asserts the VAT boxes — all in code.

## Key implementation decisions
- **Money is integer pennies everywhere.** No floats touch a monetary value.
- **Double-entry is enforced at post time** (`lib/ledger.ts`): debits must equal
  credits or the post is rejected. Journal is append-only; corrections = reversal.
- **VAT is deterministic** (`lib/vat.ts`): boxes derived by SQL from ledger movements
  (output-VAT credits, input-VAT debits, income/expense nets). No AI, ever.
- **Bank lines credit/debit Bank**; **receipts credit Accounts Payable (2100)** so a
  captured supplier invoice doesn't collide with a bank-statement line.
- **Confidence threshold = 80%** (`lib/ocr-mock.ts`, `CONFIDENCE_THRESHOLD`) — firm-
  configurable in the real product; fixed here.
- **Mock OCR/AI is deterministic** (hash of filename / explicit scenario) so demos repeat.
- Reset deletes referencing rows before referenced ones (FK-safe).

## Next real steps (what the mocks stand in for)
- Real OCR (PaddleOCR) + LLM categorisation behind the same `lib/ocr-mock.ts` interface.
- Real HMRC MTD VAT submission: OAuth 2.0, fraud-prevention headers, idempotency,
  retries — the FRD's "HMRC Gateway" module. Currently `lib/vat-submit.ts` returns a fake receipt.
- Companies House lookup on add-client (currently manual entry).
- Real identity (Keycloak) instead of the demo session cookie.

## Decisions log
- 2026-07-11: Single Next.js app + SQLite chosen over .NET + Postgres for demo speed (user approved).
- 2026-07-11: OCR/AI mocked, no API keys (user chose "Mock it").
- 2026-07-11: Bumped Next 15.5.4 → 16.2.10 to clear a critical CVE; aligned React to 19.2.
- 2026-07-11: Receipts post to Accounts Payable (not Bank) to avoid double-counting.
