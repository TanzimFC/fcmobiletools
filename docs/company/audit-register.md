# Audit and Risk Register

The audit process is a lightweight check on whether the site is safe, accurate, reliable and responsibly managed. It is not a certification or a substitute for professional legal or security review.

## Audit schedule

| Frequency | Check | Owner | Evidence |
|---|---|---|---|
| Weekly | Broken critical tools, code expiry and high-priority bugs | Product / Editorial | Issue links and retest notes |
| Monthly | Repository and production access | Owner + reviewer | Role register and access review date |
| Monthly | Website smoke test, forms, login and key user journeys | QA reviewer | Checklist, screenshots without private data |
| Monthly | Privacy, analytics, cookies, forms and data collection changes | Owner + technical reviewer | Data-flow notes and policy change log |
| Monthly | Content source quality and outdated claims | Editorial reviewer | Sampled URLs and corrections |
| Monthly | Financial ledger, commitments and approval records | Owner + independent reviewer if available | Receipts, ledger and reconciled balance |
| Quarterly | Dependencies, secret handling, backup/recovery and incident readiness | Engineering + independent reviewer | Findings and retest evidence |
| Before major release | Regression, accessibility and rollback readiness | QA + release owner | Test results and release notes |

If a second reviewer is not available, record the limitation and have the owner review the evidence. Do not label self-review as independent audit.

## Finding severity

- **Critical:** active compromise, exposed secret with meaningful access, serious user-data exposure, or a dangerous failure affecting users. Escalate immediately, contain first, and suspend affected functionality if needed.
- **High:** important user journey broken, significant security weakness, materially misleading public information or repeated production failure. Assign an owner immediately and agree a short remediation deadline.
- **Medium:** limited defect, stale documentation or a control gap with a workable alternative. Schedule within the current or next cycle.
- **Low:** cosmetic, minor consistency or process improvement. Add to backlog.

Severity should reflect observed impact and likelihood. Record uncertainty instead of overstating risk.

## Audit finding template

```text
Finding ID:
Date / reviewer:
Area:
Severity:
Evidence / affected path:
Observed condition:
Expected condition:
User or business impact:
Containment (if needed):
Corrective action:
Owner:
Due date:
Retest method:
Status: Open / In progress / Ready to retest / Closed
Closure evidence:
```

The person who implemented a fix must not be the sole person approving closure when another reviewer is available. Reopen findings if the retest fails.

## Initial risk register

| ID | Risk | Initial response | Owner |
|---|---|---|---|
| R-01 | Owner burnout and single-person dependency | Document release, domain and incident procedures; delegate bounded tasks | Founder |
| R-02 | Volunteer turnover | Keep tasks small, document handovers, maintain more than one person familiar with critical work | Operations |
| R-03 | Production regression | Pull request review, smoke tests, release notes and rollback plan | Engineering |
| R-04 | Secrets or privileged access exposed | Least privilege, MFA, secret scanning where available, rotate exposed credentials | Founder / Engineering |
| R-05 | Incorrect or expired redeem-code information | Record source and verification date; make expiry status clear; correct promptly | Editorial |
| R-06 | Personal data collected without clear need | Minimise collection, document purpose and retention, restrict access | Founder |
| R-07 | Unsupported claims in growth or sponsor pitches | Use sourced analytics, state periods and definitions, separate projections from actual results | Growth |
| R-08 | Copyright or contributor ownership dispute | Check asset licenses and agree contribution terms before accepting material work | Founder |
| R-09 | Service/provider outage | Document provider dependencies and recovery steps; communicate verified impact | Engineering |
| R-10 | Giveaway fraud or unfair moderation | Publish clear rules, restrict access to proofs, retain decision evidence and appeal path | Community |
| R-11 | Untracked spending or promised compensation | Keep a zero-based ledger and require written approval before commitments | Founder |
| R-12 | One person approves their own sensitive change | Require a second reviewer where feasible and record exceptions | Operations |

## Monthly access audit

Check GitHub, Cloudflare, Supabase, analytics, OneSignal, Discord and any other active service. Record who has access, why they need it, whether MFA is enabled where supported, and whether access remains appropriate. Never paste secret values into the register.

## Budget and financial control

Approved operating budget starts at **$0**. Record cash received and spent even if both are zero. Before any purchase or commitment, record purpose, amount, provider, funding source and explicit owner approval. Do not count a donation, sponsor promise, pending payout or estimated ad revenue as cash received.

Suggested ledger columns: date, type, category, description, amount, currency, status, evidence link, approved by. Reconcile monthly. Do not mix personal and project funds without clear records.

## Closure standard

An audit cycle closes only when each finding is resolved with evidence, explicitly accepted with a named decision-maker and review date, or carried forward with a reason and due date. Critical findings cannot be silently waived.
