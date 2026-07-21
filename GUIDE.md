# LedgerAI UK — Operating Guide

Live: https://ledger-uk.vercel.app · Login: `demo@ledgerai.uk` / `demo1234`

---

## 1. What this is

An MTD-Income-Tax-first practice platform for UK accounting firms. One accountant runs
many clients: onboard → collect records → AI-categorise → review exceptions → file
quarterly updates to HMRC → year-end final declaration. VAT is supported alongside
(Phase 2 in the PRD, built here because the HMRC VAT sandbox is the only one that
actually accepts live submissions).

**Non-negotiable design rule:** AI never produces a tax number. AI only *suggests a
category* for a transaction. Every figure is computed deterministically in code
(`lib/tax.ts`, rules version `2026-27.v1`) or returned by HMRC.

---

## 2. Day-one setup for a new firm

1. **Sign in** → `/login`.
2. **Connect HMRC** → `/hmrc` → "Connect agent account". This runs the real OAuth
   authorisation-code flow against HMRC's Developer Sandbox and stores the agent token.
   Scope granted: `read:vat write:vat read:self-assessment write:self-assessment`.
3. **Load your clients** → `/clients` → **⬆ Import list**. Upload your IRIS / TaxCalc /
   Excel client-list export (recognises Name, NINO, UTR, Phone columns), or **Try sample**
   to see it work. Duplicates by name are skipped, not double-created.
4. **Pick services per client** → client → **⚙️ Manage services** → tick Bookkeeping /
   VAT / MTD IT / Payroll. **Only ticked services appear as tabs** for that client.
5. **Check mandation** → `/mandation` shows who is mandated for MTD IT and in which wave,
   based on qualifying income.

---

## 3. The weekly loop

### Collect
- **Magic link** (client overview → *Generate link*). The client taps it, uploads a bank
  CSV or a receipt photo, and **signs off the quarter** — no login, no app, no password.
- **Direct import** — client → Bookkeeping → *Import CSV* / *Upload receipt*.

### Categorise
Precedence, highest first:
1. **Learned rule** — if you've ever overridden this supplier before, that wins
   (confidence 1.0, status `auto`, model `learned-rule/v1`).
2. **Claude** — real API call to `claude-haiku-4-5`, constrained to the valid HMRC
   category enum. Active when `ANTHROPIC_API_KEY` is set.
3. **Deterministic fallback** — keyword matcher, so the pipeline never breaks if the API
   is down or unkeyed.

### Review
`/review` is the cross-client exception queue — only what the AI wasn't confident about.
Confirm, or override. **An override writes a rule**, so the same supplier is silent next
time. That's the learning loop and it's the whole efficiency story.

### File
- **MTD IT quarterly** — client → MTD tab. Figures are cumulative for the tax year (that's
  how HMRC's quarterly updates work — each submission restates the year to date, it does
  not add a delta). Requires client approval before the submit button unlocks.
- **VAT** — client → VAT tab. Pulls live obligations from HMRC, then submits the 9-box
  return. Pennies are converted at the boundary: 5 VAT boxes to 2dp, 4 value boxes to
  whole pounds, `finalised: true`.

### Year end
Client → **📅 Year end**. Layer 3 data (other income, dividends, interest, pensions,
gift aid, student loan plan) that the books don't know about. Save → the projected tax
bill recomputes live: income tax, dividend tax, Class 4 NIC, student loan, HICBC.
**⬇ Working papers** exports the CSV pack.

---

## 4. Money, correctness, and why you can trust the numbers

- **Every amount is an integer of pennies.** No floats anywhere in storage or arithmetic.
  Conversion to pounds happens only at the display and HMRC-API boundary.
- **`lib/tax.ts` is pure and versioned.** Personal allowance £12,570 with the £100k taper,
  basic band £37,700, higher limit £125,140, dividend allowance £500 at 8.75/33.75/39.35%,
  Class 4 NIC 6%/2%, student loan plans 1/2/4/5/PG, HICBC. Change a rate, bump
  `TAX_RULES_VERSION`, and every projection is traceable to the ruleset that produced it.
- **HMRC's Calculations API is authoritative** for the real filing. Our projection is the
  in-year estimate you show the client so there are no January surprises.
- **Audit trail** — `/audit` logs every categorisation, override, approval and submission
  with actor and timestamp.

---

## 5. Security posture (what's actually implemented)

| Control | Status |
|---|---|
| CSP, HSTS (2y, preload), X-Frame-Options DENY, nosniff, Referrer-Policy, Permissions-Policy | ✅ in `next.config.mjs` |
| Every app route behind a session guard (unauthenticated → 307 to `/login`) | ✅ |
| Firm-scoped queries — every read/write filters on `firm_id` | ✅ |
| Magic links are single-purpose, token-authorised, and scoped to one client | ✅ |
| HMRC secrets in Vercel env vars, never in the repo | ✅ |
| DB backups (`backup.sh`) gitignored — dumps contain HMRC tokens | ✅ |
| Fraud-prevention headers (`Gov-Client-*`) on every HMRC call | ✅ |

See `BLOCKED.md` §Security for what is *not* implemented and why.

---

## 6. Running it locally

```bash
npm install
npm run dev            # http://localhost:3000
npm run build          # production build
npx tsc --noEmit       # typecheck
./backup.sh            # dump Turso → backups/ (gitignored)
```

Environment variables (set in Vercel for prod, `.env.local` for dev):

```
TURSO_DATABASE_URL=       # omit locally to use file:./data/ledgerai.db
TURSO_AUTH_TOKEN=
HMRC_CLIENT_ID=
HMRC_CLIENT_SECRET=
HMRC_BASE_URL=https://test-api.service.hmrc.gov.uk
ANTHROPIC_API_KEY=        # optional — unset falls back to the deterministic categoriser
```

## 7. Adding a collaborator

Vercel Hobby is single-seat, so the clean path is: add them to the **GitHub** repo (write),
then connect the GitHub repo to the Vercel project. Their pushes then auto-deploy without
needing a Vercel seat.
