// O PostgREST entrega no máximo 1000 linhas por chamada: pagina até acabar. `build` devolve uma consulta NOVA a cada chamada,
// já com uma ordenação estável (ex.: .order("id")), senão as páginas podem repetir ou pular linhas.
export async function fetchAllRows(build) {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await build().range(from, from + 999);
    if (error) return { error };
    rows.push(...(data || []));
    if ((data || []).length < 1000) break;
  }
  return { data: rows };
}
