-- DADOS DO ALUNO PARA CERTIFICADO E CARTEIRINHA + FOTO DE PERFIL + PROTEÇÃO DO PERFIL
-- Cria: CPF, RG e tipo sanguíneo no perfil (visíveis só ao próprio aluno e ao admin, pelas regras
-- que a tabela profiles já tem), o bucket das fotos dos alunos e uma trava que impede o aluno de
-- alterar o próprio "role" (admin/aluno) e o status da conta.
-- Execute no Supabase: SQL Editor > New query > cole tudo > Run.
-- Migration incremental e não destrutiva.

-- 1) Novas colunas do perfil
alter table public.profiles add column if not exists cpf text;
alter table public.profiles add column if not exists rg text;
alter table public.profiles add column if not exists blood_type text;

alter table public.profiles drop constraint if exists profiles_blood_type_check;
alter table public.profiles
  add constraint profiles_blood_type_check
  check (blood_type is null or blood_type in ('', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'));

-- 2) Trava: só o admin (ou o SQL Editor, onde auth.uid() é nulo) muda role e account_status.
-- Sem isso, a política de "editar o próprio perfil" deixaria um aluno se tornar admin.
create or replace function public.protect_profile_privileged_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    new.role := old.role;
    new.account_status := old.account_status;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_protect_privileged on public.profiles;
create trigger profiles_protect_privileged
before update on public.profiles
for each row execute function public.protect_profile_privileged_columns();

-- 3) Bucket das fotos dos alunos (JPG/PNG/WebP até 2 MB). Cada aluno só escreve na própria pasta
-- (student-photos/<id do aluno>/arquivo.jpg); o admin escreve em qualquer uma.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('student-photos', 'student-photos', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Aluno envia a propria foto" on storage.objects;
create policy "Aluno envia a propria foto"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'student-photos'
  and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin())
);

drop policy if exists "Aluno atualiza a propria foto" on storage.objects;
create policy "Aluno atualiza a propria foto"
on storage.objects for update to authenticated
using (
  bucket_id = 'student-photos'
  and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin())
)
with check (
  bucket_id = 'student-photos'
  and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin())
);

drop policy if exists "Aluno exclui a propria foto" on storage.objects;
create policy "Aluno exclui a propria foto"
on storage.objects for delete to authenticated
using (
  bucket_id = 'student-photos'
  and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin())
);
