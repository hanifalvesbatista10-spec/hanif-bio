-- AULAS AO VIVO (sinalização na área do aluno)
-- Marca uma aula como "ao vivo agora" (você liga e desliga no painel de Aulas). Pensado para lives do
-- YouTube: o mesmo link do YouTube funciona antes, durante e depois da transmissão, então não muda nada no
-- player, só um aviso na área do aluno enquanto ela dura. Se você esquecer de desligar, o aviso some sozinho
-- depois de 6 horas (as aulas continuam acessíveis normalmente, só o aviso "ao vivo" que expira).
-- Execute no Supabase: SQL Editor > New query > cole tudo > Run.
-- Migration incremental e não destrutiva (exige a 22_aulas_compartilhadas.sql e a
-- 30_garantia_7_dias.sql já executadas, por causa da função access_hold_active).

alter table public.product_lessons add column if not exists is_live boolean not null default false;
alter table public.product_lessons add column if not exists live_started_at timestamptz;

-- Lives que este aluno pode ver agora, em qualquer curso com acesso ativo (respeita a garantia de 7 dias,
-- se a SQL 30 já tiver rodado: aula trancada não aparece como "ao vivo" para quem ainda não pode assisti-la).
create or replace function public.my_live_lessons()
returns table (lesson_id uuid, title text, product_id uuid, product_title text, live_started_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select distinct on (l.id) l.id, l.title, p.id, p.title, l.live_started_at
  from public.product_lessons l
  join public.product_lesson_links pl on pl.lesson_id = l.id
  join public.products p on p.id = pl.product_id
  join public.user_products up on up.product_id = p.id
  where l.is_live
    and l.live_started_at is not null
    and l.live_started_at > now() - interval '6 hours'
    and l.status = 'published'
    and up.user_id = auth.uid()
    and up.access_status = 'active'
    and (
      pl.available_in_hold
      or not public.access_hold_active(up.granted_at, up.hold_released_at, coalesce(p.access_hold_enabled, false))
    )
  order by l.id, l.live_started_at desc
$$;

revoke all on function public.my_live_lessons() from public, anon;
grant execute on function public.my_live_lessons() to authenticated;
