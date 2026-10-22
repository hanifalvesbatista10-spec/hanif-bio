import { useEffect, useMemo, useRef, useState } from "react";
import { isLiveFresh } from "../../services/lessons";
import { memberIcons as icons } from "./MemberIcons";

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m5 12.5 4.5 4.5L19 7.5" />
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function PdfBadge() {
  return <span className="mb-lesson-type" title="Aula em PDF">PDF</span>;
}

// Menu do curso: módulos que abrem e fecham, contador de aulas concluídas e caixinha de conclusão em cada aula.
// No celular vira uma gaveta ("Aulas") aberta por um botão; no computador fica fixo ao lado da aula.
export default function CoursePlaylist({ groups, activeId, completed, progressAvailable, hold, open, onClose, onPick, onToggle }) {
  const flat = useMemo(() => groups.flatMap((group) => group.lessons), [groups]);
  const total = flat.length;
  const done = flat.filter((lesson) => completed.has(lesson.id)).length;
  const percent = total ? Math.round((done / total) * 100) : 0;
  const closeRef = useRef(null);

  // módulos fechados pelo aluno; por padrão, com poucos módulos tudo aberto, com muitos só o da aula atual
  const moduleCount = groups.filter((group) => group.module).length;
  const activeModuleId = flat.find((lesson) => lesson.id === activeId)?.module_id || null;
  const [collapsed, setCollapsed] = useState(() => new Set());
  const [touched, setTouched] = useState(() => new Set());

  const isOpen = (group) => {
    if (!group.module) return true;
    const id = group.module.id;
    if (touched.has(id)) return !collapsed.has(id);
    return moduleCount <= 3 || id === activeModuleId;
  };

  const toggleModule = (group) => {
    const id = group.module.id;
    const wasOpen = isOpen(group);
    setTouched((current) => new Set(current).add(id));
    setCollapsed((current) => {
      const next = new Set(current);
      if (wasOpen) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  // gaveta do celular: Esc fecha, a página de trás não rola e o foco vai para o botão de fechar
  useEffect(() => {
    if (!open) return undefined;
    const html = document.documentElement;
    html.classList.add("mb-scroll-lock");
    closeRef.current?.focus();
    const onKey = (event) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      html.classList.remove("mb-scroll-lock");
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  return (
    <>
      {open && <div className="mb-drawer-backdrop" aria-hidden="true" onClick={onClose} />}
      <aside className={`mb-playlist${open ? " is-open" : ""}`} aria-label="Conteúdo do curso">
        <div className="mb-playlist-head">
          <h3>Aulas</h3>
          <button ref={closeRef} type="button" className="mb-playlist-close" aria-label="Fechar a lista de aulas" onClick={onClose}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </div>

        {progressAvailable && (
          <div className="mb-progress" role="group" aria-label="Seu progresso no curso">
            <div className="mb-progress-text">
              <strong>{done} de {total} {total === 1 ? "aula concluída" : "aulas concluídas"}</strong>
              <span>{percent}%</span>
            </div>
            <div className="mb-progress-bar" aria-hidden="true"><span style={{ width: `${percent}%` }} /></div>
          </div>
        )}

        <div className="mb-playlist-body">
          {groups.map((group) => {
            const groupDone = group.lessons.filter((lesson) => completed.has(lesson.id)).length;
            const expanded = isOpen(group);
            const key = group.module?.id || "sem-modulo";
            const listId = `mb-mod-${key}`;
            return (
              <section key={key} className="mb-module">
                {group.module && (
                  <button type="button" className="mb-module-head" aria-expanded={expanded} aria-controls={listId} onClick={() => toggleModule(group)}>
                    <span className="mb-module-title">{group.module.title}</span>
                    <span className="mb-module-count">{progressAvailable ? `${groupDone}/${group.lessons.length}` : group.lessons.length}</span>
                    <span className={`mb-module-chevron${expanded ? " is-open" : ""}`}><ChevronIcon /></span>
                  </button>
                )}
                {expanded && (
                  <ol id={listId}>
                    {group.lessons.map((lesson) => {
                      const isActive = lesson.id === activeId;
                      const isDone = completed.has(lesson.id);
                      return (
                        <li key={lesson.id} className={`mb-lesson-row${isActive ? " is-active" : ""}`}>
                          {progressAvailable ? (
                            <button
                              type="button"
                              className={`mb-check${isDone ? " is-done" : ""}`}
                              role="checkbox"
                              aria-checked={isDone}
                              aria-label={`${isDone ? "Desmarcar" : "Marcar como concluída"}: ${lesson.title}`}
                              onClick={() => onToggle(lesson)}
                            >
                              {isDone && <CheckIcon />}
                            </button>
                          ) : (
                            <span className="mb-lesson-num" aria-hidden="true">{isActive ? icons.play : flat.indexOf(lesson) + 1}</span>
                          )}
                          <button
                            type="button"
                            className={`mb-lesson${isActive ? " is-active" : ""}`}
                            aria-current={isActive ? "true" : undefined}
                            onClick={() => onPick(lesson)}
                          >
                            <span className="mb-lesson-text">
                              <strong>{lesson.title}</strong>
                              <span className="mb-lesson-meta">
                                {isLiveFresh(lesson) && <span className="mb-lesson-live"><i /> AO VIVO</span>}
                                {lesson.content_type === "pdf" && <PdfBadge />}
                                {lesson.duration && <small>{lesson.duration}</small>}
                              </span>
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ol>
                )}
              </section>
            );
          })}
        </div>

        {hold && hold.total_lessons > hold.visible_lessons && (
          <div className="mb-lesson-locked">
            <span className="mb-lesson-locked-icon">{icons.lock}</span>
            <span>
              <strong>+{hold.total_lessons - hold.visible_lessons} aula(s) trancada(s)</strong>
              <small>Liberam em {new Date(hold.release_at).toLocaleDateString("pt-BR")}</small>
            </span>
          </div>
        )}
      </aside>
    </>
  );
}
