# LedgerAI UK — PRD v2 Alignment Audit

**Status legend:** ✅ built (demo) · 🟡 partial / mocked · ❌ pending · ⛔ external-blocked (needs HMRC/FCA/company) · ➕ beyond PRD scope

**Headline:** the *direction* is 100% aligned (MTD-Income-Tax-first, "dashboard is the product", AI-does-books/humans-review). Of the **§7 MVP scope**, roughly **~70% is present in demo form**; the remaining depth is real HMRC filing, real AI, automated chasing, year-end pack, and production auth/security. We have also built **beyond** the MVP (Invoicing, VAT-as-a-service).

---

## §5 Product principles
| # | Principle | Status | Notes |
|---|---|---|---|
| 1 | Zero client behaviour change (magic links) | 🟡 | link generate + no-login upload page built; **SMS/email delivery mocked** |
| 2 | AI does the books; humans review exceptions | ✅ | confidence gating → review queue → human approves before HMRC; AIDecision logged |
| 3 | Digital links by construction (no retyping) | ✅ | every figure deterministically derived from records |
| 4 | The dashboard is the product | ✅ | practice dashboard + obligations control tower |
| 5 | Coexist, don't replace | 🟡 | year-end pack export (the hand-off artifact) ❌ |

## §6 Core workflow — the six stages & ★ switching triggers
| Stage | Item | Status |
|---|---|---|
| **Onboard** | Firm client-list CSV import (IRIS/TaxCalc formats) | ❌ |
| | ★ Mandation checker (ITSA-status API) | 🟡 built as **mock** ITSA status |
| | Agent-authorisation tracker | 🟡 status field only; real ASA journey ❌ |
| **Collect** | ★ Magic-link data requests | 🟡 mechanism ✅; SMS/email delivery ❌ |
| | ★ Automated chasing (escalating reminders) | ❌ (only a mock "Chase" button) |
| | Receipt inbox (email-forward per client) | ❌ |
| **Process** | AI categorise → HMRC category enums + confidence | 🟡 ✅ shape, **AI mocked** |
| | £90k consolidated-vs-full mode | ✅ |
| | Duplicate detection | ❌ |
| | Receipt OCR (supplier/date/amount/VAT) | 🟡 **mocked** |
| | Learned supplier→category memory | ❌ |
| **Review** | ★ One cross-client exception queue, bulk-accept, AI explain inline | ✅ (multi-select + bulk accept/reject/recategorise; "explain" via Copilot) |
| **File** | Cumulative quarterly update per income source | ✅ |
| | Diff vs previous quarter | ❌ |
| | Validation pre-submission | 🟡 basic |
| | ★ Bulk submit across clients | ✅ (mock submit) |
| | Tax estimate (Individual Calculations API) | 🟡 **mocked** figure |
| | Year-end pack export (PDF/CSV) | ❌ |
| **Monitor** | ★ Obligations control tower (Obligations API), RAG, countdown, one-click chase | ✅ (from **our data**, not HMRC's Obligations API) |

**MVP acceptance test (150 clients, clear 12 red, bulk-file 142, export):** ~80% demonstrable — dashboard RAG ✅, chase 🟡 (mock), exception queue ✅, bulk-file ✅ (mock), **export ❌**.

## §7 MVP scope — definitive checklist
| Requirement | Status | Gap to 100% |
|---|---|---|
| Auth (Auth0 / Azure B2C, MFA) | 🟡 | demo cookie; no MFA/real IdP/RBAC |
| Firm + roles (partner/staff) | 🟡 | firm ✅, role field; no RBAC enforcement |
| Slim client records | ✅ | (NINO/UTR/VRN/mandation/wave/agent-auth; **DOB** missing) — **editable** ✅ |
| Mandation checker | 🟡 | real HMRC ITSA-status call |
| Agent-auth flow | 🟡 | real ASA authorisation journey |
| Income sources (SE + UK property) | ✅ | |
| Transactions ledger | ✅ | (single-entry per §8 Layer 1; full add/edit/delete/select) |
| CSV/OFX bank import | 🟡 | CSV ✅, **OFX** ❌ |
| Receipt upload + OCR | 🟡 | real OCR (PaddleOCR) + file storage |
| AI categorisation + review queue | 🟡 | real Claude + cross-client queue ✅ |
| Quarterly update generate/validate/submit (cumulative) | 🟡 | real HMRC submit; diff vs last |
| Obligations dashboard | ✅ | wire to real Obligations API |
| Tax estimates | 🟡 | real Individual Calculations API |
| Automated chasing | ❌ | ChaseSchedule + delivery |
| Magic links | ✅ | delivery (SMS/email) |
| Year-end pack export | ❌ | |
| Audit log | 🟡 | AIDecision only; full AuditLog ❌ |
| HMRC receipts | 🟡 | mock receipts stored; real ones ❌ |
| Encryption at rest / UK data residency | ❌ | on Turso **EU**; no field encryption |

**Score:** ✅ 8 · 🟡 8 · ❌ 3 (of ~19).

## §8 Data model
- **Layer 0** (client setup): ✅ NINO/UTR/mandation/wave/agent-auth/income-sources/Business ID/accounting method. ❌ **DOB**.
- **Layer 1** (digital records): ✅ date/amount/category/confidence/provenance/status.
- **Layer 2** (quarterly cumulative, consolidated vs ~15 SA103 categories, £90k): ✅.
- **Layer 3** (year-end): correctly absent (Phase 3).
- **Entities:** ✅ Firm, User, Client, IncomeSource, Transaction, QuarterlyUpdate, SubmissionReceipt (as HMRC receipt), MagicLink, AIDecision. 🟡 Role (field). ❌ **CategoryRule** (learning loop), **ChaseSchedule**, full **AuditLog**, **TaxEstimate** (persisted), **Obligation** (from HMRC), **Receipt/Document** with real file storage. ➕ invoices, client_services, hmrc_connections.

## §9 HMRC integration
| Item | Status |
|---|---|
| OAuth 2.0 token endpoint | ✅ live (client_credentials returns tokens) |
| Hello World application API | ✅ **live 200** from prod |
| Fraud-prevention headers (Gov-Client-*) | 🟡 subset wired; full validated set ❌ |
| Auth-code flow (agent connect) | 🟡 wired; **not completed** (needs redirect-URI + your Connect + test-user OAuth) |
| Business Details / ITSA Status / Obligations / SE-Business / Property-Business / Calculations APIs | ❌ (clients wired for VAT obligations; ITSA endpoints not called) |
| Agent Services Account journey | ❌ |
| Sandbox test users / Gov-Test-Scenario pack | 🟡 one test user (Fay Ingham) wired; full pack ❌ |
| Recognition workstream (listed on software finder) | ⛔ external clock |

## §10 AI design
- ✅ Confidence policy (≥ threshold auto, below → queue), **guardrail: AI never submits, human approves**, every AI decision logged.
- 🟡 The categoriser is a **deterministic keyword mock** — not Claude.
- ❌ Embeddings supplier-matching, **RAG over history**, **learning loop** (corrections → CategoryRule), anomaly detection, tax-correctness sign-off process.

## §12 Technology & security
| Item | PRD | Built |
|---|---|---|
| Frontend | Next.js/React/TS/Tailwind | ✅ |
| Backend | .NET 9 / EF Core | ➕ **Next.js full-stack** (demo divergence) |
| Data | PostgreSQL + Redis | 🟡 **Turso (libSQL)**; no Redis |
| Storage | Azure Blob (UK) | ❌ no document storage (receipts mocked) |
| Auth | Auth0/B2C, JWT, MFA | 🟡 demo cookie |
| AI | Claude + embeddings + RAG | 🟡 mock |
| UK residency, encryption, IP allowlist, SOC2 logging | required | ❌ (EU host, none of these) |

## ➕ Beyond / divergent from the PRD (flag for the team)
- **Invoicing** — a full module we built; **not in PRD v2 at all**.
- **VAT as a live service** — PRD puts VAT at **Phase 2**; built now.
- **Payroll** — kept a **placeholder** ✅ (PRD: don't build — correct).
- **Self Assessment tab** — ours is a quarterly-progress view; PRD's SA is the **year-end final declaration (Phase 3)**.

---

## Backlog to reach 100% PRD alignment

### A. Pure software — we can build now (closes most of the MVP gap)
1. **Automated chasing** — `ChaseSchedule` entity + escalating reminders + magic-link send (★).
2. **Year-end pack export** — per-client PDF/CSV of categorised totals + flagged items + receipt links (★).
3. **Diff vs previous quarter** on the File screen.
4. **Real AI** (Claude) categorisation + **learning loop** (`CategoryRule`) + **duplicate detection** behind the current mock.
5. **Real OCR** (PaddleOCR/hosted) + **document storage** (S3/R2) for receipts (§8 Receipt entity).
6. **Firm client-list CSV import** (IRIS/TaxCalc formats); add **DOB**; **OFX** import.
7. **Full audit log** (`AuditEvent`: actor/IP/before-after) + export.

### B. Needs your HMRC Developer Hub actions (then we wire it)
8. Complete the **agent OAuth connect** → real **Obligations**, **Calculations** (tax estimate), **SE/Property-Business submit**, **ITSA Status** (mandation), real **fraud-header** validation.

### C. Production / regulated — bigger workstreams
9. **Real auth** (Keycloak/Auth0) + **MFA** + **RBAC**; **tenant isolation** (Postgres RLS) + adversarial tests.
10. **Encryption at rest** + **UK data residency** (move host/region) + IP allowlisting + SOC2-ready logging.
11. **HMRC recognition** (⛔ external clock) — the gate to real filing.
12. **FCA** Open Banking agent registration for live bank feeds (Phase 2).

*Deliberately NOT building (per PRD): payroll engine, accounts production/iXBRL, CT600, VAT-registered-trading-company focus, B2C.*
