-- HANIF ALVES — LINK DO GRUPO DE WHATSAPP DE CADA CURSO
-- O aluno passa a receber o link do grupo do curso logo depois do pagamento confirmado (página de obrigado e e-mail) e a vê-lo
-- na área de membros. O link NÃO fica na tabela products, porque ela é pública (o site inteiro lê): qualquer pessoa conseguiria o
-- link sem comprar. Ele fica numa tabela própria, com estas regras:
--   - administrador: lê, cria, altera e apaga;
--   - aluno: lê só o link dos cursos em que tem acesso ativo;
--   - visitante: não lê nada.
-- A página de obrigado e o e-mail leem pelo servidor (chave de serviço), e só quando o pedido está pago.
-- Só cria uma tabela nova; não altera nem apaga dado existente. Execute no SQL Editor do Supabase.

create table if not exists public.product_group_links (
  product_id uuid primary key references public.products(id) on delete cascade,
  whatsapp_group_url text not null
    check (whatsapp_group_url ~* '^https://chat\.whatsapp\.com/[A-Za-z0-9_-]{10,}(\?[^[:space:]]*)?$'),
  updated_at timestamptz not null default now()
);

alter table public.product_group_links enable row level security;

drop policy if exists "admin manages group links" on public.product_group_links;
create policy "admin manages group links"
on public.product_group_links for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "students read own group links" on public.product_group_links;
create policy "students read own group links"
on public.product_group_links for select
to authenticated
using (
  exists (
    select 1 from public.user_products up
    where up.product_id = product_group_links.product_id
      and up.user_id = auth.uid()
      and up.access_status = 'active'
  )
);

revoke all on public.product_group_links from anon;
grant select, insert, update, delete on public.product_group_links to authenticated;
