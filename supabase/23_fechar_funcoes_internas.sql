-- FECHA AS FUNÇÕES INTERNAS DAS PROVAS
-- O Supabase dá permissão de execução às funções novas para "anon" e "authenticated" por padrão,
-- e o "revoke ... from public" do SQL 21 não tira isso. Aqui a permissão é tirada de verdade:
--  * funções internas (correção e nota): ninguém chama pelo navegador, só as funções do próprio banco;
--  * funções de aluno e do instrutor: só quem está logado (elas ainda conferem quem é a pessoa).
-- Execute no Supabase: SQL Editor > New query > cole tudo > Run. Pode rodar mais de uma vez.

-- internas
revoke all on function public._form_recalc(uuid) from public, anon, authenticated;
revoke all on function public._form_apply_answers(uuid, jsonb) from public, anon, authenticated;
revoke all on function public._form_submit_summary(uuid) from public, anon, authenticated;
revoke all on function public._form_grade_one(text, numeric, jsonb, numeric, boolean, boolean, jsonb) from public, anon, authenticated;
revoke all on function public._form_is_released(public.form_submissions, public.forms) from public, anon, authenticated;

-- só para quem está logado
revoke all on function public.form_start_attempt(uuid) from public, anon;
revoke all on function public.form_submit(uuid, uuid, jsonb) from public, anon;
revoke all on function public.form_get_my_result(uuid) from public, anon;
revoke all on function public.form_list_for_student() from public, anon;
revoke all on function public.form_grade_answer(uuid, numeric, text) from public, anon;
revoke all on function public.form_regrade(uuid) from public, anon;
revoke all on function public.form_release_results(uuid, uuid[]) from public, anon;
revoke all on function public.form_hide_results(uuid, uuid[]) from public, anon;
revoke all on function public.form_duplicate(uuid) from public, anon;

grant execute on function public.form_start_attempt(uuid) to authenticated;
grant execute on function public.form_submit(uuid, uuid, jsonb) to authenticated;
grant execute on function public.form_get_my_result(uuid) to authenticated;
grant execute on function public.form_list_for_student() to authenticated;
grant execute on function public.form_grade_answer(uuid, numeric, text) to authenticated;
grant execute on function public.form_regrade(uuid) to authenticated;
grant execute on function public.form_release_results(uuid, uuid[]) to authenticated;
grant execute on function public.form_hide_results(uuid, uuid[]) to authenticated;
grant execute on function public.form_duplicate(uuid) to authenticated;

-- o formulário público continua aberto a visitantes; a leitura das perguntas (política) também
grant execute on function public.submit_public_form(uuid, jsonb, jsonb) to anon, authenticated;
grant execute on function public.form_blocks_readable(uuid) to anon, authenticated;
