# Organisation and Role Charters

## Startup organisation

```text
Founder / Owner: Tanzim
|
|-- Product & Engineering
|   |-- Frontend / Tools Contributor
|   |-- QA & Accessibility Contributor
|   |-- Security / Reliability Reviewer
|
|-- Content & Research
|   |-- FC Mobile Researcher
|   |-- Guide / Editorial Writer
|   |-- Fact-checker
|
|-- Growth & Community
|   |-- Social Content Contributor
|   |-- Discord / Community Moderator
|   |-- Partnerships Researcher
|
|-- Operations & Governance
|   |-- Volunteer Coordinator
|   |-- Project / Documentation Coordinator
|   |-- Metrics & Audit Reviewer
|
+-- Independent Review: assigned per task, not the task author
```

This is a function map, not a hiring target. Start with 2–4 dependable volunteers and one small project at a time. Add a lead only when there is enough consistent work to justify one. One person may hold multiple roles, but must not approve their own sensitive work.

## Role charters

### Founder / Owner
**Accountable for:** strategy, product priorities, brand, budgets, legal decisions, production deployment authority, privileged access and final incident decisions.

**Expected routine:** publish monthly priorities, approve high-risk changes, review reports, unblock leads and keep a record of decisions.

**Must not:** imply volunteers are paid employees; make commitments the project cannot fund; allow a single contributor to create, approve and deploy a sensitive change without review where a second reviewer is available.

### Product & Engineering Lead
**Owns:** backlog, technical standards, code review, release notes, bug triage, performance and maintenance.

**Measures:** completed tasks, escaped defects, broken tools, deployment failures, accessibility and performance regressions.

**Controls:** no production secrets in Git; no unreviewed high-risk change; use a pull request for material production changes when feasible.

### Content & Research Lead
**Owns:** source checking, editorial calendar, update accuracy, article quality and correction log.

**Measures:** factual corrections, outdated pages fixed, useful content shipped and content that brings relevant users.

**Controls:** verify redeem codes and event dates against credible sources; show expiry or uncertainty honestly; do not fabricate sources or publish copied content.

### Growth & Community Lead
**Owns:** publishing calendar, community feedback, moderation standards, partnership pipeline and campaign tracking.

**Measures:** qualified visits, returning users, relevant sign-ups, useful feedback and campaign conversion where measurable.

**Controls:** no spam, fake engagement, undisclosed endorsements or unapproved giveaways. Do not promise partners traffic or revenue that cannot be demonstrated.

### Operations & Governance Lead
**Owns:** task hygiene, onboarding, role register, meeting notes, monthly reporting, policy versions and risk tracking.

**Measures:** overdue critical tasks, report completion, access reviews, documented decisions and resolved risks.

**Controls:** cannot grant themselves privileged access or audit their own operational work. Escalate serious findings to the owner.

### QA / Independent Reviewer
**Owns:** checking the acceptance criteria and testing evidence for work they did not author.

**Measures:** defects caught before release, regression coverage and unresolved high-severity findings.

**Controls:** record evidence, severity, owner and deadline. A review is not passed merely because the author says it works.

## Decision matrix

| Decision | Responsible | Final approval |
|---|---|---|
| Routine task implementation | Assigned contributor | Department lead |
| Editorial publication | Writer and fact-checker | Editorial lead or delegate |
| Normal code merge | Contributor and reviewer | Engineering lead / authorised maintainer |
| Production deploy or rollback | Authorised maintainer | Owner or delegated release lead |
| New service, spending, contract | Proposer | Tanzim |
| Account, data or security incident | First responder | Tanzim; involve technical lead |
| Volunteer appointment or removal | Operations | Tanzim |
| Audit finding closure | Finding owner provides evidence | Reviewer other than the finding owner |

## Volunteer progression

Use responsibility levels, not inflated corporate titles:

1. **Applicant:** understands the role and time commitment.
2. **Trial Contributor:** small, low-risk task with a named reviewer.
3. **Contributor:** completes work reliably and follows the handbook.
4. **Senior Contributor:** handles larger work, mentors others and documents decisions.
5. **Function Lead:** coordinates a defined function and reports results.

Progression depends on quality, reliability, judgement and conduct, not raw hours or follower counts. A title does not automatically grant repository admin, production secrets, user data or financial authority.
