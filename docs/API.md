# LMS API Reference

Base URL: `http://localhost:4000/api/v1`

All request and response bodies are JSON, except the salary slip upload, which is
`multipart/form-data`.

---

## Conventions

### Response envelope

Success:

```json
{ "success": true, "data": { } }
```

Paginated success:

```json
{
  "success": true,
  "data": [],
  "meta": { "page": 1, "limit": 20, "total": 42, "totalPages": 3 }
}
```

Failure:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": [{ "field": "pan", "message": "PAN must look like ABCDE1234F" }],
    "requestId": "b0c1…"
  }
}
```

### Status codes

| Code | Meaning |
| --- | --- |
| 200 | Request succeeded |
| 201 | Resource created |
| 400 | Malformed request or failed validation |
| 401 | No session, or the session expired |
| 403 | Authenticated, but this role may not do this |
| 404 | Resource does not exist |
| 409 | Conflict — duplicate record or an illegal status transition |
| 413 | Uploaded file exceeds 5 MB |
| 422 | Well-formed, but rejected by a business rule (BRE failure, missing prerequisite) |
| 429 | Rate limit exceeded |
| 500 | Unexpected server error |
| 502 | Storage provider failure |
| 503 | Database unavailable (health check only) |

### Authentication

On sign-in the API sets two httpOnly cookies:

| Cookie | Lifetime | Path |
| --- | --- | --- |
| `lms_access_token` | 15 minutes | `/` |
| `lms_refresh_token` | 7 days | `/api/v1/auth` |

Browser clients send `credentials: 'include'` and need nothing else. API clients may instead
send `Authorization: Bearer <accessToken>`.

When an access token expires, call `POST /auth/refresh`; it rotates both tokens. A refresh
token that is valid but no longer the current one revokes the session family.

### Roles

`ADMIN`, `SALES`, `SANCTION`, `DISBURSEMENT`, `COLLECTION`, `BORROWER`.

Each executive role reaches only its own module. `ADMIN` reaches all of them plus the
admin-only routes. Borrowers reach the application portal only.

### Rate limits

| Scope | Window | Limit |
| --- | --- | --- |
| All endpoints | 15 min | 300 requests |
| `/auth/register`, `/auth/login`, `/auth/bootstrap-admin` | 15 min | 10 failed attempts |
| Document upload | 1 hour | 20 requests |

---

## Health

### `GET /health`

Unauthenticated. Outside the `/api/v1` prefix.

```json
{ "success": true, "data": { "status": "ok", "database": "up", "uptime": 128.4 } }
```

Returns `503` with `"database": "down"` when MongoDB is unreachable.

---

## Authentication

### `POST /auth/bootstrap-admin`

Creates the single admin account. Requires the `ADMIN_BOOTSTRAP_TOKEN` from the server
environment. Returns `409` once an admin exists, whatever token is supplied.

```json
{
  "bootstrapToken": "…",
  "fullName": "Ops Admin",
  "email": "admin@example.com",
  "password": "Admin@1234"
}
```

`201` → `{ "user": { "id", "fullName", "email", "role": "ADMIN", "isActive", "createdAt" } }`

---

### `POST /auth/register`

Public sign-up. Always creates a `BORROWER`; the role cannot be set from the request.

```json
{
  "fullName": "Asha Verma",
  "email": "asha@example.com",
  "phone": "9876543210",
  "password": "Asha@1234"
}
```

Password policy: 8–128 characters with at least one uppercase letter, one lowercase letter and
one digit. `phone` is optional and must be a 10-digit Indian mobile number.

`201` → `{ "user": … }`, with auth cookies set.
`409` if the email is already registered.

---

### `POST /auth/login`

```json
{ "email": "asha@example.com", "password": "Asha@1234" }
```

`200` → `{ "user": … }`, with auth cookies set.
`401` for wrong credentials — the same message whether or not the account exists.
`403` if the account has been deactivated.

---

### `POST /auth/refresh`

Reads the refresh cookie, rotates both tokens, returns the current user.

`200` → `{ "user": … }` · `401` if missing, expired or revoked.

---

### `POST /auth/logout`

Authenticated. Bumps `tokenVersion`, clears the stored refresh hash and both cookies, which
signs every session for that account out.

`200` → `{ "message": "Signed out" }`

---

### `GET /auth/me`

Authenticated. Returns the current user.

`200` → `{ "user": … }`

---

### `POST /auth/change-password`

Authenticated.

```json
{ "currentPassword": "Old@1234", "newPassword": "New@12345" }
```

`200` → `{ "message": "Password updated. Please sign in again." }`
All other sessions are invalidated. `400` if the current password is wrong.

---

## Applications — borrower

### `POST /applications/personal-details`

Role: `BORROWER`. Step 2 of the journey. Runs the Business Rule Engine server-side.

```json
{
  "fullName": "Asha Verma",
  "pan": "ABCDE1234F",
  "dateOfBirth": "1995-04-12",
  "monthlySalary": 60000,
  "employmentMode": "SALARIED"
}
```

`employmentMode` is one of `SALARIED`, `SELF_EMPLOYED`, `UNEMPLOYED`.

`201` on success:

```json
{
  "application": {
    "id": "…",
    "fullName": "Asha Verma",
    "panMasked": "ABCXXXXX4F",
    "dateOfBirth": "1995-04-12T00:00:00.000Z",
    "monthlySalary": 60000,
    "employmentMode": "SALARIED",
    "status": "DRAFT",
    "bre": { "passed": true, "failures": [], "evaluatedAt": "…" },
    "hasDocument": false,
    "documentId": null,
    "submittedAt": null,
    "createdAt": "…"
  }
}
```

`422` when the BRE rejects the applicant. The application is still recorded, with status
`BRE_REJECTED`, and the borrower may correct their details and try again.

```json
{
  "success": false,
  "error": {
    "code": "UNPROCESSABLE_ENTITY",
    "message": "You are not eligible for a loan based on the details provided",
    "details": [
      { "rule": "AGE", "message": "Applicant age must be between 23 and 50. Calculated age: 21." },
      { "rule": "SALARY", "message": "Monthly salary must be at least ₹25,000." }
    ]
  }
}
```

`409` if an application is already in progress, or if the PAN is on another live application.

The PAN is never returned in full. It is stored encrypted with AES-256-GCM alongside a masked
form for display and an HMAC blind index for uniqueness checks.

---

### `POST /applications/:id/documents`

Role: `BORROWER`. Step 3. `multipart/form-data` with a single field named `file`.

- Accepted: `application/pdf`, `image/jpeg`, `image/png`
- Maximum size: 5 MB
- The file's magic bytes are verified; a renamed file is rejected regardless of its
  `Content-Type`
- Uploading again replaces the previous slip, and the old object is removed from storage

`201` → `{ "documentId": "…", "originalName": "payslip.pdf", "sizeBytes": 148213 }`

`400` wrong type or unreadable contents · `413` over 5 MB · `403` the application failed the
BRE · `409` the application is already submitted.

---

### `GET /applications/me`

Role: `BORROWER`. The borrower's active application, or `null`.

`200` → `{ "application": { … } | null }`

---

### `GET /applications/me/history`

Role: `BORROWER`. Up to the 20 most recent applications, including BRE rejections.

`200` → `{ "applications": [ … ] }`

---

### `GET /applications/documents/:id/url`

Authenticated. Returns a signed URL, valid for 5 minutes by default.

Access: the borrower who owns the file, or `ADMIN`, `SANCTION`, `DISBURSEMENT`, `COLLECTION`.
Every view is written to the audit log.

`200`:

```json
{
  "url": "https://…supabase.co/storage/v1/object/sign/…",
  "expiresIn": 300,
  "originalName": "payslip.pdf",
  "mimeType": "application/pdf"
}
```

`403` for anyone else · `404` if the document does not exist.

---

## Loans

### `GET /loans/quote?principal=150000&tenureDays=90`

Authenticated. The server's own calculation, so the client panel can be verified against it.

`200`:

```json
{
  "quote": {
    "principal": 150000,
    "tenureDays": 90,
    "interestRate": 12,
    "simpleInterest": 4438.36,
    "totalRepayment": 154438.36
  },
  "limits": { "MIN_PRINCIPAL": 50000, "MAX_PRINCIPAL": 500000, "…": "…" }
}
```

---

### `POST /loans`

Role: `BORROWER`. Step 4. Requires a BRE-passed application with a salary slip on file.

```json
{ "principal": 150000, "tenureDays": 90 }
```

Principal ₹50,000–₹5,00,000; tenure 30–365 days. Interest is recomputed server-side; any
amounts in the request beyond these two fields are ignored.

`201` → `{ "loan": { "loanRef": "LN-2026-7F3A21C4", "status": "APPLIED", … } }`

`422` prerequisites not met · `409` an active loan already exists · `400` outside the limits.

---

### `GET /loans/me`

Role: `BORROWER`. Every loan for the signed-in borrower, newest first.

`200` → `{ "loans": [ … ] }`

---

### `GET /loans/:id`

Authenticated. Borrowers may only read their own loans; executives and the admin may read any.
The response populates the borrower and the application (with the PAN masked).

`200` → `{ "loan": { … } }` · `403` for another borrower's loan · `404` if unknown.

---

## Sales module

Role: `SALES` (or `ADMIN`).

### `GET /sales/leads?page=1&limit=20&search=asha`

Registered borrowers who have not raised a loan yet. `search` matches name or email.

`200` → paginated list of:

```json
{
  "userId": "…",
  "fullName": "Asha Verma",
  "email": "asha@example.com",
  "phone": "9876543210",
  "registeredAt": "…",
  "stage": "DOCUMENT_UPLOADED",
  "applicationId": "…",
  "panMasked": "ABCXXXXX4F",
  "monthlySalary": 60000,
  "employmentMode": "SALARIED",
  "breFailures": [],
  "lastActivityAt": "…"
}
```

`stage` is `REGISTERED`, `DETAILS_SUBMITTED`, `DOCUMENT_UPLOADED` or `BRE_REJECTED`.

### `GET /sales/stats`

`200` → `{ "totalBorrowers", "openLeads", "inProgress", "breRejected", "converted" }`

---

## Sanction module

Role: `SANCTION` (or `ADMIN`).

### `GET /sanction/queue?page=1&limit=20&search=LN-2026`

Loans with status `APPLIED`, newest first, with borrower and application populated.

### `PATCH /sanction/loans/:id/approve`

```json
{ "note": "Salary slip matches declared income" }
```

`note` is optional and is recorded in the audit log.
`APPLIED` → `SANCTIONED`, stamping `sanctionedBy` and `sanctionedAt`.

`200` → `{ "loan": { … } }` · `409` if the loan is not `APPLIED` · `403` for the wrong role.

### `PATCH /sanction/loans/:id/reject`

```json
{ "reason": "Declared income not supported by the salary slip" }
```

`reason` is required, 10–500 characters, and is shown to the borrower.
`APPLIED` → `REJECTED`, which is terminal.

`200` → `{ "loan": { … } }` · `400` if the reason is too short · `409` if the loan is not `APPLIED`.

### `GET /sanction/stats`

`200` → `{ "pending", "sanctioned", "rejected" }`

---

## Disbursement module

Role: `DISBURSEMENT` (or `ADMIN`).

### `GET /disbursement/queue?page=1&limit=20`

Loans with status `SANCTIONED`.

### `PATCH /disbursement/loans/:id/disburse`

```json
{ "transferReference": "NEFT240612XYZ", "note": "Released to primary account" }
```

Both fields optional; both are recorded in the audit log.
`SANCTIONED` → `DISBURSED`, stamping `disbursedBy` and `disbursedAt`.

`200` → `{ "loan": { … } }` · `409` if the loan is not `SANCTIONED`.

### `GET /disbursement/stats`

`200` → `{ "pending", "disbursed", "disbursedValue" }`

---

## Collection module

Role: `COLLECTION` (or `ADMIN`).

### `GET /collection/queue?page=1&limit=20`

Loans with status `DISBURSED`, each carrying `amountPaid` and `outstanding`.

### `GET /collection/loans/:id/payments`

`200` → `{ "payments": [ { "utrNumber", "amount", "paidAt", "outstandingAfter", "recordedBy", … } ] }`

### `POST /collection/loans/:id/payments`

```json
{
  "utrNumber": "UTR240612001",
  "amount": 54438.36,
  "paidAt": "2026-06-12",
  "note": "IMPS from registered account"
}
```

Validation:

- `utrNumber` — 8–32 letters or digits, unique across every payment in the system
- `amount` — greater than zero and no more than the outstanding balance
- `paidAt` — not in the future, and not before the loan was disbursed

The balance is decremented atomically with a `outstanding >= amount` guard, so concurrent
submissions cannot overpay a loan. When the balance reaches zero the loan moves to `CLOSED` in
the same request.

`201`:

```json
{
  "payment": { "utrNumber": "UTR240612001", "amount": 54438.36, "outstandingAfter": 0, … },
  "loan": { "status": "CLOSED", "amountPaid": 154438.36, "outstanding": 0, … },
  "closed": true
}
```

`409` duplicate UTR, loan already closed, or loan not disbursed ·
`400` amount exceeds the outstanding balance, or the date is invalid.

### `GET /collection/stats`

`200` → `{ "activeLoans", "closedLoans", "totalCollected", "totalOutstanding" }`

---

## Admin module

Role: `ADMIN` only. These routes do not accept any other role.

### `POST /admin/users`

```json
{
  "fullName": "Ravi Kumar",
  "email": "ravi@example.com",
  "phone": "9876500000",
  "password": "Ravi@1234",
  "role": "SANCTION"
}
```

`role` is one of `SALES`, `SANCTION`, `DISBURSEMENT`, `COLLECTION`, `BORROWER`. `ADMIN` is
rejected with `403` — the system supports exactly one admin.

`201` → `{ "user": … }` · `409` if the email is taken.

### `GET /admin/users?page=1&limit=20&role=SANCTION&search=ravi`

Paginated user list. Password hashes are never included.

### `PATCH /admin/users/:id/status`

```json
{ "isActive": false }
```

Deactivating bumps `tokenVersion`, so the user's sessions stop working immediately.

`200` → `{ "user": … }` · `403` for the admin account · `400` for your own account.

### `GET /admin/overview`

`200`:

```json
{
  "loans": { "APPLIED": { "count": 3, "value": 450000 }, "CLOSED": { "count": 5, "value": 900000 } },
  "totalLoans": 8,
  "usersByRole": { "BORROWER": 12, "SANCTION": 1 },
  "totalApplications": 14,
  "totalCollected": 921500.5
}
```

### `GET /admin/loans?page=1&limit=20&status=DISBURSED&search=LN-2026`

Every loan, filterable by status.

### `GET /admin/audit-logs?page=1&limit=25`

The append-only trail, newest first, with the actor populated.

```json
{
  "action": "LOAN_SANCTIONED",
  "entityType": "Loan",
  "entityId": "…",
  "actorRole": "SANCTION",
  "actorId": { "fullName": "Ravi Kumar", "email": "ravi@example.com" },
  "metadata": { "note": null },
  "createdAt": "…"
}
```

Recorded actions: `USER_REGISTERED`, `USER_LOGGED_IN`, `USER_LOGGED_OUT`,
`ADMIN_BOOTSTRAPPED`, `USER_CREATED`, `USER_STATUS_CHANGED`, `APPLICATION_CREATED`,
`APPLICATION_BRE_REJECTED`, `DOCUMENT_UPLOADED`, `DOCUMENT_VIEWED`, `LOAN_APPLIED`,
`LOAN_SANCTIONED`, `LOAN_REJECTED`, `LOAN_DISBURSED`, `PAYMENT_RECORDED`, `LOAN_CLOSED`.

---

## End-to-end walkthrough

```bash
BASE=http://localhost:4000/api/v1

# 1. Create the admin (once)
curl -X POST $BASE/auth/bootstrap-admin -H 'Content-Type: application/json' \
  -d '{"bootstrapToken":"<token>","fullName":"Ops Admin","email":"admin@example.com","password":"Admin@1234"}'

# 2. Admin signs in, then creates the executive accounts
curl -X POST $BASE/auth/login -c admin.txt -H 'Content-Type: application/json' \
  -d '{"email":"admin@example.com","password":"Admin@1234"}'

curl -X POST $BASE/admin/users -b admin.txt -H 'Content-Type: application/json' \
  -d '{"fullName":"Sanction Exec","email":"sanction@example.com","password":"Sanc@1234","role":"SANCTION"}'

# 3. Borrower signs up and applies
curl -X POST $BASE/auth/register -c borrower.txt -H 'Content-Type: application/json' \
  -d '{"fullName":"Asha Verma","email":"asha@example.com","password":"Asha@1234"}'

curl -X POST $BASE/applications/personal-details -b borrower.txt -H 'Content-Type: application/json' \
  -d '{"fullName":"Asha Verma","pan":"ABCDE1234F","dateOfBirth":"1995-04-12","monthlySalary":60000,"employmentMode":"SALARIED"}'

curl -X POST $BASE/applications/<applicationId>/documents -b borrower.txt -F 'file=@payslip.pdf'

curl -X POST $BASE/loans -b borrower.txt -H 'Content-Type: application/json' \
  -d '{"principal":150000,"tenureDays":90}'

# 4. Sanction approves, disbursement releases, collection settles
curl -X PATCH $BASE/sanction/loans/<loanId>/approve -b sanction.txt -H 'Content-Type: application/json' -d '{}'
curl -X PATCH $BASE/disbursement/loans/<loanId>/disburse -b disb.txt -H 'Content-Type: application/json' -d '{}'
curl -X POST $BASE/collection/loans/<loanId>/payments -b coll.txt -H 'Content-Type: application/json' \
  -d '{"utrNumber":"UTR240612001","amount":154438.36,"paidAt":"2026-06-12"}'
# → the loan closes itself: "closed": true
```
