# VANBOOK hosted Supabase setup

Use the existing project **pphyhsdpdsycfaleflyv** in Supabase's web SQL Editor.
Vercel hosts the application. Docker is not required. The hosted schema was
applied on 2026-11-27 and verified. The one-time clearing script has been removed;
the complete schema is now the initial migration. **Do not rerun this migration
on the existing project:** its tables already exist.

## Initial migration

For a new project without VANBOOK application tables:

1. Run the entire `migrations/20261127000100_create_schema.sql` once in SQL Editor.
   It creates all six tables, policies, triggers, views, and functions in one
   transaction. Existing Auth accounts receive public user profiles. It does
   not clear existing tables or restore admin permissions automatically.
2. Run `20261127000200_document_checklist.sql`, followed by
   `20261127000300_operator_portal.sql`, then
   `20261128000100_account_profile.sql`. Create/verify **admin@vanbook.ph** under Authentication > Users if needed, then
   run `bootstrap-admin.sql` to explicitly grant that account super_admin.
3. Run `verify-onboarding.sql`. After bootstrap, the first six checks should be
   true and the last five privilege checks false. The second result lists users.
4. Sign in through `/sign-in`. Management is at `/admin`; all accounts and roles
   are listed under `/admin/users`.

For the existing hosted project, the initial schema is already applied. Only complete
bootstrap if the super-admin account has not yet been created. Migration history
is aligned with the renamed initial migration; no application data is reset or
schema SQL rerun when changing that history. Future changes should use new
migration files rather than editing or rerunning this initial migration.

## Document checklist update

`migrations/20261127000200_document_checklist.sql` extends the existing checklist
with `description` (upload instructions, up to 1,000 characters) and `sort_order`
(0–9,999). It adds the six documents from the supplied product reference: CPC,
vehicle OR/CR, insurance, professional driver's license, business permit, and
optional BIR Form 2303. Existing codes/settings win if already present; the
original supporting-document category and all submitted files are preserved.

All three migrations are applied and recorded on the hosted project as of
2026-11-27. The checklist migration safely tolerates the columns/rows already
existing, retaining their settings. Never rerun the initial schema file. Public schema
types have been regenerated. Administrators manage the table at `/admin/documents`:
click a row to edit it in a side drawer, or add a requirement. Required/Optional
controls submission validation; Active/Inactive controls registration visibility.
Both registration and verification order requirements by `sort_order`, then label.

The requirements table defines the checklist. `operator_documents.category`
contains the requirement code, linking each uploaded file to a checklist item.
File name/path/MIME type/size live on the submitted document. Upload status,
review results, and future issue/expiry dates belong to submissions, rather than
the global requirement definition. The checklist update adds no per-file review
or expiry workflow.

If a transaction fails, run `ROLLBACK;` when needed, correct the error, and retry
that full file on the intended new database. Never change ownership of auth.users.

## Account contact details

`migrations/20261128000100_account_profile.sql` adds the owner-checked
`update_operator_contact_profile` RPC. Verified operators can update their name,
mobile number, and contact email from My account, including after approval.
The RPC requires the current application version, preserves approval/document
reviews, updates the operator timestamp, and records an audit event. It accepts
no user/application ID and grants no direct browser updates to contact fields or
roles. Contact email is separate from the Auth sign-in email.

Contact-name changes also update `public.users.full_name`. Auth profile sync
preserves the operator's current contact name rather than restoring old metadata.
Administrators see read-only account details in the same modal.
This migration was applied to the hosted project on 2026-11-28.

## Final tables

| Table | Purpose |
| --- | --- |
| users | Every account's Auth ID, email, full name, protected role, email confirmation and timestamps |
| operator_applications | Business/contact details, coverage, approval status and review version |
| operator_documents | Private document metadata for each business application |
| operator_document_requirements | Admin-managed checklist of required/optional document categories |
| operator_application_events | Immutable submission/review audit history |
| operator_vehicles | Vehicle details, owner, publication status and version |
| operator_vehicle_photos | Private front, side, interior and back photo metadata for each van |

The public catalog view is `vehicle_listings`. Private tables store admin
invitations and registration attempt limits. `auth.users` manages credentials;
there is no second admin-account table. `users.role` is the sole role source:
customer, operator, admin, super_admin, agent. Agent permissions are reserved and
not enabled. Password hashes and auth tokens are never copied into public.users.

## Permissions and workflows

- The customer sign-up UI is a non-submitting preview. Existing customers can
  sign in after email confirmation and read only their own account.
- Operators submit business details, documents, vehicles, and private photos at
  registration. Email confirmation is required before signing in. Pending
  operators can read their own application, review notes and files, prepare vans,
  and resubmit corrections through version-checked server actions/database RPCs.
- Business approval and separate vehicle approval are required before a van can
  become available for requests. Operators cannot self-approve either review.
- Administrators approve each required document before approving the business.
  Requesting a document replacement returns the application to changes requested.
  Resubmission replaces only selected file metadata and resets its review to
  pending; existing file objects are retained. The application records
  operator_updated_at/resubmitted_at and an immutable event visible to admins.
- Admins review/edit all businesses and manage listings; they can view all user
  profiles. Only the super admin can invite a new admin through the dashboard.
- Public signup metadata cannot grant admin, super_admin, or agent permissions.
  User edits to Auth metadata never change an existing protected role.
- Viewing documents requires an authorized session and uses a short-lived signed
  URL. Browser accounts cannot write document metadata or upload/remove files.
- Public catalog fields exclude plate numbers and owner IDs. Management details
  require the protected get_managed_vehicles RPC. Listing edits by operators
  return the vehicle to draft for another review.

The initial supporting-document category remains optional. The second migration
uses the client's reference checklist; all rules remain editable in
`/admin/documents`. Operator registration allows up to 12 PDF/PNG/JPEG documents,
one to five vans, and four photo views per van (front required). All documents
and photos together must be at most 3 MB to fit Vercel request limits. The bucket's independent
server limit is 10 MB per object. Booking/payment tables and rules are not included.

## App environment and email

Set `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, and
`SITE_URL` in Vercel. Operator registration and admin invitations also need
**SUPABASE_SECRET_KEY**, a server-only secret. All Supabase connection settings
are server-side and have no NEXT_PUBLIC_ prefix; use visibility secret for keys
in Vercel and visibility config for SITE_URL. Do not share secret values in chat.
Standard customer sign-in uses the publishable key plus RLS through server
actions. Keep Auth email confirmation enabled.

Use the confirmation and password-reset templates in `templates`; allow the app
callback URLs in Authentication URL Configuration. For staff invitations, install
`templates/invite-user.html` under Invite user: it uses the one-time token hash
and `/auth/confirm` so the recipient can open the invitation in another browser
and set a password. Use the real HTTPS app origin for SITE_URL and Supabase's
site URL. Verify SMTP delivery and links with real inboxes after configuration.

## Local validation

Run `npm test` in `web`. Tests execute the actual SQL in an in-memory PostgreSQL
fixture, including fresh schema creation, Auth profile backfill, accidental replay
rollback, restricted Auth-table ownership, roles, RLS, registration requirements,
private files, and listing access.

Fixture validation does not verify hosted SMTP or Storage service behavior.
Full Supabase TypeScript types were generated from the hosted public schema and
saved in `web/lib/supabase/database.types.ts`. View/form contracts remain under
`web/lib/operators`.
