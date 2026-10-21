import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import "../../styles/row-actions.css";

const MENU_WIDTH = 232;
// Em tela pequena o menu vira uma folha fixa na base da tela (não depende da posição do botão, que pode estar escondido
// na rolagem lateral da tabela). Mantenha igual ao @media do row-actions.css.
const SHEET_QUERY = "(max-width: 640px)";

// Ações de uma linha de tabela: no máximo uma ação principal à vista e o resto no menu "⋯".
// primary: { label, to | href | onClick, disabled }
// items:   [{ label, onClick | to | href, danger, disabled, hidden }]
export default function RowActions({ primary, items = [], label = "Mais ações" }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0, up: false });
  const [sheet, setSheet] = useState(false);
  const sheetRef = useRef(false);
  const buttonRef = useRef(null);
  const menuRef = useRef(null);
  const menuId = useId();
  const visible = items.filter((item) => item && !item.hidden);
  const visibleCount = visible.length;

  const close = useCallback((refocus = false) => {
    setOpen(false);
    if (refocus) buttonRef.current?.focus();
  }, []);

  // Posição fixa (o menu sai da tabela, que tem rolagem própria e cortaria o menu). Se o botão sair de vista, fecha.
  const place = useCallback(() => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    if (rect.bottom < 0 || rect.top > window.innerHeight || rect.right < 0 || rect.left > window.innerWidth) {
      setOpen(false);
      return;
    }
    const height = menuRef.current?.offsetHeight || visibleCount * 44 + 12;
    const up = rect.bottom + height + 12 > window.innerHeight && rect.top > height + 12;
    const left = Math.min(Math.max(8, rect.right - MENU_WIDTH), window.innerWidth - MENU_WIDTH - 8);
    setPos({ top: up ? rect.top - height - 6 : rect.bottom + 6, left, up });
  }, [visibleCount]);

  useLayoutEffect(() => {
    if (!open) return;
    const asSheet = window.matchMedia(SHEET_QUERY).matches;
    sheetRef.current = asSheet;
    setSheet(asSheet);
    if (!asSheet) place();
  }, [open, place]);

  useEffect(() => {
    if (!open) return undefined;
    // preventScroll: focar o primeiro item não pode rolar a página (isso fechava o menu no celular)
    menuRef.current?.querySelector('[role="menuitem"]:not([disabled])')?.focus({ preventScroll: true });
    const onPointer = (event) => {
      if (menuRef.current?.contains(event.target) || buttonRef.current?.contains(event.target)) return;
      // o fundo escurecido da folha fecha no "click" (no JSX), não aqui: fechar no toque deixava o clique cair no botão de baixo
      if (event.target.closest?.(".ra-backdrop")) return;
      close();
    };
    // No computador o menu acompanha o botão quando a página ou a tabela rolam. Na folha do celular, rolagem e mudança de
    // tamanho (a barra de endereço do navegador some e volta) não devem fechar nada.
    let frame = 0;
    const follow = (event) => {
      if (sheetRef.current || menuRef.current?.contains(event?.target)) return;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(place);
    };
    document.addEventListener("pointerdown", onPointer);
    window.addEventListener("resize", follow);
    window.addEventListener("scroll", follow, true);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("pointerdown", onPointer);
      window.removeEventListener("resize", follow);
      window.removeEventListener("scroll", follow, true);
    };
  }, [open, close, place]);

  const onMenuKey = (event) => {
    const entries = [...menuRef.current.querySelectorAll('[role="menuitem"]:not([disabled])')];
    const index = entries.indexOf(document.activeElement);
    if (event.key === "Escape") {
      event.preventDefault();
      close(true);
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      entries[(index + 1) % entries.length]?.focus();
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      entries[(index - 1 + entries.length) % entries.length]?.focus();
    } else if (event.key === "Home") {
      event.preventDefault();
      entries[0]?.focus();
    } else if (event.key === "End") {
      event.preventDefault();
      entries[entries.length - 1]?.focus();
    } else if (event.key === "Tab") {
      close();
    }
  };

  const renderPrimary = () => {
    if (!primary) return null;
    if (primary.to) return <Link className="ra-primary" to={primary.to}>{primary.label}</Link>;
    if (primary.href) return <a className="ra-primary" href={primary.href} target="_blank" rel="noreferrer">{primary.label}</a>;
    return <button type="button" className="ra-primary" onClick={primary.onClick} disabled={primary.disabled}>{primary.label}</button>;
  };

  const renderItem = (item) => {
    const className = `ra-item${item.danger ? " is-danger" : ""}`;
    const run = () => {
      close();
      item.onClick?.();
    };
    if (item.to) {
      return <Link key={item.label} role="menuitem" className={className} to={item.to} onClick={() => close()}>{item.label}</Link>;
    }
    if (item.href) {
      return <a key={item.label} role="menuitem" className={className} href={item.href} target="_blank" rel="noreferrer" onClick={() => close()}>{item.label}</a>;
    }
    return <button key={item.label} type="button" role="menuitem" className={className} disabled={item.disabled} onClick={run}>{item.label}</button>;
  };

  return (
    <div className="ra">
      {renderPrimary()}
      {visible.length > 0 && (
        <>
          <button
            ref={buttonRef}
            type="button"
            className={`ra-trigger${open ? " is-open" : ""}`}
            aria-label={label}
            aria-haspopup="menu"
            aria-expanded={open}
            aria-controls={open ? menuId : undefined}
            onClick={() => setOpen((current) => !current)}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown" && !open) {
                event.preventDefault();
                setOpen(true);
              }
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">
              <circle cx="12" cy="5" r="1.7" />
              <circle cx="12" cy="12" r="1.7" />
              <circle cx="12" cy="19" r="1.7" />
            </svg>
          </button>
          {open &&
            createPortal(
              <>
                {sheet && <div className="ra-backdrop" aria-hidden="true" onClick={() => close(true)} />}
                <div
                  ref={menuRef}
                  id={menuId}
                  role="menu"
                  aria-label={label}
                  className={`ra-menu${pos.up ? " is-up" : ""}`}
                  style={{ top: pos.top, left: pos.left, width: MENU_WIDTH }}
                  onKeyDown={onMenuKey}
                >
                  <div className="ra-sheet-title" aria-hidden="true">{label}</div>
                  {visible.map(renderItem)}
                </div>
              </>,
              document.body
            )}
        </>
      )}
    </div>
  );
}
