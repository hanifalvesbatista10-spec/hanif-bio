import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import CertificateCanvas from "../../components/certificates/CertificateCanvas";
import { supabase } from "../../services/supabase";
import {
  BLOCK_PRESETS,
  BUILTIN_VARS,
  DEFAULT_QR,
  FONTS,
  PAGE_STARTERS,
  getPages,
  humanize,
  isMissingCertTables,
  newBlock,
  newPageId,
  readImageSize,
  sampleValues,
  starterBlocks,
  templateVariables,
  usesPhoto,
} from "../../services/certificates";
import "../../styles/certificates.css";

const BUCKET = "certificate-backgrounds";
const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"];
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

async function uploadImage(file, folder) {
  const path = `${folder}/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, { cacheControl: "31536000", upsert: false, contentType: file.type });
  if (error) throw error;
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return { url: data.publicUrl, path };
}

function blockLabel(block) {
  if (block.type === "image") return "Imagem (assinatura / logo)";
  if (block.type === "photo") return "Foto do participante";
  const text = block.text || "(vazio)";
  return text.length > 34 ? `${text.slice(0, 34)}…` : text;
}

export default function CertificateTemplateEditor() {
  const { id } = useParams();
  const isNew = !id;
  const navigate = useNavigate();
  const stageRef = useRef(null);
  const drag = useRef(null);
  const textRef = useRef(null);
  const imageInputRef = useRef(null);

  const [name, setName] = useState("");
  const [pages, setPages] = useState([]); // [{ id, name, background_url, background_path, width, height, blocks, qr }]
  const [pageIndex, setPageIndex] = useState(0);
  const [defaults, setDefaults] = useState({});
  const [selectedId, setSelectedId] = useState(null);
  const [metrics, setMetrics] = useState([]);
  const [canvasSize, setCanvasSize] = useState({ width: 1, height: 1 });
  const [starter, setStarter] = useState("certificado");
  const [loading, setLoading] = useState(!isNew);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [missing, setMissing] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("success");
  const [issuedCount, setIssuedCount] = useState(0);
  const [pickTarget, setPickTarget] = useState(null); // "background" | "replace" | "image" | "blockimage"

  const notify = (type, text) => {
    setMessageType(type);
    setMessage(text);
  };

  useEffect(() => {
    if (isNew) return;
    (async () => {
      const { data, error } = await supabase.from("certificate_templates").select("*").eq("id", id).maybeSingle();
      if (error) {
        if (isMissingCertTables(error)) setMissing(true);
        else notify("error", `Erro ao carregar: ${error.message}`);
      } else if (!data) {
        notify("error", "Modelo não encontrado.");
      } else {
        setName(data.name);
        setPages(getPages(data));
        setDefaults(data.defaults || {});
        const count = await supabase.from("certificates").select("id", { count: "exact", head: true }).eq("template_id", id);
        setIssuedCount(count.count || 0);
      }
      setLoading(false);
    })();
  }, [id, isNew]);

  const page = pages[pageIndex] || null;
  const template = useMemo(
    () => (pages.length ? { name, background_url: pages[0].background_url, width: pages[0].width, height: pages[0].height, blocks: pages[0].blocks, qr: pages[0].qr, defaults, pages } : null),
    [name, pages, defaults]
  );
  const variables = useMemo(() => (template ? templateVariables(template) : []), [template]);
  const values = useMemo(() => (template ? sampleValues(template) : {}), [template]);
  const selected = page?.blocks.find((block) => block.id === selectedId) || null;
  const qrSelected = selectedId === "__qr";

  const patchPage = (patch) => setPages((current) => current.map((item, index) => (index === pageIndex ? { ...item, ...(typeof patch === "function" ? patch(item) : patch) } : item)));
  const updateBlock = (blockId, patch) => patchPage((item) => ({ blocks: item.blocks.map((block) => (block.id === blockId ? { ...block, ...patch } : block)) }));
  const setQr = (patch) => patchPage((item) => ({ qr: { ...DEFAULT_QR, ...item.qr, ...(typeof patch === "function" ? patch(item.qr) : patch) } }));

  // ------------------------------------------------------------ envio de imagens
  const pickImage = (target) => {
    setPickTarget(target);
    imageInputRef.current?.click();
  };

  const onFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    const target = pickTarget;
    setPickTarget(null);
    if (!file || !target) return;
    if (!IMAGE_TYPES.includes(file.type)) return notify("error", "Use uma imagem PNG, JPG ou WebP.");
    if (file.size > 15 * 1024 * 1024) return notify("error", "A imagem passa de 15 MB. Exporte em JPG ou reduza o tamanho.");
    setUploading(true);
    try {
      const size = await readImageSize(file);
      const { url, path } = await uploadImage(file, target === "background" || target === "replace" ? "backgrounds" : "images");

      if (target === "background") {
        const blocks = starterBlocks(starter);
        const created = { id: newPageId(), name: `Página ${pages.length + 1}`, background_url: url, background_path: path, width: size.width, height: size.height, blocks, qr: { ...DEFAULT_QR } };
        setPages((current) => [...current, created]);
        setPageIndex(pages.length);
        setSelectedId(null);
        notify("success", `Página adicionada (${size.width}×${size.height}px). Arraste os textos para a posição certa.`);
      } else if (target === "replace") {
        patchPage({ background_url: url, background_path: path, width: size.width, height: size.height });
        notify("success", `Arte trocada (${size.width}×${size.height}px). Os textos mantêm a posição em %.`);
      } else if (target === "image") {
        const block = newBlock({ type: "image", image_url: url, image_path: path, x: 50, y: 82, width: Math.min(24, Math.round((size.width / (page?.width || 2000)) * 100) || 24), opacity: 1, text: "" });
        patchPage((item) => ({ blocks: [...item.blocks, block] }));
        setSelectedId(block.id);
        notify("success", "Imagem adicionada. Arraste até o lugar da assinatura/logo.");
      } else if (target === "blockimage" && selected) {
        updateBlock(selected.id, { image_url: url, image_path: path });
        notify("success", "Imagem trocada.");
      }
    } catch (error) {
      const text = error.message || "";
      notify("error", text.toLowerCase().includes("bucket") || text.includes("not found")
        ? "O banco ainda não está pronto para certificados. Execute supabase/16_certificados.sql no SQL Editor."
        : `Não foi possível enviar a imagem: ${text}`);
    }
    setUploading(false);
  };

  // ------------------------------------------------------------ textos / blocos
  const addPreset = (index) => {
    const block = newBlock(BLOCK_PRESETS[index].block);
    patchPage((item) => ({ blocks: [...item.blocks, block] }));
    setSelectedId(block.id);
  };

  const addPhoto = () => {
    const block = newBlock({ type: "photo", x: 82, y: 55, width: 22, ratio: 1.3, radius: 4, text: "" });
    patchPage((item) => ({ blocks: [...item.blocks, block] }));
    setSelectedId(block.id);
  };

  const removeBlock = (blockId) => {
    patchPage((item) => ({ blocks: item.blocks.filter((block) => block.id !== blockId) }));
    setSelectedId(null);
  };

  const duplicateBlock = (block) => {
    const copy = newBlock({ ...block, id: undefined, y: clamp(block.y + 5, 0, 100) });
    patchPage((item) => ({ blocks: [...item.blocks, copy] }));
    setSelectedId(copy.id);
  };

  const boldSelection = () => {
    const el = textRef.current;
    if (!el || !selected) return;
    const start = el.selectionStart ?? selected.text.length;
    const end = el.selectionEnd ?? start;
    const text = selected.text;
    const next = `${text.slice(0, start)}**${text.slice(start, end)}**${text.slice(end)}`;
    updateBlock(selected.id, { text: next });
    requestAnimationFrame(() => {
      el.focus();
      const cursor = end === start ? start + 2 : end + 4;
      el.setSelectionRange(cursor, cursor);
    });
  };

  // ------------------------------------------------------------ páginas
  const removePage = () => {
    if (pages.length <= 1) return notify("error", "O modelo precisa ter ao menos uma página.");
    if (!window.confirm(`Remover a página “${page.name}” do modelo?`)) return;
    setPages((current) => current.filter((_, index) => index !== pageIndex));
    setPageIndex(0);
    setSelectedId(null);
  };

  // ------------------------------------------------------------ arrastar na pré-visualização
  const startDrag = (event, target) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    const source = target === "__qr" ? page.qr : page.blocks.find((block) => block.id === target);
    if (!source) return;
    drag.current = { target, startX: event.clientX, startY: event.clientY, x: source.x, y: source.y };
    setSelectedId(target);
  };

  const moveDrag = (event) => {
    const state = drag.current;
    const rect = stageRef.current?.getBoundingClientRect();
    if (!state || !rect) return;
    const x = Math.round(clamp(state.x + ((event.clientX - state.startX) / rect.width) * 100, 0, 100) * 10) / 10;
    const y = Math.round(clamp(state.y + ((event.clientY - state.startY) / rect.height) * 100, 0, 100) * 10) / 10;
    if (state.target === "__qr") setQr({ x, y });
    else updateBlock(state.target, { x, y });
  };

  const endDrag = () => {
    drag.current = null;
  };

  const nudge = (event, target) => {
    const step = event.shiftKey ? 2 : 0.5;
    const delta = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[event.key];
    if (!delta) return;
    event.preventDefault();
    if (target === "__qr") setQr((qr) => ({ x: clamp(qr.x + delta[0], 0, 100), y: clamp(qr.y + delta[1], 0, 100) }));
    else {
      const block = page.blocks.find((item) => item.id === target);
      updateBlock(target, { x: clamp(block.x + delta[0], 0, 100), y: clamp(block.y + delta[1], 0, 100) });
    }
  };

  const onMetrics = useCallback((list, size) => {
    setMetrics(list);
    setCanvasSize(size);
  }, []);

  // ------------------------------------------------------------ salvar
  const save = async () => {
    if (!name.trim()) return notify("error", "Dê um nome ao modelo.");
    if (pages.length === 0) return notify("error", "Adicione ao menos uma página com a arte de fundo.");
    setSaving(true);
    const pagePayload = pages.map((item) => ({
      id: item.id,
      name: item.name,
      background_url: item.background_url,
      background_path: item.background_path || null,
      width: item.width,
      height: item.height,
      blocks: item.blocks,
      qr: item.qr,
    }));
    const first = pagePayload[0];
    const payload = {
      name: name.trim(),
      // a 1ª página também fica nos campos antigos (compatibilidade)
      background_url: first.background_url,
      background_path: first.background_path,
      width: first.width,
      height: first.height,
      blocks: first.blocks,
      qr: first.qr,
      pages: pagePayload,
      defaults,
    };
    const result = isNew
      ? await supabase.from("certificate_templates").insert(payload).select("*").single()
      : await supabase.from("certificate_templates").update(payload).eq("id", id).select("*").single();
    setSaving(false);
    if (result.error) {
      const text = result.error.message || "";
      notify("error", isMissingCertTables(result.error)
        ? "O banco ainda não tem as tabelas de certificados. Execute supabase/16_certificados.sql no SQL Editor."
        : text.includes("pages")
          ? "O banco ainda não suporta várias páginas. Execute supabase/17_certificados_paginas.sql no SQL Editor."
          : `Erro ao salvar: ${text}`);
      return;
    }
    if (isNew) navigate(`/admin/certificados/modelo/${result.data.id}`, { replace: true, state: { created: true } });
    else notify("success", "Modelo salvo. Os certificados já emitidos usam a versão atual do modelo ao serem baixados.");
  };

  if (missing) {
    return (
      <section className="admin-section">
        <div className="admin-alert error">
          O banco ainda não tem as tabelas de certificados. Execute <strong>supabase/16_certificados.sql</strong> no SQL Editor do Supabase e recarregue.
        </div>
        <Link className="admin-button" to="/admin/certificados?aba=modelos">← Voltar</Link>
      </section>
    );
  }

  return (
    <section className="admin-section">
      <div className="admin-section-head">
        <div>
          <span><Link to="/admin/certificados?aba=modelos" className="adm-crumb">← CERTIFICADOS</Link></span>
          <h2>{isNew ? "Novo modelo de certificado" : name || "Modelo"}</h2>
        </div>
        <div className="cert-head-actions">
          {!isNew && <Link className="admin-button" to={`/admin/certificados?aba=emitir&modelo=${id}`}>Emitir com este modelo</Link>}
          <button type="button" className="admin-button primary" onClick={save} disabled={saving || uploading}>{saving ? "Salvando..." : "Salvar modelo"}</button>
        </div>
      </div>

      {message && <div className={`admin-alert ${messageType === "error" ? "error" : ""}`} role="status">{message}</div>}
      <input ref={imageInputRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={onFile} hidden />

      {loading ? (
        <div className="admin-empty">Carregando...</div>
      ) : (
        <div className="cert-editor">
          <div className="cert-editor-main">
            <div className="cert-toolbar">
              <label className="cert-field">
                Nome do modelo
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Curso Extensivo de APH — certificado + carteirinha" />
              </label>
            </div>

            {pages.length > 0 && (
              <div className="cert-pagebar" role="tablist" aria-label="Páginas do modelo">
                {pages.map((item, index) => (
                  <button type="button" role="tab" key={item.id} aria-selected={index === pageIndex} className={index === pageIndex ? "is-active" : ""} onClick={() => { setPageIndex(index); setSelectedId(null); }}>
                    {item.name}
                  </button>
                ))}
              </div>
            )}

            {!page ? (
              <div className="cert-dropzone">
                <strong>Envie o plano de fundo do certificado</strong>
                <p>É a sua arte pronta (PNG ou JPG exportado do Canva, com bordas, logo, textos fixos e a área da foto). O sistema só coloca por cima os textos que mudam de pessoa para pessoa (nome, CPF, curso, data…) — já vêm posicionados; se precisar, é só arrastar. Um modelo pode ter várias páginas: certificado, carteirinha, conteúdo programático.</p>
                <label className="cert-field">Começar com
                  <select value={starter} onChange={(e) => setStarter(e.target.value)}>
                    {PAGE_STARTERS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
                  </select>
                </label>
                <button type="button" className="admin-button primary" onClick={() => pickImage("background")} disabled={uploading}>{uploading ? "Enviando..." : "Enviar plano de fundo"}</button>
              </div>
            ) : (
              <>
                <div
                  ref={stageRef}
                  className="cert-stage-wrap"
                  onPointerMove={moveDrag}
                  onPointerUp={endDrag}
                  onPointerCancel={endDrag}
                  onPointerDown={(event) => { if (event.target === event.currentTarget || event.target.tagName === "CANVAS") setSelectedId(null); }}
                >
                  <CertificateCanvas template={template} page={page} values={values} onMetrics={onMetrics} placeholders>
                    {metrics.map(({ id: blockId, box }) => {
                      const block = page.blocks.find((item) => item.id === blockId);
                      const isQr = blockId === "__qr";
                      if (!block && !isQr) return null;
                      const pos = isQr ? page.qr : block;
                      const style = box
                        ? { left: `${(box.x / canvasSize.width) * 100}%`, top: `${(box.y / canvasSize.height) * 100}%`, width: `${(box.w / canvasSize.width) * 100}%`, height: `${(box.h / canvasSize.height) * 100}%` }
                        : { left: `${pos.x}%`, top: `${pos.y}%`, width: "2.4%", height: "2.4%", transform: "translate(-50%,-50%)" };
                      return (
                        <button
                          key={blockId}
                          type="button"
                          className={`cert-handle ${selectedId === blockId ? "is-selected" : ""} ${box ? "" : "is-empty"}`}
                          style={style}
                          onPointerDown={(event) => startDrag(event, blockId)}
                          onKeyDown={(event) => nudge(event, blockId)}
                          onFocus={() => setSelectedId(blockId)}
                          aria-label={isQr ? "QR de verificação (arraste ou use as setas)" : `${blockLabel(block)}. Arraste ou use as setas para mover`}
                        />
                      );
                    })}
                  </CertificateCanvas>
                </div>
                <p className="adm-hint">Arraste os itens sobre a arte (ou selecione e use as setas do teclado; Shift move mais). A pré-visualização usa valores de exemplo.</p>

                <div className="cert-page-tools">
                  <label className="cert-field">Nome desta página
                    <input value={page.name} onChange={(e) => patchPage({ name: e.target.value })} />
                  </label>
                  <div className="cert-row-actions">
                    <button type="button" className="adm-action" onClick={() => pickImage("replace")} disabled={uploading}>Trocar arte desta página</button>
                    <button type="button" className="adm-action is-danger" onClick={removePage}>Remover página</button>
                  </div>
                </div>

                <div className="cert-addpage">
                  <strong>Adicionar outra página ao modelo</strong>
                  <div className="cert-row-actions">
                    <select value={starter} onChange={(e) => setStarter(e.target.value)} aria-label="Ponto de partida da nova página">
                      {PAGE_STARTERS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
                    </select>
                    <button type="button" className="adm-action is-primary" onClick={() => pickImage("background")} disabled={uploading}>{uploading ? "Enviando..." : "+ Página com nova arte"}</button>
                  </div>
                </div>
              </>
            )}
          </div>

          {page && (
            <aside className="cert-editor-side" aria-label="Itens da página">
              <div className="cert-side-block">
                <h3>Itens desta página</h3>
                <ul className="cert-block-list">
                  {page.blocks.map((block) => (
                    <li key={block.id}>
                      <button type="button" className={selectedId === block.id ? "is-active" : ""} onClick={() => setSelectedId(block.id)}>{blockLabel(block)}</button>
                    </li>
                  ))}
                  {page.qr.enabled && (
                    <li><button type="button" className={qrSelected ? "is-active" : ""} onClick={() => setSelectedId("__qr")}>QR de verificação</button></li>
                  )}
                </ul>
                <label className="cert-field">
                  Adicionar
                  <select
                    value=""
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value === "") return;
                      if (value === "image") pickImage("image");
                      else if (value === "photo") addPhoto();
                      else addPreset(Number(value));
                    }}
                  >
                    <option value="">+ Escolha o que adicionar…</option>
                    {BLOCK_PRESETS.map((preset, index) => <option key={preset.label} value={index}>{preset.label}</option>)}
                    <option value="image">Imagem (assinatura, logo, carimbo)</option>
                    <option value="photo">Foto do participante</option>
                  </select>
                </label>
              </div>

              {selected && selected.type === "image" && (
                <div className="cert-side-block">
                  <h3>Imagem selecionada</h3>
                  <div className="cert-grid two">
                    <label className="cert-field">Largura (%)
                      <input type="number" min="2" max="100" value={selected.width} onChange={(e) => updateBlock(selected.id, { width: clamp(Number(e.target.value) || 2, 2, 100) })} />
                    </label>
                    <label className="cert-field">Opacidade
                      <input type="number" step="0.1" min="0.1" max="1" value={selected.opacity ?? 1} onChange={(e) => updateBlock(selected.id, { opacity: clamp(Number(e.target.value) || 1, 0.1, 1) })} />
                    </label>
                  </div>
                  <div className="cert-row-actions">
                    <button type="button" className="adm-action" onClick={() => pickImage("blockimage")} disabled={uploading}>Trocar imagem</button>
                    <button type="button" className="adm-action" onClick={() => duplicateBlock(selected)}>Duplicar</button>
                    <button type="button" className="adm-action is-danger" onClick={() => removeBlock(selected.id)}>Remover</button>
                  </div>
                  <p className="adm-hint">Dica: use PNG com fundo transparente para assinaturas.</p>
                </div>
              )}

              {selected && selected.type === "photo" && (
                <div className="cert-side-block">
                  <h3>Foto do participante</h3>
                  <p className="adm-hint">A foto é enviada na hora de emitir (uma por pessoa). Sem foto, a arte fica como está.</p>
                  <div className="cert-grid two">
                    <label className="cert-field">Largura (%)
                      <input type="number" min="4" max="60" value={selected.width} onChange={(e) => updateBlock(selected.id, { width: clamp(Number(e.target.value) || 4, 4, 60) })} />
                    </label>
                    <label className="cert-field">Proporção (altura/largura)
                      <input type="number" step="0.05" min="0.5" max="2" value={selected.ratio} onChange={(e) => updateBlock(selected.id, { ratio: clamp(Number(e.target.value) || 1.3, 0.5, 2) })} />
                    </label>
                    <label className="cert-field">Cantos arredondados (%)
                      <input type="number" min="0" max="50" value={selected.radius ?? 0} onChange={(e) => updateBlock(selected.id, { radius: clamp(Number(e.target.value) || 0, 0, 50) })} />
                    </label>
                  </div>
                  <div className="cert-row-actions">
                    <button type="button" className="adm-action is-danger" onClick={() => removeBlock(selected.id)}>Remover</button>
                  </div>
                </div>
              )}

              {selected && (selected.type || "text") === "text" && (
                <div className="cert-side-block">
                  <h3>Texto selecionado</h3>
                  <label className="cert-field">
                    Conteúdo <small>use {"{nome}"}, {"{cpf}"}, {"{curso}"}… para campos variáveis e **duas estrelas** para negrito</small>
                    <textarea ref={textRef} rows={4} value={selected.text} onChange={(e) => updateBlock(selected.id, { text: e.target.value })} />
                  </label>
                  <div className="cert-row-actions">
                    <button type="button" className="adm-action" onClick={boldSelection}><strong>N</strong> Negrito no trecho selecionado</button>
                  </div>
                  <div className="cert-grid two">
                    <label className="cert-field">Fonte
                      <select value={selected.font} onChange={(e) => updateBlock(selected.id, { font: e.target.value })}>
                        {FONTS.map((font) => <option key={font.value} value={font.value}>{font.label}</option>)}
                      </select>
                    </label>
                    <label className="cert-field">Peso
                      <select value={selected.weight} onChange={(e) => updateBlock(selected.id, { weight: e.target.value })}>
                        <option value="400">Normal</option>
                        <option value="600">Seminegrito</option>
                        <option value="700">Negrito</option>
                      </select>
                    </label>
                    <label className="cert-field">Tamanho
                      <input type="number" min="4" max="200" value={selected.size} onChange={(e) => updateBlock(selected.id, { size: Number(e.target.value) || 4 })} />
                    </label>
                    <label className="cert-field">Cor
                      <input type="color" value={selected.color} onChange={(e) => updateBlock(selected.id, { color: e.target.value })} />
                    </label>
                    <label className="cert-field">Alinhamento
                      <select value={selected.align} onChange={(e) => updateBlock(selected.id, { align: e.target.value })}>
                        <option value="left">Esquerda</option>
                        <option value="center">Centro</option>
                        <option value="right">Direita</option>
                        <option value="justify">Justificado</option>
                      </select>
                    </label>
                    <label className="cert-field">Largura máxima (%)
                      <input type="number" min="5" max="100" value={selected.maxWidth} onChange={(e) => updateBlock(selected.id, { maxWidth: clamp(Number(e.target.value) || 5, 5, 100) })} />
                    </label>
                    <label className="cert-field">Se não couber
                      <select value={selected.fit} onChange={(e) => updateBlock(selected.id, { fit: e.target.value })} disabled={selected.align === "justify"}>
                        <option value="shrink">Reduzir a letra (1 linha)</option>
                        <option value="wrap">Quebrar em linhas</option>
                      </select>
                    </label>
                    <label className="cert-field">Entrelinha
                      <input type="number" step="0.05" min="0.9" max="2.5" value={selected.lineHeight} onChange={(e) => updateBlock(selected.id, { lineHeight: Number(e.target.value) || 1.3 })} />
                    </label>
                  </div>
                  <label className="cert-check"><input type="checkbox" checked={Boolean(selected.uppercase)} onChange={(e) => updateBlock(selected.id, { uppercase: e.target.checked })} /> TUDO EM MAIÚSCULAS</label>
                  <div className="cert-row-actions">
                    <button type="button" className="adm-action" onClick={() => duplicateBlock(selected)}>Duplicar</button>
                    <button type="button" className="adm-action is-danger" onClick={() => removeBlock(selected.id)}>Remover</button>
                  </div>
                </div>
              )}

              {qrSelected && (
                <div className="cert-side-block">
                  <h3>QR de verificação</h3>
                  <label className="cert-field">Tamanho (% da largura)
                    <input type="number" min="3" max="30" value={page.qr.size} onChange={(e) => setQr({ size: clamp(Number(e.target.value) || 9, 3, 30) })} />
                  </label>
                </div>
              )}

              <div className="cert-side-block">
                <h3>QR de verificação</h3>
                <label className="cert-check">
                  <input type="checkbox" checked={page.qr.enabled} onChange={(e) => setQr({ enabled: e.target.checked })} />
                  Incluir na página “{page.name}”
                </label>
                <p className="adm-hint">Leva quem escanear à página pública que confirma que o certificado é autêntico.</p>
              </div>

              <div className="cert-side-block">
                <h3>Campos do modelo</h3>
                <p className="adm-hint">Valem para todas as páginas. Preenchem sozinhos na emissão e servem de exemplo aqui. Automáticos: {BUILTIN_VARS.map((v) => `{${v}}`).join(", ")}.</p>
                {variables.length === 0 ? (
                  <p className="adm-hint">Nenhum campo além de {"{nome}"}. Use {"{curso}"}, {"{cpf}"}, {"{data}"}, {"{carga_horaria}"} nos textos para criar campos.</p>
                ) : (
                  variables.map((key) => (
                    <label className="cert-field" key={key}>{humanize(key)} <small>{`{${key}}`}</small>
                      <input value={defaults[key] || ""} onChange={(e) => setDefaults((current) => ({ ...current, [key]: e.target.value }))} placeholder="Valor padrão (opcional)" />
                    </label>
                  ))
                )}
                {template && usesPhoto(template) && <p className="adm-hint">Este modelo tem foto: você envia uma por pessoa ao emitir.</p>}
              </div>

              {!isNew && issuedCount > 0 && (
                <p className="adm-hint">Este modelo já emitiu {issuedCount} certificado(s). Mudanças de posição e estilo valem também ao baixá-los novamente.</p>
              )}
            </aside>
          )}
        </div>
      )}
    </section>
  );
}
