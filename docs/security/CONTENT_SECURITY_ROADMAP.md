# FilmSet — Content Security Roadmap

**Audit deliverable 6 of 11.** Covers Parts 24 and 25 of the audit mandate. Maps FilmSet's future requirements against MPA/TPN content-security expectations, NIST Zero Trust, OWASP application security, SOC 2, and ISO/IEC 27001 — and separately, privacy-aware handling of the session/security data this audit proposes collecting (Part 24).

**FilmSet is not certified or assessed against any of the frameworks below, and this document does not claim otherwise.** It identifies what would need to be true — technically and organizationally — to pursue certification or a studio content-security assessment later. Nothing here is a compliance claim.

---

## 1. MPA / TPN Content Security Readiness

The Motion Picture Association's content security best practices (and the Trusted Partner Network assessment built on them) are the standard a studio will actually ask about before trusting FilmSet with unreleased content. Mapped against what exists today:

| MPA/TPN expectation area | Current state | Gap |
|---|---|---|
| Access control / least privilege | Flat, role-based, membership-only (`AUTHORIZATION_GAP_ANALYSIS.md`) | No least-privilege enforcement — see `THREAT_MODEL.md` #2, #5, #10 |
| Content classification & handling | None (`AUTHORIZATION_GAP_ANALYSIS.md` §6) | Full gap — Part 9's classification scheme is the direct answer, not yet built |
| Watermarking / forensic marking of sensitive content (e.g. scripts) | None | Not designed in this audit — flagged for a dedicated spec once script classification (Part 9) ships; likely P10+ |
| Physical/logical security of infrastructure | Inherited from Supabase + Vercel's own SOC 2 status (not independently verified in this audit) | Verify and document Supabase's and Vercel's current compliance attestations as part of any future assessment prep — this is due diligence on vendors, not FilmSet's own build |
| Security awareness / personnel security | Organizational, not technical | Out of this audit's scope — a program requirement, not a code requirement |
| Incident response plan | Does not exist | Needs to be written once the Security Center (P3) gives the team something to actually respond *with* (session revocation, audit search) — a paper IR plan with no tooling behind it is not meaningful |
| Vulnerability management / patching | Ad hoc (dependency updates as needed) | Formalize a recurring dependency-audit cadence once CI exists (P0/P1 — there is currently no CI at all, `CURRENT_ARCHITECTURE_MAP.md` §1) |

**Sequencing implication**: most TPN-relevant gaps are downstream of the same P1–P3 work (permission engine, departments, Security Center/audit) already prioritized for other reasons in `IMPLEMENTATION_ROADMAP.md` — pursuing TPN readiness doesn't add a separate track, it's mostly a byproduct of doing P1–P3 well.

## 2. NIST Zero Trust (SP 800-207) Alignment

| Zero Trust tenet | Current state | Target state |
|---|---|---|
| Every access request is authenticated and authorized, not just at the perimeter | Session validated per-request (via Supabase JWT), but authorization is per-action-inconsistent (`THREAT_MODEL.md` #10) | `authorize()` (`SECURITY_ARCHITECTURE_V1.md` §1) evaluated on every request, no implicit trust from prior access |
| Access is granted per-session, least-privilege, and re-evaluated continuously | Membership is checked, but doesn't expire (`AUTHORIZATION_GAP_ANALYSIS.md` §7), and role doesn't scope by department | Temporal access + department scoping close this |
| Dynamic policy considers device/session state | No session/device data collected at all today | `Session`/`SessionDevice` (`SECURITY_ARCHITECTURE_V1.md` §2) is the prerequisite |
| Continuous monitoring and logging | Effectively none beyond `ai_suggestion_log` | Two-stream audit (`AUDIT_EVENT_CATALOG.md`) |

FilmSet's target posture is closer to Zero Trust than a typical CRUD app already, because RLS enforces membership on *every* database query rather than trusting a session established once — but role/department/sensitivity are not yet part of that continuous evaluation, which is the actual gap.

## 3. OWASP Application Security

Spot-checked against the OWASP Top 10 as it applies to this specific architecture (Next.js Server Actions, no separate API, Postgres+RLS):

| Risk | Assessment |
|---|---|
| Broken Access Control | The single largest live gap — `THREAT_MODEL.md` #2, #5, #10. |
| Cryptographic Failures | No custom cryptography exists (correctly — everything rides Supabase's primitives, `AUTHORIZATION_GAP_ANALYSIS.md` §9); nothing found to flag here. |
| Injection | Drizzle ORM's parameterized queries are used throughout the reviewed code — no raw SQL string concatenation found in `apps/web/app/*/actions.ts`. Low risk as observed. |
| Insecure Design | The AI governance chain (`CURRENT_ARCHITECTURE_MAP.md` §7) is a genuine example of *secure-by-design* — flagged positively, not just as an absence of findings. |
| Security Misconfiguration | No CI (`CURRENT_ARCHITECTURE_MAP.md` §1) means no automated check catches a future misconfiguration (e.g. a table shipped without RLS) before it reaches production — this is process risk, not a current finding. |
| Vulnerable/Outdated Components | Not audited as part of this exercise (would require a dependency-vulnerability scan, which needs CI to run repeatably — see §1's sequencing note). |
| Identification & Authentication Failures | No MFA (`THREAT_MODEL.md` #1); the availability bug found in §1 of `AUTHORIZATION_GAP_ANALYSIS.md` is also relevant here — an auth check that can fail open under load is an availability *and* security consideration. |
| Software/Data Integrity Failures | No audit immutability yet (`AUDIT_EVENT_CATALOG.md` §5, `THREAT_MODEL.md` #15). |
| Security Logging & Monitoring Failures | The clearest, most direct match in this list — this is `AUDIT_EVENT_CATALOG.md`'s entire subject. |
| Server-Side Request Forgery | No user-controlled outbound requests found in the reviewed code (file imports parse *uploaded* content, not fetched URLs). Low risk as observed. |

## 4. SOC 2 Readiness (Trust Services Criteria)

| Criterion | Readiness note |
|---|---|
| Security | Depends on P1–P3 landing — today's access control is not evidence-producing (no audit trail to show an auditor). |
| Availability | Today's uptime posture includes a real, recently-fixed incident (the middleware timeout) and a known-live twin of it (`getSessionUser()`, `AUTHORIZATION_GAP_ANALYSIS.md` §1) — this must close before availability could be represented as controlled. |
| Processing Integrity | The Approval/Booking engines (`LOGISTICS_DOMAIN_MODEL.md` §0) are designed with auditable state transitions, which is the right shape for this criterion once built. |
| Confidentiality | Data classification (Part 9) is the direct prerequisite. |
| Privacy | See §6 below. |

**No timeline is given for pursuing SOC 2** — that is a business decision (cost, auditor selection, scope) outside this audit's mandate. This section only maps technical readiness.

## 5. ISO/IEC 27001 Readiness

ISO 27001 is primarily an **organizational** management-system standard (an ISMS, risk register, management review cadence) layered over technical controls similar to SOC 2's. The technical gaps are the same ones already listed in §3–§4. The organizational gaps (a formal risk register, documented ISMS scope, management review cadence) are new work regardless of FilmSet's engineering state — flagged here as out of this audit's engineering scope, but the risk register in `IMPLEMENTATION_ROADMAP.md` §Risk Register is a reasonable seed for one if the organization chooses to pursue this later.

## 6. Privacy (Part 24)

The session/security data this audit proposes collecting (`SECURITY_ARCHITECTURE_V1.md` §2) is itself personal data and needs privacy-aware handling, not just technical correctness:

| Concern | Design response |
|---|---|
| IP address precision | **Never** represent an IP-derived location as precise physical location — coarse (city/region-level, if shown at all) only, explicitly labeled as approximate. Stated as a hard constraint in `SECURITY_ARCHITECTURE_V1.md` §2. |
| Retention | Security event data retained per a defined policy (`AUDIT_EVENT_CATALOG.md` §5), not indefinitely by default. |
| Access | Session/device/login data visible to: the user themselves (their own sessions), and `security.*`-permission holders within their authorized scope only — never all-org-visible by default. |
| Display | Login History/Security Events (`SECURITY_ARCHITECTURE_V1.md` §5) show what's operationally necessary (device label, coarse location, timestamp) — not full user-agent strings or anything more granular than needed. |
| Export | `security.audit.export` is its own permission, separately grantable from `.view` — exporting personal data is a bigger action than viewing it in-app. |
| **The explicit constraint from the mandate**: security logging must not become uncontrolled employee surveillance — record only what's legitimately needed for safety, operations, and security, not a general activity-tracking system. This shapes §2's field list directly: no keystroke logging, no page-by-page activity trail beyond what `AUDIT_EVENT_CATALOG.md`'s named events cover. |
| GDPR / CCPA / PIPEDA readiness | Not assessed as a legal compliance exercise here (that needs counsel, not an architecture audit) — but the *technical* prerequisites these regimes commonly require (data export for a subject access request, deletion/right-to-be-forgotten support, a documented retention policy) are all consistent with, and largely delivered by, the audit-and-classification architecture already proposed. No conflict identified between this design and those regimes' typical technical requirements; legal review is still required before any compliance claim. |

## 7. Explicit Non-Claims

To be unambiguous: FilmSet is not currently TPN-assessed, not SOC 2 audited, not ISO 27001 certified, and this document is not a controls-implemented attestation for any of them. It is an engineering readiness map, produced as part of this audit's mandate, intended to inform sequencing (`IMPLEMENTATION_ROADMAP.md`) — not to be quoted externally as a compliance claim.
