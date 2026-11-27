# VANBOOK PH web application

Next.js App Router, TypeScript, Tailwind CSS, and Supabase. Run commands below
from this `web/` directory. The current development environment uses Node.js 24.

## Local setup

```powershell
npm ci
Copy-Item .env.example .env.local
```

Skip the copy if `.env.local` already exists. In `.env.local`, set:

```dotenv
SUPABASE_URL=https://pphyhsdpdsycfaleflyv.supabase.co
SUPABASE_PUBLISHABLE_KEY=your-project-publishable-key
SITE_URL=http://localhost:3000
```

Get the publishable key from the existing Supabase project's **Connect** dialog.
Use an `sb_publishable_...` key. The environment file is ignored by Git; only the
example is committed. Database passwords and secret/service-role keys are not
needed for normal customer sign-in. SUPABASE_SECRET_KEY is server-only and is
required for operator registration and admin invitations.

```powershell
npm run check:supabase
npm run dev
```

Open http://localhost:3000. Restart the development server after changing the
environment. Supabase connection settings are read on the server; no
NEXT_PUBLIC_ variables or browser Supabase client are required.

## Production environment checks

Production builds validate SUPABASE_URL,
SUPABASE_PUBLISHABLE_KEY, and SITE_URL before generating pages.
Missing or invalid configuration fails the build with the variable names,
preventing deployment of a request proxy that returns 500 on every page.

SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY are server-side variables without
the NEXT_PUBLIC_ prefix; they can use visibility secret in Vercel. SITE_URL uses
visibility config. SUPABASE_SECRET_KEY uses visibility secret and is needed for
operator registration and administrator invitations, but optional for ordinary
customer sign-in. SITE_URL must be the deployed HTTPS origin on Vercel.
Environment updates require a new deployment. No connection values are committed,
printed in validation errors, or embedded in the browser bundle.

## Supabase connection

- `lib/supabase/env.ts`: validates configuration when a client is created.
- Browser forms call authenticated server actions; there is no browser Supabase client.
- `lib/supabase/server.ts`: request-specific server client using async `cookies()`.
- `lib/supabase/proxy.ts` and `proxy.ts`: verify/refresh sessions before rendering,
  forward refreshed cookies to the request and response, and preserve the SDK's
  cache-prevention headers. Static assets are excluded.

Server Components cannot write cookies; the proxy handles refreshes before they
render. Server Actions and Route Handlers can write cookies through the server
client. A server client must never be shared between requests or put inside a
`use cache` scope. Any future auth Route Handler that refreshes sessions must
return a private, non-cacheable response.

The proxy is session plumbing, not an authorization guard. Future private
operations must verify identity using `auth.getClaims()` or `auth.getUser()` and
enforce ownership through database RLS. Do not authorize using `getSession()` or
editable user metadata. The account page verifies the current user on the
server. Operator/admin workspaces also check protected membership and enforce
record ownership through RLS.

## Existing database inspection

Target project: `pphyhsdpdsycfaleflyv`.

The publishable key verifies connectivity to Supabase Auth. It does not grant
database-administration access. The schema endpoint currently requires a secret
key; a successful Auth check does not establish that the database is empty or
that its RLS/storage configuration is correct.

On 27 November 2026, the user ran `../supabase/inspection.sql` in the project's
SQL Editor and supplied the result. The normalized snapshot is saved in
`../supabase/inspection-report.json`; it was not retrieved through a connector.

The report shows:

- No public tables, views, columns, indexes, constraints, or functions.
- No public table grants or policies in the public/storage schemas.
- No storage buckets.
- Only Supabase's standard schemas in the returned schema list; no additional
  application schema was listed.

Step 2's connection setup and initial schema inspection are complete. No tables,
policies, buckets, users, or migrations have been created in this increment.
Application schema changes will be introduced through versioned migrations;
database types will be generated when application tables are introduced.

The inspection does not read Auth users, application records, document contents,
or dashboard Auth settings. It does not establish whether any Auth accounts
exist. Step 3's read-only Auth settings check confirmed that email signup is
enabled and automatic email confirmation is disabled. Dashboard redirect URLs,
email templates, SMTP configuration, and real inbox delivery remain unverified.

The SELECT-only inspection query can be rerun in the SQL Editor if needed. The
saved snapshot describes the supplied result, not a live view of the project.

## Email/password authentication and responsive layout

Registration uses email and a password, followed by an email confirmation link.
There is no OTP, Google, or mobile-number sign-in in this increment.

- `/`: public landing page, sample routes and a quote-form preview.
- `/sign-in`: email/password sign-in, with confirmation resend.
- `/register`: non-submitting customer form in the same animated-van auth shell.
- `/auth/callback`: exchange the confirmation link's PKCE code for a session.
- `/account`: server-verified account and sign-out for the current browser.
- `/sign-in/password`: compatibility redirect to `/sign-in`.

The teal background fills the viewport at every width, with no outer mobile or
tablet gutters. Below 1024px, the content stacks; desktop uses two columns with
a 24–48px gap. Typography uses rem-based fluid sizes and the illustration scales
with viewport height. Short mobile screens reduce or hide the decorative image.
Standard sign-in screens fit without scrolling; larger text, validation feedback,
registration, and the keyboard can still scroll rather than clipping controls.
Sign-in now reads the protected role from public.users through account_access;
apply the current schema before testing authenticated routes.

### Supabase settings and confirmation emails

Keep email confirmation enabled. In **Confirm signup**, keep the default
`{{ .ConfirmationURL }}` link or use `../supabase/templates/confirm-signup.html`.
If you previously applied the OTP template, replace it with this confirmation-link
template. This app no longer requests or verifies email OTPs. Magic Link is not
used by the current flow.

Set the local dashboard Site URL to `http://localhost:3000` and allow
`http://localhost:3000/**` as a development Redirect URL. Keep `SITE_URL` in
`.env.local` aligned. For production, use the actual HTTPS origin and restrict
redirect entries to supported callback URLs/query parameters.

Without custom SMTP, the built-in email service restricts recipients to project
team addresses. Use a permitted inbox or configure SMTP for other customers.
Dashboard templates, redirect settings, and SMTP have not been changed through
this chat. Real inbox delivery still needs a manual test.

### Try the flow

1. Run `npm run dev`, open `/register/operator`, and submit your business,
   documents, and at least one van with a front photo using your own inbox.
2. Open the confirmation email link in the browser where you registered.
3. Confirm `/operator` shows your application and document review status.
4. Sign out, then sign in with the email and password you registered.
5. Try a wrong password, an expired/reused confirmation link, and confirmation
   resend to check recovery. Do not share passwords, links, or session cookies.

Automated tests use a local Auth server and fixture credentials. They cover
registration, link confirmation, unconfirmed-account rejection, cookie/session
restoration, expired-token refresh, sign-out, invalid passwords, resend, offline
recovery, and responsive layouts at 320, 375, 768, 1024, 1440, and 1920 pixels.
They do not send emails or create users in the live Supabase project.

## Operator applications and administration

Customer sign-up is intentionally a preview. Operators submit business details,
private documents, vehicles and photos at `/register/operator`, confirm email,
and sign in at `/operator`. Pending operators see review status and can edit and
resubmit their application. `/admin` is the administrator workspace; an operator
visiting its root is redirected to their own portal. Each query/action retains
server-side role checks and RLS ownership restrictions.
`/admin/users` lists all users with email search and role filters. Only the
super admin can invite administrators. Agent access is reserved and disabled.

Use all three migrations in order as documented in [the hosted setup guide](../supabase/README.md).
All are applied on the hosted project; do not rerun the initial migration.
Run bootstrap-admin.sql after setup for admin@vanbook.ph. The app uses one
public.users profile/role table, plus prefixed operator tables. Workspaces stack
on mobile and use a sidebar/grid on desktop. No Docker service is required.

Operator registration and admin invitations require a server-only
SUPABASE_SECRET_KEY in the environment, in addition to the server-side
Supabase connection variables and SITE_URL. The hosted schema was applied on 2026-11-27;
live email delivery remains to be checked with a permitted inbox/SMTP setup. See the hosted guide for exact file order, templates, and checks.

### Landing and operator portal

The landing page contains a trip-form preview, route inspiration, how-it-works,
group-travel callouts, and operator registration/login links. Get quotes shows a
coming-soon message without writing a booking. Customer registration collects
mock profile fields but its Create account button is disabled. Log in/Sign up
tabs share the existing animated-van auth layout.

Operator registration saves all business and fleet data before showing
`/register/operator/success`. Confirmed pending operators land on application
status with a review timeline and per-document Pending/Approved/Resubmit labels.
The edit form retains unchanged files and uploads replacements. Version checks
prevent concurrent edits/reviews from overwriting changes; admin verification
shows the latest operator update, resubmission timestamp, and audit events.

Approved operators land on Requests. Requests, Quoted, Booked, Calendar, and
Earnings have empty states. My vans supports adding/editing vehicles, private
photo uploads, and availability after operator/vehicle approval. Editing a van
returns it to review and turns off availability. Documents shows review results;
driver profiles remain a later phase. Admins review individual documents and
registered vehicle details/photos inside operator verification.

Pages, tabs, buttons, drawers, success steps, and the van have short motion
effects. Reduced-motion preferences disable nonessential movement. The server
secret is configured locally in ignored `.env.local`; Vercel also requires
`SUPABASE_SECRET_KEY` for operator registration, file replacement, and van photos.

### Admin prototype and loading experience

The admin area follows the supplied prototype: a dark sidebar, amber active
navigation, compact metric cards, and a split operator queue/review panel. The
sidebar uses the requested 220px flex basis, 200–260px bounds, #12212B background,
and 42px active items. Mobile navigation collapses behind an accessible menu.

- /admin: live operator verification with search by business/registration number,
  status filters, pagination, private document links, notes, and review decisions.
- /admin/operators/[id]: opens that operator in the same verification workspace.
- /admin/bookings, /admin/fees, /admin/complaints, /admin/reports: styled interface
  shells with empty states; booking, fee, complaint and reporting workflows are
  not integrated yet. Date-range tabs retain their selection in the URL.
- /admin/users and /admin/documents: existing role and checklist tools in the
  secondary management navigation.

The Documents page is a searchable table with Required/Optional and
Active/Inactive badges. Click a row or its Edit button to open a right-side
drawer; Escape/Cancel closes it and returns focus to the row. The drawer fills
the screen on mobile. Administrators can edit the name, upload instructions,
submission rule, visibility, and display order. Active rules, instructions and
ordering drive the registration form; the server and database enforce required
uploads. Existing documents are retained when requirements are deactivated.
Apply `20261127000200_document_checklist.sql` before deploying this update; see
`supabase/README.md` for the additive migration and reference checklist.

Documents has independent submission-rule and visibility filters, alphabetical
or configured-order sorting, and a clear-filters action. Users is a responsive
directory table with role badges, email verification and joined dates. Search
matches name or email; role, verification and sorting controls work together.
User filters persist in the URL and across pagination; applying new filters
starts at page one. Only the super admin sees the administrator invitation
button, which opens a side drawer and uses the existing protected server action.

Summary counts come from the database. Document expiry is not tracked yet, so
its metric is unavailable; uploaded files are labeled Uploaded, not Valid. Vehicle
counts are omitted if the existing 200-row management RPC may have been truncated.
No production test data or new database migrations were added for this redesign.

The sign-in illustration animates the van, road markings, and sun. After a
successful admin/operator login, the scene moves from its position on the form
to the center of the viewport in 450ms, then navigation begins. It stays visible
until the authenticated workspace is ready. The admin sidebar lives in a shared
layout and remains visible when switching tabs. Only the content area shows
responsive card/table skeletons with a shimmer effect. Section errors also stay
inside the content area with a retry button. Reduced-motion settings disable
the movement and skip the centering transition. No GIF or extra image download
is needed. Stylesheets are imported directly in the root layout so local dev
tracks each stylesheet, including admin and loading styles.
The browser fixture alone supplies sample operators and controlled delays for QA.

Password recovery is available at `/forgot-password` and `/reset-password` using
the existing email-link callback. The reset-password template is provided under
`supabase/templates`. Private workspace and reset responses are not shared-cached.

Database tests use a test-runner-only in-memory PostgreSQL engine. Browser tests
use fixture Auth/API endpoints backed by the migration, never the hosted project.

## Checks

```powershell
npm run lint
npm run typecheck
npm run build
npm run check:supabase
npm test
npm run test:e2e
```

`check:supabase` makes a read-only request to Auth settings with a 15-second
timeout. It does not print the key or inspect application records.

Before the first browser test run, install Chromium with
`npx playwright install chromium`. Tests start isolated servers on ports 3241
and 3242 and use `.next-e2e`/`tsconfig.e2e.json` to preserve the normal dev build.
Test results and traces are ignored by Git.

Setup reference: [Supabase SSR client guide](https://supabase.com/docs/guides/auth/server-side/creating-a-client).
Also see [Redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls),
[Email templates](https://supabase.com/docs/guides/auth/auth-email-templates), and
[SMTP restrictions](https://supabase.com/docs/guides/auth/auth-smtp).
