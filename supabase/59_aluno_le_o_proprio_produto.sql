-- HANIF ALVES — ALUNO COM ACESSO LÊ O PRÓPRIO PRODUTO (CORREÇÃO URGENTE)
-- Problema: a regra de leitura de products só liberava produtos com status "ativo" (ou administrador). Um produto "não listado"
-- (à venda só por link, como a Mentoria — Suporte Avançado de Vida) ficava invisível até para o aluno que tem acesso ativo:
-- o curso sumia de "Meus cursos" e as aulas também (a regra de leitura das aulas lê o produto para checar a garantia de 7 dias).
-- No painel o acesso aparecia normal, mas o aluno não via nada.
-- Correção: quem tem acesso ativo a um produto passa a poder ler esse produto, qualquer que seja o status dele (ativo, não listado,
-- rascunho...). Não muda quem vê a loja pública: visitante e alunos sem acesso continuam vendo só os produtos ativos.
-- Só cria uma regra de leitura; não altera nem apaga dado. Execute no SQL Editor do Supabase.

drop policy if exists "students read own products" on public.products;
create policy "students read own products"
on public.products for select
to authenticated
using (
  exists (
    select 1 from public.user_products up
    where up.product_id = products.id
      and up.user_id = auth.uid()
      and up.access_status = 'active'
  )
);
