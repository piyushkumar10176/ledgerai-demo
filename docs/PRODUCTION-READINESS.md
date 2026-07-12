# LedgerAI UK — Production / Go-to-Market Readiness

**What this is:** everything between the current demo and a launchable, HMRC-recognised
product. Reality check up front: for a UK Making Tax Digital product handling financial
data and filing to HMRC, **~60–70% of the remaining work is regulatory, security, and
compliance — not features.** The demo proves the engine; this document is the rest.

---

## 0. The three existential risks (get these wrong = no business)
1. **Multi-tenant data leakage** — one firm seeing another firm's clients. Currently only a
   `firm_id` column with no enforcement. Must become defence-in-depth + adversarially tested.
2. **HMRC recognition timeline** — an external clock you cannot compress by coding faster.
   Must start Week 1, run as a separate workstream.
3. **Wrong tax figures reaching HMRC** — the deterministic engine must be versioned,
   reconciled to HMRC worked examples, and signed off by a qualified accountant.

---

## 1. Regulatory, legal & permissions (the long pole — start immediately)

| Item | What / why | Lead time | Cost |
|---|---|---|---|
| **Company incorporation** | Ltd company as the software vendor / data controller | days | ~£12–£100 |
| **ICO registration (data protection fee)** | Mandatory to process UK personal data. Legal requirement. | days | £40–£60/yr (up to £2,900 at scale) |
| **HMRC Developer Hub** | Register, create application, subscribe to MTD VAT + ITSA APIs (sandbox) | Week 1 | free |
| **HMRC production credentials + recognition** | Demo against MTD **minimum functionality standards**, get **listed on the software finder**. Separate for VAT and ITSA. | **weeks–months (critical path)** | free (time cost) |
| **Fraud prevention headers (`Gov-Client-*`)** | Mandatory on every HMRC call; validate against HMRC's Test Fraud Prevention Headers API | build early | free |
| **Agent Services Account (ASA)** | Your design-partner firms need one; you build the agent-authorisation journey against it | with pilots | free |
| **FCA — Open Banking (live bank feeds)** | Either register as an **agent of a regulated AISP** (TrueLayer/Yapily) or become an AISP (heavy). Needed only for live feeds; CSV avoids it for launch. | **weeks–months** | aggregator fees |
| **UK GDPR / DPA 2018 program** | Privacy policy, **DPIA** (needed — financial data at scale), **ROPA**, data-subject-rights process, 72h breach notification, **DPAs with every sub-processor** (Vercel/Turso/Anthropic/Twilio/etc.) | 4–8 wks | legal fees |
| **Customer contracts** | Terms of Service, customer **Data Processing Agreement** (you're a processor for firms), SLA | with legal | solicitor fees |
| **PECR compliance** | Consent/opt-out rules for SMS/email chasing & marketing | build in | — |
| **Trademark + domain** | "LedgerAI UK" trademark search + registration; secure domains | weeks | £170+ UK trademark |
| **Insurance** | Professional indemnity + cyber insurance | weeks | £1–5k/yr+ |
| **AML awareness** | The *firms* are AML-supervised; if you later add ID-verification/screening (PRD Phase 3), that's a provider integration | later | — |

> Note: HMRC recognition and FCA agent registration are the two things **no amount of
> engineering speed can accelerate**. Own them as workstreams from Day 1.

---

## 2. Security checks & hardening (the software)

### Tenant isolation (highest priority)
- Move to **PostgreSQL with Row-Level Security** policies keyed on `firm_id`, *plus* an
  app-layer query filter — two independent layers.
- Build an **adversarial cross-tenant test suite** ("authenticate as Firm A, try to read
  Firm B across every endpoint") and run it in **CI on every change**.

### Identity & access
- Replace the demo cookie with a real IdP (**Keycloak self-hosted**, or Auth0 / Entra
  External ID). Enforce **MFA**, password policy, account lockout, session expiry/rotation.
- **RBAC** for the PCM roles (Administrator, Partner, Manager, Accountant, Bookkeeper,
  Payroll Clerk, Read-Only). SSO for larger firms later.

### Data protection
- **Encryption at rest** (DB, object storage) and **in transit** (TLS 1.2+, HSTS).
- **Field-level encryption** for high-sensitivity PII (NINO, UTR, tokens).
- **HMRC OAuth tokens** stored encrypted, per-agent, with refresh handling.
- **Data residency** — decide UK vs EU and enforce it (current demo DB is EU-west; a
  regulated product may need UK South / UK region).

### Application security
- **CSRF protection** on all state-changing routes (the demo relies on `SameSite=Lax`
  cookies + JSON APIs — not sufficient for production).
- Input validation everywhere; output encoding (XSS); **SQL injection** already mitigated
  via parameterised queries (keep it that way); SSRF guards on any outbound fetch.
- **File-upload security**: malware scanning (DOC-02), MIME/type/size limits, store outside
  the web root, never execute.
- **Rate limiting** + brute-force protection on auth; **WAF + DDoS** (Cloudflare).
- **Secrets management** (Vault / cloud secret manager); rotation; zero secrets in git.
  (Today: `SESSION_SECRET` env + a demo password in code — must go.)

### Assurance & operations
- **Immutable audit log** (`AuditEvent`: actor, IP, timestamp, before/after) + log
  aggregation (Grafana Loki) + alerting/SIEM.
- **Dependency/supply-chain**: Dependabot/Snyk, `npm audit` in CI, SBOM, pinned versions.
- **SAST + DAST** in CI; **third-party penetration test** before launch (then annually);
  bug bounty later.
- **Backups + tested restores**, documented **DR** with RPO/RTO targets.
- **Vulnerability & patch management** cadence.
- **HMRC submission integrity**: idempotency keys, retries, payload hashing, immutable
  submission log (already modelled: `HmrcSubmission`).

---

## 3. Engineering: demo → production

| Area | Today (demo) | Production |
|---|---|---|
| Database | SQLite/Turso, `firm_id` only | Managed **Postgres** (UK region) + RLS + migrations + backups + read replicas |
| Auth | signed cookie + demo password | Keycloak/Auth0/Entra, MFA, RBAC, firm onboarding |
| OCR + AI | **mocked** | Real **PaddleOCR** service + **Claude** categorisation, confidence, RAG, learning loop, PII-safe prompting, cost controls |
| HMRC | **mocked receipt** | Real **HMRC Gateway** module: OAuth per agent, fraud headers, Obligations/Calculations APIs, sandbox Gov-Test-Scenario test pack, idempotency, retries |
| Documents | none | S3-compatible object storage, encrypted, **6-yr immutable retention**, malware-scan pipeline |
| Async work | inline | **Redis + worker queue** for OCR, submissions, chasing (background, retry-heavy) |
| Comms | none | **SMS/email provider** for magic links + automated chasing; inbound email receipt inbox |
| Billing | none | **Stripe** subscriptions + per-client metering |
| Observability | none | Sentry (errors), Prometheus/Grafana (metrics), tracing, uptime monitoring, on-call/alerting |
| Delivery | `vercel deploy` | CI/CD with full test gates, **staging environment**, **IaC (Terraform)**, blue-green/rollback |
| Testing | build + one self-test | Unit + integration + E2E + **load test** (deadline-week bulk submit) + the tenant-isolation suite + tax-engine reconciliation tests |
| Tax engine | 9-box VAT, basic | **Versioned, effective-dated** rules; ITSA quarterly payloads; reconciled to HMRC examples; accountant sign-off |
| Accessibility | none | WCAG 2.1 AA |

---

## 4. What to purchase / subscribe (approximate)

**One-off / setup**
- Company incorporation (~£12–£100), UK trademark (~£170+), domains (~£10–40/yr)
- Legal drafting: ToS + DPA + privacy policy + DPIA support (**solicitor — £2–8k**)
- Pre-launch penetration test (**£4–15k**)

**Recurring infrastructure (early production)**
- Hosting/compute (Hetzner/Azure UK/Vercel Pro): **£20–200+/mo** growing with load
- Managed Postgres + Redis + object storage: **£20–150+/mo**
- AI (Anthropic API): usage-based, **low at pilot volume**, scales with documents
- Email/SMS (Postmark/SES + Twilio): **usage-based** (SMS ~3–5p each)
- Auth (if Auth0/Entra instead of self-hosted Keycloak): **per-MAU**, can rise fast
- Open Banking aggregator (Phase 2 live feeds): **pay-as-you-go** production pricing
- Error/monitoring (Sentry, Grafana Cloud or self-host), WAF (Cloudflare paid): **£0–100+/mo**
- Security scanning (Snyk/Dependabot — free tiers exist), secrets manager
- Payments (Stripe): **per-transaction**, pass-through
- Insurance (PI + cyber): **£1–5k/yr+**
- ICO fee: **£40–60/yr**

**Free (don't pay for these)**
- HMRC APIs (VAT/ITSA), Companies House API, PostgreSQL/Redis/Keycloak/PaddleOCR (self-hosted)

**Later (enterprise trust)**
- **SOC 2 Type II** and/or **ISO 27001** audits: **£10–40k+** — do once real customers ask.

---

## 5. Prioritised concerns / risk register
1. **Tenant data leak** — existential. Postgres RLS + app filter + adversarial CI tests. *Do first.*
2. **HMRC recognition slips past the onboarding window** — start Week 1; scope strictly to
   minimum functionality standards; separate owner.
3. **Incorrect tax figures** — deterministic engine, reconciliation tests, accountant sign-off
   before first live submission.
4. **Data breach / GDPR** — encryption, least privilege, DPIA, breach process, pen test.
5. **Fraud-prevention-header non-compliance** — build into the HTTP client first; validate in sandbox.
6. **AI miscategorisation harming trust** — confidence gating + human approval (shape exists),
   cumulative self-correction, accountant sign-off.
7. **Deadline-week scale** — load-test bulk submission for 500-client firms.
8. **Vendor/free-tier changes** — keep providers swappable (already true for storage/AI interfaces).
9. **Small-team ops burden** — a self-hosted stack means you own patching/backups/security ops;
   budget real time each sprint, not just features.

---

## 6. Sequenced next steps

**Week 1 (external clocks — start in parallel with everything):**
- HMRC Developer Hub registration + sandbox app + VAT/ITSA API subscription
- Begin fraud-prevention-header collection & validation
- ICO registration; incorporate company; trademark + domains
- Recruit 2–3 design-partner firms; open Open Banking aggregator commercial conversation

**Foundation (Month 1–2):**
- Rebuild on **Postgres + RLS**; migrations; **adversarial tenant-isolation test suite in CI**
- Real **auth + MFA + RBAC**; secrets management; encryption at rest/in transit
- Immutable **audit log**; CI/CD + **staging** + **IaC**
- Harden the **deterministic tax engine** + reconciliation test pack

**Core product (Month 2–4):**
- Real **HMRC Gateway** end-to-end in **sandbox** (OAuth, fraud headers, obligations, calculations)
- Real **OCR + AI** pipeline (PaddleOCR + Claude, confidence, learning loop)
- **Object storage** + malware scan + 6-yr retention
- **Magic-link** collection + automated **chasing**; **billing** (Stripe)
- Build out **ITSA** quarterly updates (the PRD's actual market bet)

**Compliance & security (in parallel):**
- **DPIA**, DPAs, privacy policy, customer contracts
- **Penetration test** + security review
- **HMRC production approval + recognition demo** → listed

**Launch:**
- Recognition listing achieved → pilot firms live for a real quarterly filing cycle
- Monitoring/on-call in place; incident response runbook ready

---

*This is a regulated-fintech build. The engine is proven; the moat and the majority of the
remaining effort are compliance, security, and the HMRC/FCA external clocks. Plan the calendar
around those, not around feature velocity.*
