# Loan Management System

A lending platform with two surfaces: a borrower portal for applying, and an operations
dashboard where Sales, Sanction, Disbursement and Collection teams move a loan through its
lifecycle. Role-based access is enforced on the API, not just in the UI.

- **Frontend** — Next.js 14 (App Router), TypeScript, Tailwind CSS
- **Backend** — Node.js, Express, TypeScript
- **Database** — MongoDB with Mongoose
- **File storage** — Supabase Storage (private bucket); file metadata lives in MongoDB
- **Auth** — JWT access/refresh tokens in httpOnly cookies, passwords hashed with bcrypt

---

## Contents

- [Quick start](#quick-start)
- [Creating accounts](#creating-accounts)
- [How the system works](#how-the-system-works)
- [Data model](#data-model)
- [Security decisions](#security-decisions)
- [Design decisions and assumptions](#design-decisions-and-assumptions)
- [Project structure](#project-structure)
- [API documentation](#api-documentation)

---

## Quick start

### Prerequisites

- Node.js 18.18 or newer
- A MongoDB instance (local or Atlas)
- A Supabase project with a **private** storage bucket

### 1. Supabase bucket

In your Supabase project → Storage → New bucket:

- Name: `loan-documents`
- Public bucket: **off**

The API talks to the bucket with the service-role key and issues short-lived signed URLs when
a document needs to be viewed. Nothing in the bucket is publicly reachable.

### 2. Backend

```bash
cd backend
cp .env.example .env
npm install
npm run dev          # http://localhost:4000
```

Generate the secrets before starting:

```bash
openssl rand -hex 48   # JWT_ACCESS_SECRET
openssl rand -hex 48   # JWT_REFRESH_SECRET
openssl rand -hex 32   # PII_ENCRYPTION_KEY  (must be exactly 64 hex characters)
openssl rand -hex 24   # ADMIN_BOOTSTRAP_TOKEN
```

The process validates every environment variable on boot and exits with a readable list if
anything is missing, so a half-configured server never starts serving traffic.

### 3. Frontend

```bash
cd frontend
cp .env.example .env.local
npm install
npm run dev          # http://localhost:3000
```

### 4. Health check

```bash
curl http://localhost:4000/health
```

---

## Creating accounts

Nothing is seeded and no credentials are hardcoded. The system allows **exactly one admin**,
enforced by a partial unique index in MongoDB, so a second one cannot be created even if the
bootstrap token leaks.

1. Visit `http://localhost:3000/setup`.
2. Enter the `ADMIN_BOOTSTRAP_TOKEN` from your backend `.env`, plus the admin name, email and
   password.
3. Sign in as the admin and open **Users** to create the Sales, Sanction, Disbursement and
   Collection accounts.
4. Borrowers sign themselves up at `/register`. Public registration always produces a
   `BORROWER`; role cannot be set from the request.

The same flow over the API:

```bash
curl -X POST http://localhost:4000/api/v1/auth/bootstrap-admin \
  -H 'Content-Type: application/json' \
  -d '{"bootstrapToken":"<token>","fullName":"Ops Admin","email":"admin@example.com","password":"Admin@1234"}'
```

Rotate or remove `ADMIN_BOOTSTRAP_TOKEN` after setup. Once an admin exists, the endpoint
returns `409` regardless of the token.

---

## How the system works

### Borrower journey

| Step | What happens | Where it is enforced |
| --- | --- | --- |
| 1. Sign up / sign in | Password hashed with bcrypt (cost 12), tokens set as httpOnly cookies | `modules/auth` |
| 2. Personal details | Business Rule Engine runs on the server; a failure blocks the application | `rules/bre.rules.ts` |
| 3. Salary slip | PDF/JPG/PNG up to 5 MB; magic bytes verified, then stored in Supabase | `modules/documents` |
| 4. Amount and tenure | Live repayment panel, then the loan is created with status `APPLIED` | `rules/loan.rules.ts` |

**Business Rule Engine.** An application is rejected if any of these fail:

| Rule | Condition for rejection |
| --- | --- |
| Age | Not between 23 and 50 (completed years at the time of application) |
| Salary | Below ₹25,000 per month |
| PAN | Does not match `^[A-Z]{5}[0-9]{4}[A-Z]$` |
| Employment | Applicant is unemployed |

The rules run in both places, for different reasons. The browser copy
(`frontend/src/lib/bre.ts`) gives instant feedback while someone types. The server copy is the
one that decides: it is the trust boundary, it is what gets persisted, and no endpoint accepts
a BRE verdict from the caller. A failed evaluation is still written down with status
`BRE_REJECTED` — rejections are a record worth keeping, and Sales uses them for follow-ups —
but it does not occupy the borrower's active-application slot, so they can correct their
details and retry.

**Loan maths.** Simple interest, fixed at 12% a year:

```
SI              = (P × R × T) / (365 × 100)     where T is the tenure in days
Total repayment = P + SI
```

Amounts sent by the client are treated as display values only. The server recomputes interest
from principal and tenure alone before writing the loan.

### Loan lifecycle

```
APPLIED ──approve──▶ SANCTIONED ──disburse──▶ DISBURSED ──fully repaid──▶ CLOSED
   │
   └────reject─────▶ REJECTED  (terminal)
```

Every transition is checked against one table in `rules/loanStatus.rules.ts`, which holds both
the legal transitions and the role that owns each one. A controller cannot invent a shortcut;
an illegal transition returns `409`, and a transition attempted by the wrong role returns `403`.

### Dashboard modules

| Module | Works on | Actions |
| --- | --- | --- |
| Sales | Registered borrowers with no loan yet | Lead tracking by stage, including BRE rejections |
| Sanction | `APPLIED` loans | Approve → `SANCTIONED`, or reject with a reason → `REJECTED` |
| Disbursement | `SANCTIONED` loans | Mark funds released → `DISBURSED` |
| Collection | `DISBURSED` loans | Record payments; the loan closes itself when fully repaid |

**Collection and the outstanding balance.** The balance is not recomputed from payment history
on every read. It is decremented atomically on the loan document with a match condition of
`outstanding >= amount`, so two executives submitting at the same moment cannot both succeed
past the balance and a loan can never be overpaid. UTR uniqueness is a unique index, so a
duplicate is rejected by the database rather than by a check that could race. Because MongoDB
may be running standalone without transaction support, the payment insert that follows the
decrement is compensated — the balance is restored — if it fails. Once `outstanding` reaches
zero the loan moves to `CLOSED` and `closedAt` is set.

---

## Data model

Five collections plus an append-only audit trail.

**users** — `fullName`, `email` (unique), `passwordHash` (never selected by default), `role`,
`isActive`, `tokenVersion`, `refreshTokenHash`, `lastLoginAt`, `createdBy`.
A partial unique index on `role` for `ADMIN` guarantees the single-admin rule.

**applications** — the KYC record that precedes a loan. `userId`, `fullName`, `panEncrypted`,
`panHash`, `panMasked`, `dateOfBirth`, `monthlySalary`, `employmentMode`, `status`, the full
`bre` evaluation with its failures and a snapshot of what was evaluated, and `documentId`.
A partial unique index keeps one active application per borrower.

**documents** — metadata only: `userId`, `applicationId`, `bucket`, `storagePath`,
`originalName`, `mimeType`, `sizeBytes`, `checksumSha256`. The bytes live in Supabase.

**loans** — `loanRef`, `userId`, `applicationId`, the frozen quote (`principal`, `tenureDays`,
`interestRate`, `simpleInterest`, `totalRepayment`), the running `amountPaid` and
`outstanding`, `status`, and who acted at each stage with timestamps.

**payments** — `loanId`, `utrNumber` (unique across all payments), `amount`, `paidAt`,
`recordedBy`, and `outstandingAfter` as an immutable snapshot of the balance at that moment.

**auditlogs** — `actorId`, `actorRole`, `action`, `entityType`, `entityId`, `metadata`, `ip`.

Relationships: a user has many applications and loans; an application has one document and
produces at most one loan; a loan has many payments.

---

## Security decisions

The system handles PAN numbers, salary figures and identity documents, so it is built as if
that data matters.

**PAN is encrypted at rest.** AES-256-GCM, which gives confidentiality plus tamper detection.
The stored `panMasked` (`ABCXXXXX4F`) is what every API response returns; the plaintext is
only decrypted when an executive needs it for a credit decision. A separate HMAC blind index
lets us enforce "one PAN, one live application" without storing the number in the clear.

**Documents are never public.** The bucket is private and object keys are server-generated and
namespaced per user, so a caller cannot choose a path or guess someone else's. Viewing a file
goes through the API, which checks ownership or reviewing role first, then mints a signed URL
that expires in five minutes.

**Tokens live in httpOnly cookies**, not localStorage, which removes the main XSS token-theft
path. The access token is short-lived; the refresh token is scoped to the auth path, stored
only as a hash, and rotated on every use. A refresh token that is valid but no longer current
is treated as a compromise: the session family is revoked. `tokenVersion` on the user lets a
logout, a password change or a deactivation invalidate every issued token at once.

**Access control is enforced twice.** The Next.js middleware and the role-filtered navigation
keep signed-out or wrong-role users off screens they cannot use. The API does the real work:
`authenticate` re-reads the user on every request so a role change or deactivation takes effect
immediately, and `authorize` gates each module router. Unauthenticated requests get `401`;
authenticated-but-not-permitted requests get `403`.

**Uploads are checked by content, not by claim.** The declared MIME type is caller-controlled,
so magic bytes are verified before anything reaches storage. Size is capped at 5 MB by multer
itself, before the whole body is buffered.

**Also in place:** helmet security headers, a credentialed CORS allow-list (never a wildcard),
rate limits that are tighter on credential endpoints, HPP against parameter pollution, request
bodies capped at 100 kB, Zod validation that strips unknown fields on every route, a login
path that does equal work whether or not the account exists (no enumeration), and an error
handler that logs internals but returns a generic 500 so driver messages and stack traces never
reach a client.

**Graceful shutdown.** On `SIGTERM`/`SIGINT` the server stops accepting connections, lets
in-flight requests finish, closes the MongoDB pool so no write is cut mid-flight, and hard-exits
if any of that hangs past 15 seconds. Unhandled rejections and uncaught exceptions leave
through the same path instead of dying where they stand.

---

## Design decisions and assumptions

Where the brief left something open, this is what was chosen and why.

- **Application and loan are separate collections.** An application is KYC plus an eligibility
  verdict; a loan is a financial instrument with a balance. Keeping them apart means a BRE
  rejection can be recorded without a phantom loan, and a borrower can reapply without
  rewriting history.
- **Statuses are split across the two.** `ApplicationStatus` tracks form progress
  (`DRAFT` → `DOCUMENT_UPLOADED` → `SUBMITTED`, or `BRE_REJECTED`); `LoanStatus` tracks money.
  Mixing them into one enum would have made both harder to reason about.
- **One active loan per borrower.** Real lenders do not stack unsecured loans on the same
  applicant without a fresh assessment. Closed and rejected loans do not block a new one.
- **Admin is implicitly allowed on executive routes** so a single person can demo or cover the
  whole flow. Admin-only routes use a separate guard with no such escalation.
- **Sales sees pre-application leads**, staged by how far each person got. Once a loan exists,
  the person leaves the sales funnel.
- **Rejection reasons are mandatory and at least 10 characters**, and the borrower sees them.
- **Payments are never edited or deleted.** A correction is a new record. `outstandingAfter`
  freezes the balance at the time of each payment.
- **Money is rounded to two decimals at the point of calculation**, never accumulated raw, with
  a half-paisa epsilon when deciding whether a loan is fully settled.
- **Everything of consequence is audited** — sign-ins, BRE rejections, document views, every
  status change and every payment — and the admin can read the trail in the dashboard.
- **Pagination everywhere.** Queues take `page` and `limit` (max 100) and return a `meta` block.

---

## Project structure

```
backend/
├── src/
│   ├── config/            env validation, MongoDB connection, Supabase client
│   ├── models/            Mongoose schemas and indexes
│   ├── rules/             business rules: BRE, loan maths, the status machine
│   ├── middleware/        auth, RBAC, validation, uploads, rate limits, errors
│   ├── modules/           one folder per domain
│   │   ├── auth/          controller · service · routes · validation · tokens · cookies
│   │   ├── applications/  personal details, salary slip, document access
│   │   ├── documents/     Supabase storage service
│   │   ├── loans/         quotes, application, shared transition loader
│   │   ├── sales/         lead queue
│   │   ├── sanction/      approve and reject
│   │   ├── disbursement/  release funds
│   │   ├── collection/    payments and auto-close
│   │   ├── admin/         users, overview, audit log
│   │   └── audit/         append-only trail
│   ├── utils/             errors, logger, crypto, masking, responses, pagination
│   ├── types/             enums and Express type augmentation
│   ├── routes.ts          API router composition
│   ├── app.ts             Express app assembly
│   └── server.ts          bootstrap and graceful shutdown
└── .env.example

frontend/
├── src/
│   ├── app/
│   │   ├── page.tsx           landing
│   │   ├── login, register    authentication
│   │   ├── setup              one-time admin creation
│   │   ├── apply              the four-step borrower flow
│   │   ├── loans              borrower loan status
│   │   └── dashboard/         layout + one page per module
│   ├── components/
│   │   ├── ui/                button, field, table, modal, status, alert, stat
│   │   ├── apply/             step indicator and the three steps
│   │   └── dashboard/         page header, loan queue, pagination, document link
│   ├── context/               auth provider
│   ├── lib/                   api client, types, formatting, BRE and loan mirrors, roles
│   └── middleware.ts          route protection
└── .env.example
```

Every module follows the same shape: **routes** wire middleware, **controllers** handle HTTP,
**services** hold the logic, **rules** hold the business decisions, **models** hold the data.
Controllers never touch Mongoose directly and services never touch `req`/`res` except where a
service owns cookie state.

---

## API documentation

Full endpoint reference, request and response shapes, status codes and error format:
[`docs/API.md`](./docs/API.md).

---

## Scripts

```bash
# backend
npm run dev         # watch mode
npm run build       # compile to dist/
npm start           # run the compiled server
npm run typecheck   # types only

# frontend
npm run dev
npm run build
npm start
npm run typecheck
```
