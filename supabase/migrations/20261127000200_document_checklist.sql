begin;

-- Extend the existing checklist without replacing requirements or uploaded files.
alter table public.operator_document_requirements
  add column if not exists description text not null default ''
    check (length(description) <= 1000),
  add column if not exists sort_order integer not null default 0
    check (sort_order between 0 and 9999);

-- Starting checklist supplied in the product reference. Existing definitions win.
insert into public.operator_document_requirements
  (code, label, description, required, active, sort_order)
values
  ('ltfrb_franchise', 'LTFRB franchise (CPC)', '', true, true, 10),
  ('vehicle_or_cr', 'Vehicle OR/CR', '', true, true, 20),
  ('insurance', 'Insurance (CTPL + passenger)', '', true, true, 30),
  ('driver_license', 'Driver''s professional license', '', true, true, 40),
  ('business_permit', 'DTI/SEC + mayor''s permit', '', true, true, 50),
  ('bir_form_2303', 'BIR Form 2303', '', false, true, 60)
on conflict (code) do nothing;

commit;
