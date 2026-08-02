-- FEEDBACKS PÚBLICOS NA PÁGINA INICIAL
-- Supabase > SQL Editor > New query > cole este arquivo > Run

alter table public.student_feedbacks enable row level security;

drop policy if exists "public published feedbacks" on public.student_feedbacks;
drop policy if exists "Visitantes podem ver feedbacks publicados" on public.student_feedbacks;

create policy "Visitantes podem ver feedbacks publicados"
on public.student_feedbacks
for select
to anon, authenticated
using (
  status = 'published'
  and publication_authorized = true
);

drop policy if exists "admin feedbacks full" on public.student_feedbacks;
create policy "admin feedbacks full"
on public.student_feedbacks
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "student read own feedback" on public.student_feedbacks;
create policy "student read own feedback"
on public.student_feedbacks
for select
to authenticated
using (student_id = auth.uid());

do $$
begin
  alter publication supabase_realtime add table public.student_feedbacks;
exception
  when duplicate_object then null;
end $$;
