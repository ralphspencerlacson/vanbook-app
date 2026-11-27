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

- `/` and `/sign-in`: email/password sign-in, with confirmation resend.
- `/register`: registration with matching passwords and email confirmation.
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

1. Run `npm run dev`, open `/register`, and create an account with your own inbox.
2. Open the confirmation email link in the browser where you registered.
3. Confirm `/account` shows your verified email; reload and reopen the tab.
4. Sign out, then sign in with the email and password you registered.
5. Try a wrong password, an expired/reused confirmation link, and confirmation
   resend to check recovery. Do not share passwords, links, or session cookies.

Automated tests use a local Auth server and fixture credentials. They cover
registration, link confirmation, unconfirmed-account rejection, cookie/session
restoration, expired-token refresh, sign-out, invalid passwords, resend, offline
recovery, and responsive layouts at 320, 375, 768, 1024, 1440, and 1920 pixels.
They do not send emails or create users in the live Supabase project.

## Operator applications and administration

Customers register at `/register`. Operators submit business details and private
documents at `/register/operator`, then wait for email verification and admin
approval before signing in. The shared `/admin` area verifies roles server-side:
operators see their own business, while admins review all applications.
`/admin/users` lists all users with email search and role filters. Only the
super admin can invite administrators. Agent access is reserved and disabled.

Use the single initial migration documented in [the hosted setup guide](../supabase/README.md):
00100 creates the complete schema on a new database without clearing data.
The existing hosted project already has this schema; do not rerun it.
Run bootstrap-admin.sql after setup for admin@vanbook.ph. The app uses one
public.users profile/role table, plus prefixed operator tables. Workspaces stack
on mobile and use a sidebar/grid on desktop. No Docker service is required.

Operator registration and admin invitations require a server-only
SUPABASE_SECRET_KEY in the environment, in addition to the server-side
Supabase connection variables and SITE_URL. The hosted schema was applied on 2026-11-27;
email/SMTP and the first super-admin account remain to be configured. See the hosted guide for exact file order, templates, and checks.

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

Summary counts come from the database. Document expiry is not tracked yet, so
its metric is unavailable; uploaded files are labeled Uploaded, not Valid. Vehicle
counts are omitted if the existing 200-row management RPC may have been truncated.
No production test data or new database migrations were added for this redesign.

Admin route transitions and workspace Suspense boundaries show an SVG/CSS van
loader: the van follows the rolling road, the road markings scroll, and the sun
moves. The animation is responsive and becomes static with reduced-motion enabled.
No GIF, additional image download, or artificial loading delay is used in the app.
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
