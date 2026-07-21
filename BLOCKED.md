# What I could not complete — and exactly why

Everything buildable in software is built and deployed. This is the honest list of what
is **not** done, grouped by the reason it's blocked. Nothing here is a coding problem.

---

## A. Blocked by external permission / approval (someone else must say yes)

| # | Item | Why blocked | What unblocks it |
|---|---|---|---|
| A1 | **HMRC production credentials** | We run on the Developer **Sandbox**. Production access requires HMRC software recognition: a completed application, demo to HMRC, fraud-prevention-header validation pass, and terms sign-off. This is a review process with a queue, not a setting. | Apply on HMRC Developer Hub, pass the `/test/fraud-prevention-headers/validate` check, book the recognition demo. Typically weeks. |
| A2 | **Agent Services Account (ASA) + real client authorisations** | Filing for real clients needs a real ASA and each client to authorise you as agent through HMRC's own journey. Cannot be simulated. | Firm registers for an ASA; each client completes the digital handshake. |
| A3 | **Open Banking / live bank feeds** (TrueLayer, Plaid) | Requires an FCA-regulated AISP permission or an agency agreement riding on a provider's licence, plus a commercial contract and security review. | Contract with TrueLayer/Plaid under their AISP; or register as an FCA AISP directly. Until then: CSV import, which is fully built. |
| A4 | **Xero / QuickBooks integration** | Needs approved developer apps and OAuth credentials from each vendor, plus app-store review to go public. | Register partner apps with Xero and Intuit. |
| A5 | **Companies House / HMRC agent bulk APIs** | Gated behind separate credentials and use-case approval. | Apply per-API. |
| A6 | **Design-partner firms** | You asked for real accountancy firms to validate the workflow. I can't recruit humans. | Your outreach — the app is demo-ready for exactly this. |

## B. Blocked by account / infrastructure limitation

| # | Item | Why blocked | What unblocks it |
|---|---|---|---|
| B1 | **UK data residency** | Turso and Vercel are currently on default regions. UK/EU residency is a paid-plan region setting plus a data migration. | Turso: create a UK-region DB and restore from `backup.sh` dump. Vercel: Pro plan + region pinning. |
| B2 | **Multi-seat access for collaborators** | Vercel Hobby is single-seat. `shubham@cloudsheer.com` cannot get a Vercel seat on this plan. | Either upgrade to Vercel Pro, or (free, recommended) add them to the GitHub repo and connect GitHub→Vercel so pushes auto-deploy. |
| B3 | **Real MFA / SSO** | Session auth is implemented; TOTP or an IdP (Auth0/Entra/WorkOS) requires an account, a paid tier at scale, and a domain. Your original brief also explicitly said *no Keycloak*. | Choose an IdP, then it's a day of wiring. |
| B4 | **Scheduled jobs** (auto-chase, deadline alerts) | Vercel Cron is limited on Hobby (daily, limited jobs). Chase schedules are modelled and stored; the trigger is manual. | Vercel Pro cron, or an external scheduler hitting the existing endpoints. |
| B5 | **Real OCR** | Receipt OCR uses a deterministic mock. A production-grade extractor (Textract / Google Document AI / Mindee) needs a paid key. | Add a key; the interface is already isolated behind one function. |
| B6 | **Live AI categorisation in prod** | `lib/ai.ts` calls Claude for real, but `ANTHROPIC_API_KEY` is not set on Vercel, so production silently falls back to the deterministic categoriser. **This is a one-variable fix.** | `vercel env add ANTHROPIC_API_KEY production` then redeploy. |

## C. Blocked by regulatory / compliance restriction

| # | Item | Why blocked |
|---|---|---|
| C1 | **SOC 2 / ISO 27001** | An audit performed by an accredited third party over an observation window (3–12 months). Not a software artefact. |
| C2 | **AML / KYC client verification** | Regulated identity checks require a licensed provider contract. |
| C3 | **PI insurance, ICO registration, engagement letters** | Business/legal steps for the firm, not the product. |
| C4 | **Giving tax advice** | The app deliberately never advises. It computes deterministically and shows its ruleset version. Correct by design, not a gap. |

## D. Blocked by test-environment feasibility

| # | Item | Detail |
|---|---|---|
| D1 | **ITSA quarterly submission end-to-end** | The HMRC sandbox test user (MTD IT ID `XTIT00002270770`) has **no MTD-IT business provisioned**, so `itsaBusinessList()` returns `MATCHING_RESOURCE_NOT_FOUND`. I verified this is not a code bug: OAuth scope is correct and confirmed, and the identical client code files VAT successfully. Fix is to create a test user *with* a self-employment business in the HMRC test-user API. |
| D2 | **Re-filing the same VAT period** | Period `18A1` is genuinely filed (form bundle `917057102418`, charge ref `uPn10cDR8utzq9Ew`). HMRC returns `DUPLICATE_SUBMISSION` on retry — correct behaviour. The UI now detects this and shows "Already filed to HMRC" instead of an error. |
| D3 | **Payroll / RTI** | Out of PRD scope for Phase 1–3; the service tab exists as a placeholder so the per-client service model is complete. |

---

## The single highest-value unblock

**B6** — set `ANTHROPIC_API_KEY` in Vercel. One command, and live AI categorisation
switches on across the whole product. Everything else needs a third party.
