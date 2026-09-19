import { useMemo } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../services/supabase";
import { getPages } from "../../services/certificates";

export default function TemplatesPanel({ templates, certificates, onChange, notify, onIssueWith }) {
  const counts = useMemo(() => {
    const map = {};
    certificates.forEach((c) => {
      map[c.template_id] = (map[c.template_id] || 0) + 1;
    });
    return map;
  }, [certificates]);

  const duplicate = async (template) => {
    const { id, created_at, updated_at, background_path, name, ...rest } = template;
    // A cópia reaproveita a mesma arte (sem duplicar o arquivo); por isso não guarda o caminho de exclusão.
    const { data, error } = await supabase.from("certificate_templates").insert({ ...rest, name: `${name} (cópia)`, background_path: null }).select("*").single();
    if (error) notify("error", `Erro ao duplicar: ${error.message}`);
    else {
      onChange([data, ...templates]);
      notify("success", "Cópia criada. Abra para ajustar.");
    }
  };

  const remove = async (template) => {
    if ((counts[template.id] || 0) > 0) {
      notify("error", `Este modelo já emitiu ${counts[template.id]} certificado(s) e não pode ser excluído. Revogue/exclua os certificados antes, ou apenas pare de usá-lo.`);
      return;
    }
    if (!window.confirm(`Excluir o modelo “${template.name}”?`)) return;
    const { error } = await supabase.from("certificate_templates").delete().eq("id", template.id);
    if (error) return notify("error", `Erro ao excluir: ${error.message}`);
    // Remove o arquivo da arte só se nenhum outro modelo o utiliza.
    const shared = templates.some((item) => item.id !== template.id && item.background_url === template.background_url);
    if (template.background_path && !shared) await supabase.storage.from("certificate-backgrounds").remove([template.background_path]);
    onChange(templates.filter((item) => item.id !== template.id));
    notify("success", "Modelo excluído.");
  };

  if (templates.length === 0) {
    return (
      <div className="admin-empty">
        Nenhum modelo ainda. Um modelo é a sua arte pronta de certificado com os textos posicionados.
        <br />
        <Link className="admin-button primary" style={{ marginTop: 14 }} to="/admin/certificados/modelo/novo">Criar modelo</Link>
      </div>
    );
  }

  return (
    <ul className="cert-template-grid">
      {templates.map((template) => (
        <li key={template.id} className="cert-template-card">
          <Link to={`/admin/certificados/modelo/${template.id}`} className="cert-template-thumb" aria-label={`Editar ${template.name}`}>
            <img src={template.background_url} alt="" loading="lazy" style={{ aspectRatio: `${template.width} / ${template.height}` }} />
          </Link>
          <div className="cert-template-body">
            <h3>{template.name}</h3>
            <small>{getPages(template).length} página(s) · {getPages(template).reduce((sum, page) => sum + page.blocks.length, 0)} item(ns) · {counts[template.id] || 0} emitido(s)</small>
            <div className="cert-row-actions">
              <button type="button" className="adm-action is-primary" onClick={() => onIssueWith(template.id)}>Emitir</button>
              <Link className="adm-action" to={`/admin/certificados/modelo/${template.id}`}>Editar</Link>
              <button type="button" className="adm-action" onClick={() => duplicate(template)}>Duplicar</button>
              <button type="button" className="adm-action is-danger" onClick={() => remove(template)}>Excluir</button>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
