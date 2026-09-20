import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../services/supabase";
import { uploadCertificateImage } from "../../services/certificateStorage";
import {
  BATCH_LIMIT,
  buildMergedPdf,
  buildZip,
  certificateFileName,
  downloadBlob,
  formatDatePt,
  formatValue,
  getPages,
  humanize,
  parsePastedTable,
  renderPdf,
  sampleValues,
  slug,
  templateVariables,
  usesPhoto,
  validEmail,
  verifyUrl,
} from "../../services/certificates";
import { BLOOD_TYPES, isValidCpf } from "../../services/studentData";
import CertificateCanvas from "./CertificateCanvas";

async function copy(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

// Valores iniciais: padrão do modelo; "data" ganha a data de hoje se não houver padrão.
function initialValues(template, variables) {
  const values = {};
  variables.forEach((key) => {
    values[key] = template.defaults?.[key] || (key === "data" ? formatDatePt() : "");
  });
  return values;
}

// Campos que pertencem à pessoa (mudam de aluno para aluno). Ao emitir pela lista de alunos, eles são
// reaproveitados do último certificado do aluno; os demais (curso, data, carga horária...) valem para a turma.
const PERSONAL_KEYS = ["cpf", "rg", "tipo_sanguineo", "matricula", "nascimento", "telefone"];
const STUDENT_COLUMNS = "id,full_name,email,avatar_url,phone,cpf,rg,blood_type";
const STUDENT_COLUMNS_BASIC = "id,full_name,email,avatar_url,phone";
const normalizeText = (text) => String(text || "").trim().toLowerCase();

export default function IssuePanel({ templates, initialTemplateId, onIssued }) {
  const [templateId, setTemplateId] = useState(initialTemplateId || templates[0]?.id || "");
  const [mode, setMode] = useState("single"); // single | bulk | students
  const template = templates.find((item) => item.id === templateId) || null;
  const variables = useMemo(() => (template ? templateVariables(template) : []), [template]);
  const pages = useMemo(() => (template ? getPages(template) : []), [template]);
  const hasPhoto = useMemo(() => (template ? usesPhoto(template) : false), [template]);

  const [values, setValues] = useState({});
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [batchLabel, setBatchLabel] = useState("");
  const [paste, setPaste] = useState("");
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState("");
  const [includedPages, setIncludedPages] = useState([]);
  const [previewPage, setPreviewPage] = useState(0);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(null); // { label, done, total }
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("success");
  const [issued, setIssued] = useState(null); // último resultado: { list, kind }
  const fileRef = useRef(null);

  // ---- emissão a partir da lista de alunos do curso
  const [courses, setCourses] = useState([]);
  const [courseId, setCourseId] = useState("");
  const [roster, setRoster] = useState([]); // { uid, nome, email, foto, personal, selected, has }
  const [rosterState, setRosterState] = useState("idle"); // idle | loading | error
  const [rosterError, setRosterError] = useState("");
  const [rosterNonce, setRosterNonce] = useState(0);
  const [useAvatar, setUseAvatar] = useState(true);
  const [saveToProfile, setSaveToProfile] = useState(true);
  const [source, setSource] = useState("pick"); // product = alunos com acesso a um curso da plataforma | pick = escolher alunos cadastrados
  const [search, setSearch] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const valuesRef = useRef({});
  valuesRef.current = values;

  useEffect(() => {
    // trocar a origem dos alunos começa uma lista nova
    setRoster([]);
    setSearch("");
    setResults([]);
  }, [source]);
  const course = courses.find((item) => item.id === courseId) || null;
  const personalKeys = useMemo(() => variables.filter((key) => PERSONAL_KEYS.includes(key)), [variables]);

  useEffect(() => {
    if (mode !== "students" || courses.length > 0) return;
    supabase.from("products").select("id,title").order("title", { ascending: true }).then(({ data }) => setCourses(data || []));
  }, [mode]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (template) {
      setValues(initialValues(template, variables));
      setIncludedPages(getPages(template).map((page) => page.id));
    }
    setPreviewPage(0);
    setIssued(null);
    setPhotoFile(null);
    setPhotoPreview("");
  }, [templateId]); // eslint-disable-line react-hooks/exhaustive-deps

  const notify = (type, text) => {
    setMessageType(type);
    setMessage(text);
  };

  // O curso escolhido preenche o campo {curso} do modelo (dá para editar depois).
  useEffect(() => {
    if (mode !== "students" || source !== "product" || !course || !variables.includes("curso")) return;
    setValues((current) => ({ ...current, curso: course.title }));
  }, [mode, courseId, templateId, courses]); // eslint-disable-line react-hooks/exhaustive-deps

  // Monta as linhas da tabela: dados do perfil (que o aluno preencheu) + o que consta nos certificados anteriores dele.
  const buildEntries = async (students) => {
    let certs = [];
    const ids = students.map((student) => student.id);
    const emails = students.map((student) => String(student.email || "").toLowerCase()).filter(Boolean);
    if (ids.length > 0) {
      const columns = "id,template_id,user_id,recipient_email,data,issued_at,status";
      const [byUser, byEmail] = await Promise.all([
        supabase.from("certificates").select(columns).in("user_id", ids).limit(3000),
        emails.length ? supabase.from("certificates").select(columns).in("recipient_email", emails).limit(3000) : Promise.resolve({ data: [] }),
      ]);
      const seen = new Set();
      certs = [...(byUser.data || []), ...(byEmail.data || [])]
        .filter((cert) => (seen.has(cert.id) ? false : seen.add(cert.id)))
        .sort((a, b) => String(b.issued_at).localeCompare(String(a.issued_at)));
    }
    return students.map((student) => {
      const email = String(student.email || "").toLowerCase();
      const own = certs.filter((cert) => cert.user_id === student.id || (email && cert.recipient_email === email));
      const last = own.find((cert) => cert.status !== "revoked")?.data || {};
      const mine = own.map((cert) => ({ template_id: cert.template_id, status: cert.status, curso: cert.data?.curso || "" }));
      // Prioridade: o que o próprio aluno preencheu no perfil > o que consta no último certificado.
      const fromProfile = { cpf: student.cpf, rg: student.rg, tipo_sanguineo: student.blood_type, telefone: student.phone };
      const personal = {};
      const saved = {}; // o que já está no perfil (para saber o que vale gravar depois)
      PERSONAL_KEYS.forEach((key) => {
        saved[key] = String(fromProfile[key] || "").trim();
        personal[key] = saved[key] || last[key] || "";
      });
      const already = mine.some(
        (cert) =>
          cert.template_id === template?.id &&
          cert.status === "valid" &&
          (!variables.includes("curso") || normalizeText(cert.curso) === normalizeText(valuesRef.current.curso))
      );
      return {
        uid: student.id,
        nome: student.full_name || student.email || "",
        email: student.email || "",
        foto: student.avatar_url || last.foto || "",
        personal,
        saved,
        mine,
        hasProfileData: "cpf" in student,
        selected: !already, // quem já tem este certificado (do mesmo curso) começa desmarcado, para não duplicar
      };
    });
  };

  // Alunos com acesso ativo a um produto/curso da plataforma.
  useEffect(() => {
    if (mode !== "students" || source !== "product" || !courseId || !template) {
      if (source === "product") setRoster([]);
      return undefined;
    }
    let active = true;
    (async () => {
      setRosterState("loading");
      setRosterError("");
      // cpf/rg/blood_type existem depois da migration 18; sem ela, cai para o cadastro básico.
      const withStudentData = `user_id,profile:profiles!user_id(${STUDENT_COLUMNS})`;
      const basic = `user_id,profile:profiles!user_id(${STUDENT_COLUMNS_BASIC})`;
      let { data: grants, error } = await supabase.from("user_products").select(withStudentData).eq("product_id", courseId).eq("access_status", "active");
      if (error && /cpf|rg|blood_type/.test(error.message || "")) {
        ({ data: grants, error } = await supabase.from("user_products").select(basic).eq("product_id", courseId).eq("access_status", "active"));
      }
      if (!active) return;
      if (error) {
        setRosterState("error");
        setRosterError(error.message);
        return;
      }
      const students = (grants || [])
        .map((grant) => grant.profile)
        .filter(Boolean)
        .sort((a, b) => String(a.full_name || a.email).localeCompare(String(b.full_name || b.email), "pt-BR"));

      const entries = await buildEntries(students);
      if (!active) return;
      setRoster(entries);
      setRosterState("idle");
    })();
    return () => {
      active = false;
    };
  }, [mode, source, courseId, templateId, rosterNonce]); // eslint-disable-line react-hooks/exhaustive-deps

  // Busca de qualquer aluno cadastrado (nome ou e-mail), para cursos que não têm aula na plataforma.
  useEffect(() => {
    if (mode !== "students" || source !== "pick") return undefined;
    const term = search.replace(/[,()%*\\]/g, " ").trim();
    if (term.length < 2) {
      setResults([]);
      return undefined;
    }
    let active = true;
    const timer = window.setTimeout(async () => {
      setSearching(true);
      const run = (columns) =>
        supabase.from("profiles").select(columns).or(`full_name.ilike.%${term}%,email.ilike.%${term}%`).order("full_name", { ascending: true }).limit(12);
      let { data, error } = await run(STUDENT_COLUMNS);
      if (error && /cpf|rg|blood_type/.test(error.message || "")) ({ data, error } = await run(STUDENT_COLUMNS_BASIC));
      if (!active) return;
      setResults(error ? [] : data || []);
      setSearching(false);
    }, 300);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [search, mode, source]);

  const addStudents = async (students) => {
    const fresh = students.filter((student) => !roster.some((item) => item.uid === student.id));
    if (fresh.length === 0) return;
    const entries = await buildEntries(fresh);
    setRoster((current) => [...current, ...entries]);
    setSearch("");
    setResults([]);
  };
  const removeFromRoster = (uid) => setRoster((current) => current.filter((item) => item.uid !== uid));

  // Já tem este certificado? Vale o mesmo modelo e, se o modelo tem o campo {curso}, o mesmo curso.
  const hasCert = (item) =>
    item.mine.some(
      (cert) =>
        cert.template_id === template?.id &&
        cert.status === "valid" &&
        (!variables.includes("curso") || normalizeText(cert.curso) === normalizeText(values.curso))
    );

  const selectedRoster = roster.filter((item) => item.selected);
  const rosterIssueRows = selectedRoster.map((item) => ({
    user_id: item.uid,
    nome: item.nome,
    email: item.email,
    foto: useAvatar ? item.foto : "",
    ...item.personal,
  }));
  const missingOf = (item) => personalKeys.filter((key) => !String(item.personal[key] || "").trim());
  // Grava no perfil do aluno o que você completou na tabela (CPF, RG, tipo sanguíneo), para a próxima emissão já vir pronto.
  const saveProfileData = async (items) => {
    const columns = { cpf: "cpf", rg: "rg", tipo_sanguineo: "blood_type" };
    let updated = 0;
    for (const item of items) {
      if (!item.hasProfileData) continue;
      const patch = {};
      Object.entries(columns).forEach(([key, column]) => {
        const value = formatValue(key, item.personal[key]);
        if (!value || value === item.saved[key]) return;
        if (key === "cpf" && !isValidCpf(value)) return;
        if (key === "tipo_sanguineo" && !BLOOD_TYPES.includes(value)) return;
        patch[column] = value;
      });
      if (Object.keys(patch).length === 0) continue;
      const { error } = await supabase.from("profiles").update(patch).eq("id", item.uid);
      if (!error) updated += 1;
    }
    return updated;
  };
  const patchRoster = (uid, patch) => setRoster((current) => current.map((item) => (item.uid === uid ? { ...item, ...patch } : item)));
  const patchPersonal = (uid, key, value) =>
    setRoster((current) => current.map((item) => (item.uid === uid ? { ...item, personal: { ...item.personal, [key]: value } } : item)));

  const knownColumns = useMemo(() => (hasPhoto ? [...variables, "foto"] : variables), [variables, hasPhoto]);
  const parsed = useMemo(() => parsePastedTable(paste, knownColumns), [paste, knownColumns]);
  const rows = useMemo(
    () =>
      parsed.rows.map((row, index) => {
        const problems = [];
        if (!row.nome || row.nome.trim().length < 2) problems.push("sem nome");
        if (row.email && !validEmail(row.email)) problems.push("e-mail inválido");
        return { ...row, line: index + 1, problems };
      }),
    [parsed]
  );
  const validRows = rows.filter((row) => row.problems.length === 0);
  const duplicateNames = useMemo(() => {
    const seen = new Set();
    const dups = new Set();
    validRows.forEach((row) => {
      const key = slug(row.nome);
      if (seen.has(key)) dups.add(key);
      seen.add(key);
    });
    return dups;
  }, [validRows]);

  if (templates.length === 0) {
    return (
      <div className="admin-empty">
        <strong>Para emitir, primeiro cadastre o plano de fundo.</strong>
        <br />
        1) Envie a arte pronta do certificado · 2) confira os textos que o sistema coloca por cima · 3) emita um ou vários de uma vez.
        <br />
        <Link className="admin-button primary" style={{ marginTop: 14 }} to="/admin/certificados/modelo/novo">Enviar meu plano de fundo</Link>
      </div>
    );
  }

  const partialPages = includedPages.length !== pages.length;
  const pagesData = partialPages ? { __pages: includedPages } : {};
  const formattedValues = Object.fromEntries(Object.entries(values).map(([key, value]) => [key, formatValue(key, value)]));
  const previewStudent = mode === "students" ? rosterIssueRows[0] : null;
  const previewValues = previewStudent
    ? {
        ...sampleValues(template),
        ...formattedValues,
        ...Object.fromEntries(personalKeys.filter((key) => previewStudent[key]).map((key) => [key, formatValue(key, previewStudent[key])])),
        nome: previewStudent.nome,
        foto: previewStudent.foto || "",
      }
    : { ...sampleValues(template), ...formattedValues, nome: name.trim() || sampleValues(template).nome, foto: photoPreview || "" };
  const currentPreview = pages[previewPage] || pages[0];

  const cleanValues = () => {
    const out = {};
    variables.forEach((key) => {
      out[key] = formatValue(key, values[key]);
    });
    return out;
  };

  const insertRows = async (records) => {
    const inserted = [];
    for (let i = 0; i < records.length; i += 100) {
      const { data, error } = await supabase.from("certificates").insert(records.slice(i, i + 100)).select("*");
      if (error) throw error;
      inserted.push(...data);
      setProgress({ label: "Registrando certificados", done: inserted.length, total: records.length });
    }
    return inserted;
  };

  const togglePage = (id) =>
    setIncludedPages((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));

  const onPhoto = (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) return notify("error", "Escolha uma imagem (JPG ou PNG).");
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const issueSingle = async (event) => {
    event.preventDefault();
    if (name.trim().length < 2) return notify("error", "Informe o nome de quem vai receber.");
    if (!validEmail(email.trim())) return notify("error", "O e-mail informado não parece válido.");
    if (includedPages.length === 0) return notify("error", "Marque ao menos uma página para emitir.");
    setBusy(true);
    setMessage("");
    try {
      const data = { ...cleanValues(), ...pagesData };
      if (hasPhoto && photoFile) {
        setProgress({ label: "Enviando foto", done: 0, total: 1 });
        data.foto = await uploadCertificateImage(photoFile, "photos");
      }
      const [row] = await insertRows([
        {
          template_id: template.id,
          recipient_name: name.trim(),
          recipient_email: email.trim().toLowerCase() || null,
          data,
          batch_label: batchLabel.trim() || null,
        },
      ]);
      setProgress({ label: "Gerando PDF", done: 0, total: 1 });
      const blob = await renderPdf({ template, certificate: row });
      downloadBlob(blob, certificateFileName(row.recipient_name, row.code));
      setIssued({ kind: "single", list: [row] });
      notify("success", `Certificado de ${row.recipient_name} emitido. O PDF foi baixado.`);
      setName("");
      setEmail("");
      setPhotoFile(null);
      setPhotoPreview("");
      onIssued?.();
    } catch (error) {
      notify("error", error.message?.includes("certificate") && error.message.includes("exist")
        ? "O banco ainda não tem as tabelas de certificados. Execute supabase/16_certificados.sql."
        : `Não foi possível emitir: ${error.message}`);
    }
    setProgress(null);
    setBusy(false);
  };

  const issueBulk = async () => {
    const fromStudents = mode === "students";
    const sourceRows = fromStudents ? rosterIssueRows : validRows;
    if (sourceRows.length === 0) return notify("error", fromStudents ? "Marque ao menos um aluno." : "Cole a lista de nomes primeiro.");
    if (sourceRows.length > BATCH_LIMIT) return notify("error", `Emita no máximo ${BATCH_LIMIT} certificados por vez. ${fromStudents ? "Desmarque alguns alunos e emita em mais de um lote." : "Divida a lista."}`);
    if (includedPages.length === 0) return notify("error", "Marque ao menos uma página para emitir.");
    if (fromStudents) {
      const duplicated = selectedRoster.filter(hasCert);
      if (duplicated.length > 0 && !window.confirm(`${duplicated.length} aluno(s) marcado(s) já têm este certificado${variables.includes("curso") ? " deste curso" : ""}. Emitir de novo mesmo assim?`)) return;
      const lacking = selectedRoster.filter((item) => missingOf(item).length > 0);
      if (lacking.length > 0 && !window.confirm(`${lacking.length} aluno(s) estão sem ${personalKeys.map(humanize).join("/")}. O certificado sai com esse campo vazio. Emitir mesmo assim?`)) return;
    } else if (rows.length !== validRows.length && !window.confirm(`${rows.length - validRows.length} linha(s) com problema serão ignoradas. Continuar com ${validRows.length}?`)) return;
    setBusy(true);
    setMessage("");
    const label = batchLabel.trim() || (fromStudents && (course?.title || values.curso) ? `${course?.title || values.curso} — ${formatDatePt()}` : `Lote ${formatDatePt()} (${sourceRows.length})`);
    try {
      const base = cleanValues();
      const records = sourceRows.map((row) => {
        const data = { ...base, ...pagesData };
        variables.forEach((key) => {
          if (row[key]) data[key] = formatValue(key, row[key]);
        });
        if (hasPhoto && row.foto) data.foto = row.foto;
        return {
          template_id: template.id,
          recipient_name: row.nome.trim(),
          recipient_email: row.email ? row.email.trim().toLowerCase() : null,
          ...(row.user_id ? { user_id: row.user_id } : {}),
          data,
          batch_label: label,
        };
      });
      const list = await insertRows(records);
      const savedProfiles = fromStudents && saveToProfile ? await saveProfileData(selectedRoster) : 0;
      setIssued({ kind: "bulk", list, label });
      onIssued?.();
      setProgress({ label: "Gerando PDFs", done: 0, total: list.length });
      const zip = await buildZip({
        items: list.map((certificate) => ({ template, certificate })),
        onProgress: (done, total) => setProgress({ label: "Gerando PDFs", done, total }),
      });
      downloadBlob(zip, `certificados-${slug(label)}.zip`);
      notify("success", `${list.length} certificado(s) emitido(s). O arquivo ZIP foi baixado.${savedProfiles ? ` Dados de ${savedProfiles} aluno(s) salvos no perfil para as próximas emissões.` : ""}`);
      if (fromStudents) setRosterNonce((n) => n + 1);
      else setPaste("");
    } catch (error) {
      notify("error", `Não foi possível concluir a emissão em massa: ${error.message}. Os já registrados aparecem em “Emitidos”.`);
    }
    setProgress(null);
    setBusy(false);
  };

  const downloadMerged = async () => {
    if (!issued) return;
    setBusy(true);
    try {
      const blob = await buildMergedPdf({
        items: issued.list.map((certificate) => ({ template, certificate })),
        onProgress: (done, total) => setProgress({ label: "Montando PDF único", done, total }),
      });
      downloadBlob(blob, `certificados-${slug(issued.label || "lote")}.pdf`);
    } catch (error) {
      notify("error", `Não foi possível montar o PDF único: ${error.message}`);
    }
    setProgress(null);
    setBusy(false);
  };

  const onFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setPaste(await file.text());
  };

  const columnsHint = ["nome", "email", ...knownColumns].join(" ; ");

  const pagePicker = pages.length > 1 && (
    <fieldset className="cert-common">
      <legend>Páginas a incluir em cada PDF</legend>
      {pages.map((page) => (
        <label className="cert-check" key={page.id}>
          <input type="checkbox" checked={includedPages.includes(page.id)} onChange={() => togglePage(page.id)} disabled={busy} />
          {page.name}
        </label>
      ))}
      <small>Desmarque para emitir só uma parte (por exemplo, só a carteirinha).</small>
    </fieldset>
  );

  return (
    <div className="cert-issue">
      <div className="cert-issue-form">
        <label className="cert-field">
          Modelo de certificado
          <select value={templateId} onChange={(e) => setTemplateId(e.target.value)} disabled={busy}>
            {templates.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </label>

        <div className="adm-segment" role="group" aria-label="Tipo de emissão">
          <button type="button" className={mode === "single" ? "is-active" : ""} aria-pressed={mode === "single"} onClick={() => setMode("single")}>Emitir um</button>
          <button type="button" className={mode === "bulk" ? "is-active" : ""} aria-pressed={mode === "bulk"} onClick={() => setMode("bulk")}>Emissão em massa</button>
          <button type="button" className={mode === "students" ? "is-active" : ""} aria-pressed={mode === "students"} onClick={() => setMode("students")}>Alunos cadastrados</button>
        </div>

        {message && <div className={`admin-alert ${messageType === "error" ? "error" : ""}`} role="status">{message}</div>}

        {mode === "single" ? (
          <form className="cert-form" onSubmit={issueSingle}>
            <label className="cert-field">Nome completo *
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome como deve aparecer no certificado" disabled={busy} required />
            </label>
            <label className="cert-field">E-mail (opcional)
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="aluno@email.com" disabled={busy} />
              <small>Se o aluno tiver conta com este e-mail, o certificado aparece na área de membros dele.</small>
            </label>
            {variables.map((key) => (
              <label className="cert-field" key={key}>{humanize(key)}
                <input value={values[key] || ""} onChange={(e) => setValues((current) => ({ ...current, [key]: e.target.value }))} disabled={busy} />
              </label>
            ))}
            {hasPhoto && (
              <label className="cert-field">Foto do participante
                <input type="file" accept="image/*" onChange={onPhoto} disabled={busy} />
                <small>{photoFile ? `${photoFile.name} — aparece na pré-visualização.` : "Opcional. Sem foto, a área da foto fica como na arte."}</small>
              </label>
            )}
            {pagePicker}
            <label className="cert-field">Lote / etiqueta (opcional)
              <input value={batchLabel} onChange={(e) => setBatchLabel(e.target.value)} placeholder="Ex.: Turma 12 — outubro" disabled={busy} />
            </label>
            <button type="submit" className="admin-button primary" disabled={busy}>{busy ? "Emitindo..." : "Emitir e baixar PDF"}</button>
          </form>
        ) : mode === "students" ? (
          <div className="cert-form">
            <p className="adm-hint">
              Nome, e-mail, foto, CPF, RG e tipo sanguíneo vêm do perfil que o próprio aluno preencheu em “Meus dados” (na falta deles, do último certificado dele).
              O aluno só precisa estar cadastrado na plataforma: o curso pode ser presencial, sem nenhuma aula aqui dentro.
            </p>
            <div className="adm-segment" role="group" aria-label="Quem vai receber">
              <button type="button" className={source === "pick" ? "is-active" : ""} aria-pressed={source === "pick"} onClick={() => setSource("pick")} disabled={busy}>Escolher alunos cadastrados</button>
              <button type="button" className={source === "product" ? "is-active" : ""} aria-pressed={source === "product"} onClick={() => setSource("product")} disabled={busy}>Alunos de um curso da plataforma</button>
            </div>

            {source === "product" ? (
              <label className="cert-field">Curso da plataforma
                <select value={courseId} onChange={(e) => setCourseId(e.target.value)} disabled={busy}>
                  <option value="">Selecione o curso…</option>
                  {courses.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
                </select>
                <small>Lista os alunos com acesso ativo a esse curso e preenche o campo {"{curso}"} do certificado.</small>
              </label>
            ) : (
              <div className="cert-field">
                <label htmlFor="cert-student-search">Buscar aluno cadastrado</label>
                <input id="cert-student-search" type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Digite parte do nome ou do e-mail…" autoComplete="off" disabled={busy} />
                <small>
                  Escreva o nome do curso no campo “Curso” abaixo (ex.: curso presencial). Você pode misturar alunos de turmas diferentes.
                  {!variables.includes("curso") && " Este modelo não tem o campo {curso}; se quiser, adicione um texto com {curso} no modelo."}
                </small>
                {searching && <small>Buscando…</small>}
                {results.length > 0 && (
                  <ul className="cert-search-results" role="listbox" aria-label="Alunos encontrados">
                    {results.map((student) => {
                      const already = roster.some((item) => item.uid === student.id);
                      return (
                        <li key={student.id}>
                          <span><strong>{student.full_name || "Sem nome"}</strong><small>{student.email}</small></span>
                          <button type="button" className="adm-action is-primary" onClick={() => addStudents([student])} disabled={already || busy}>{already ? "Já na lista" : "Adicionar"}</button>
                        </li>
                      );
                    })}
                    {results.some((student) => !roster.some((item) => item.uid === student.id)) && (
                      <li className="cert-search-all">
                        <button type="button" className="adm-action" onClick={() => addStudents(results)} disabled={busy}>Adicionar todos os {results.length} resultados</button>
                      </li>
                    )}
                  </ul>
                )}
                {search.trim().length >= 2 && !searching && results.length === 0 && <small>Nenhum aluno encontrado. O aluno precisa ter criado a conta na plataforma.</small>}
              </div>
            )}

            {variables.filter((key) => !PERSONAL_KEYS.includes(key)).length > 0 && (
              <fieldset className="cert-common">
                <legend>Valores iguais para a turma</legend>
                {variables.filter((key) => !PERSONAL_KEYS.includes(key)).map((key) => (
                  <label className="cert-field" key={key}>{humanize(key)}
                    <input value={values[key] || ""} onChange={(e) => setValues((current) => ({ ...current, [key]: e.target.value }))} list={key === "curso" ? "cert-course-list" : undefined} disabled={busy} />
                  </label>
                ))}
                <datalist id="cert-course-list">
                  {courses.map((item) => <option key={item.id} value={item.title} />)}
                </datalist>
              </fieldset>
            )}
            {pagePicker}
            {hasPhoto && (
              <label className="cert-check">
                <input type="checkbox" checked={useAvatar} onChange={(e) => setUseAvatar(e.target.checked)} disabled={busy} />
                Usar a foto do perfil do aluno na área da foto
              </label>
            )}
            {personalKeys.length > 0 && (
              <label className="cert-check">
                <input type="checkbox" checked={saveToProfile} onChange={(e) => setSaveToProfile(e.target.checked)} disabled={busy} />
                Salvar no perfil do aluno o que eu completar aqui (CPF, RG, tipo sanguíneo)
              </label>
            )}
            <label className="cert-field">Lote / etiqueta (opcional)
              <input value={batchLabel} onChange={(e) => setBatchLabel(e.target.value)} placeholder={course?.title || values.curso ? `${course?.title || values.curso} — ${formatDatePt()}` : "Ex.: Turma 12 — outubro"} disabled={busy} />
            </label>

            {source === "product" && rosterState === "loading" && <p className="adm-hint">Carregando alunos…</p>}
            {source === "product" && rosterState === "error" && <div className="admin-alert error" role="alert">Não foi possível carregar os alunos: {rosterError}</div>}
            {source === "product" && courseId && rosterState === "idle" && roster.length === 0 && (
              <div className="admin-empty">Nenhum aluno com acesso ativo a este curso. Libere o acesso em “Acessos dos alunos”.</div>
            )}

            {roster.length > 0 && (
              <div className="cert-preview-table" aria-label="Alunos do curso">
                <p className="cert-preview-summary">
                  <strong>{selectedRoster.length}</strong> de {roster.length} selecionado(s)
                  {roster.some(hasCert) && <> · <span className="is-warn">{roster.filter(hasCert).length} já têm este certificado{variables.includes("curso") ? " deste curso" : ""}</span></>}
                </p>
                <div className="cert-row-actions">
                  <button type="button" className="adm-action" onClick={() => setRoster((current) => current.map((item) => ({ ...item, selected: true })))} disabled={busy}>Marcar todos</button>
                  <button type="button" className="adm-action" onClick={() => setRoster((current) => current.map((item) => ({ ...item, selected: !hasCert(item) })))} disabled={busy}>Só quem ainda não tem</button>
                  <button type="button" className="adm-action" onClick={() => setRoster((current) => current.map((item) => ({ ...item, selected: false })))} disabled={busy}>Desmarcar</button>
                </div>
                <div className="admin-table-wrap">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th aria-label="Emitir"></th><th>Aluno</th>
                        {personalKeys.map((key) => <th key={key}>{humanize(key)}</th>)}
                        {hasPhoto && <th>Foto</th>}
                        <th>Situação</th>
                      </tr>
                    </thead>
                    <tbody>
                      {roster.map((item) => {
                        const missing = missingOf(item);
                        return (
                          <tr key={item.uid}>
                            <td><input type="checkbox" checked={item.selected} onChange={(e) => patchRoster(item.uid, { selected: e.target.checked })} disabled={busy} aria-label={`Emitir para ${item.nome}`} /></td>
                            <td><strong>{item.nome}</strong><small>{item.email}</small></td>
                            {personalKeys.map((key) => (
                              <td key={key}>
                                <input className="cert-cell-input" value={item.personal[key] || ""} onChange={(e) => patchPersonal(item.uid, key, e.target.value)} disabled={busy} aria-label={`${humanize(key)} de ${item.nome}`} />
                              </td>
                            ))}
                            {hasPhoto && <td>{useAvatar && item.foto ? <img className="cert-cell-photo" src={item.foto} alt="" /> : "—"}</td>}
                            <td>
                              {hasCert(item) ? <span className="is-warn">já emitido</span> : missing.length ? <span className="is-warn">falta {missing.map(humanize).join(", ")}</span> : "ok"}
                              {source === "pick" && <button type="button" className="cert-remove" onClick={() => removeFromRoster(item.uid)} disabled={busy} aria-label={`Tirar ${item.nome} da lista`}>Tirar</button>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <button type="button" className="admin-button primary" onClick={issueBulk} disabled={busy || selectedRoster.length === 0}>
              {busy ? "Emitindo..." : selectedRoster.length ? `Emitir ${selectedRoster.length} certificado(s) e baixar ZIP` : source === "pick" ? "Busque e adicione os alunos" : "Selecione o curso e os alunos"}
            </button>
          </div>
        ) : (
          <div className="cert-form">
            <p className="adm-hint">
              Cole a lista direto do Excel ou Google Planilhas (ou envie um CSV). Com cabeçalho: <code>{columnsHint}</code>.
              Sem cabeçalho, uma linha por nome (e e-mail na 2ª coluna, se houver).
              {hasPhoto && " A coluna foto aceita o link (URL) da imagem de cada pessoa."}
            </p>
            {variables.length > 0 && (
              <fieldset className="cert-common">
                <legend>Valores iguais para todos</legend>
                {variables.map((key) => (
                  <label className="cert-field" key={key}>{humanize(key)}
                    <input value={values[key] || ""} onChange={(e) => setValues((current) => ({ ...current, [key]: e.target.value }))} disabled={busy} />
                  </label>
                ))}
                <small>Uma coluna com o mesmo nome na lista substitui o valor daquela linha (ex.: cpf, rg, tipo_sanguineo).</small>
              </fieldset>
            )}
            {pagePicker}
            <label className="cert-field">Lista de participantes
              <textarea rows={8} value={paste} onChange={(e) => setPaste(e.target.value)} placeholder={"nome\temail\tcpf\nMaria da Silva\tmaria@email.com\t12345678901\nJoão Souza\tjoao@email.com\t98765432100"} disabled={busy} />
            </label>
            <div className="cert-row-actions">
              <button type="button" className="adm-action" onClick={() => fileRef.current?.click()} disabled={busy}>Enviar arquivo CSV</button>
              <input ref={fileRef} type="file" accept=".csv,.txt,text/csv,text/plain" onChange={onFile} hidden />
              {paste && <button type="button" className="adm-action" onClick={() => setPaste("")} disabled={busy}>Limpar</button>}
            </div>
            <label className="cert-field">Lote / etiqueta (opcional)
              <input value={batchLabel} onChange={(e) => setBatchLabel(e.target.value)} placeholder="Ex.: Turma 12 — outubro" disabled={busy} />
            </label>

            {rows.length > 0 && (
              <div className="cert-preview-table" aria-label="Conferência da lista">
                <p className="cert-preview-summary">
                  <strong>{validRows.length}</strong> pronto(s)
                  {rows.length !== validRows.length && <> · <span className="is-bad">{rows.length - validRows.length} com problema</span></>}
                  {duplicateNames.size > 0 && <> · <span className="is-warn">{duplicateNames.size} nome(s) repetido(s)</span></>}
                  {parsed.ignored.length > 0 && <> · colunas ignoradas: {parsed.ignored.join(", ")}</>}
                </p>
                <div className="admin-table-wrap">
                  <table className="admin-table">
                    <thead><tr><th>#</th><th>Nome</th><th>E-mail</th>{variables.map((key) => <th key={key}>{humanize(key)}</th>)}{hasPhoto && <th>Foto</th>}<th>Situação</th></tr></thead>
                    <tbody>
                      {rows.slice(0, 50).map((row) => (
                        <tr key={row.line}>
                          <td>{row.line}</td>
                          <td>{row.nome || "—"}</td>
                          <td>{row.email || "—"}</td>
                          {variables.map((key) => <td key={key}>{row[key] ? formatValue(key, row[key]) : <em>padrão</em>}</td>)}
                          {hasPhoto && <td>{row.foto ? "sim" : "—"}</td>}
                          <td>{row.problems.length ? <span className="is-bad">{row.problems.join(", ")}</span> : "ok"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {rows.length > 50 && <p className="adm-hint">Mostrando as 50 primeiras de {rows.length} linhas.</p>}
              </div>
            )}

            <button type="button" className="admin-button primary" onClick={issueBulk} disabled={busy || validRows.length === 0}>
              {busy ? "Emitindo..." : validRows.length ? `Emitir ${validRows.length} certificado(s) e baixar ZIP` : "Emitir em massa"}
            </button>
          </div>
        )}

        {progress && (
          <div className="adm-progress" role="status">
            <div className="adm-progress-bar"><span style={{ width: `${Math.round((progress.done / Math.max(progress.total, 1)) * 100)}%` }} /></div>
            <small>{progress.label}: {progress.done}/{progress.total}</small>
          </div>
        )}

        {issued && (
          <div className="cert-result">
            <strong>{issued.kind === "single" ? "Certificado emitido" : `${issued.list.length} certificados emitidos`}</strong>
            {issued.kind === "single" ? (
              <>
                <p>Código de verificação: <code>{issued.list[0].code}</code></p>
                <div className="cert-row-actions">
                  <button type="button" className="adm-action" onClick={async () => notify((await copy(verifyUrl(issued.list[0].code))) ? "success" : "error", "Link de verificação copiado.")}>Copiar link de verificação</button>
                  <button type="button" className="adm-action" disabled={busy} onClick={async () => downloadBlob(await renderPdf({ template, certificate: issued.list[0] }), certificateFileName(issued.list[0].recipient_name, issued.list[0].code))}>Baixar de novo</button>
                </div>
              </>
            ) : (
              <div className="cert-row-actions">
                <button type="button" className="adm-action" disabled={busy} onClick={downloadMerged}>Baixar um PDF único (todas as páginas de todos)</button>
                <button type="button" className="adm-action" disabled={busy} onClick={async () => {
                  setBusy(true);
                  const zip = await buildZip({ items: issued.list.map((certificate) => ({ template, certificate })), onProgress: (done, total) => setProgress({ label: "Gerando PDFs", done, total }) });
                  downloadBlob(zip, `certificados-${slug(issued.label)}.zip`);
                  setProgress(null);
                  setBusy(false);
                }}>Baixar ZIP de novo</button>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="cert-issue-preview">
        <h3>Pré-visualização</h3>
        {pages.length > 1 && (
          <div className="cert-pagebar" role="tablist" aria-label="Páginas do modelo">
            {pages.map((page, index) => (
              <button type="button" role="tab" key={page.id} aria-selected={index === previewPage} className={`${index === previewPage ? "is-active" : ""} ${includedPages.includes(page.id) ? "" : "is-off"}`} onClick={() => setPreviewPage(index)}>
                {page.name}
              </button>
            ))}
          </div>
        )}
        <CertificateCanvas template={template} page={currentPreview} values={previewValues} maxSide={1400} />
        <p className="adm-hint">O código e o QR reais são gerados na emissão.</p>
      </div>
    </div>
  );
}
