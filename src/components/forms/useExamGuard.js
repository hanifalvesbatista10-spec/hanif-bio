import { useCallback, useEffect, useRef, useState } from "react";

// Modo prova: detecta quando a pessoa sai da tela da prova (troca de aba ou de app, minimiza, perde o foco) e conta as saídas.
// O navegador não permite impedir a saída, só detectar: o site avisa, registra e, ao chegar no limite, encerra e envia a prova.
// Saída de menos de 2 segundos não conta (notificação que passa, barra do sistema).
// Recarregar ou fechar e reabrir a página no meio da prova também conta como uma saída (senão bastaria recarregar para fugir da conta).
const MIN_AWAY_MS = 2000;
const CHECK_EVERY_MS = 500;

const storeKey = (key) => `fx-exam-${key}`;

function readStore(key) {
  try {
    const data = JSON.parse(window.localStorage.getItem(storeKey(key)) || "null");
    return data && typeof data === "object" ? data : null;
  } catch {
    return null;
  }
}

function writeStore(key, data) {
  try {
    window.localStorage.setItem(storeKey(key), JSON.stringify(data));
  } catch {
    /* sem armazenamento: a contagem continua só nesta página */
  }
}

const fresh = () => ({ exits: 0, away_seconds: 0, events: [], started: Date.now(), unloaded: false });

// Tela cheia no computador (no celular não ajuda). Precisa ser chamada de um clique do usuário.
export function enterExamFullscreen() {
  try {
    if (window.matchMedia?.("(pointer: coarse)").matches) return;
    document.documentElement.requestFullscreen?.().catch(() => {});
  } catch {
    /* sem tela cheia: segue normal */
  }
}

export function leaveExamFullscreen() {
  try {
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
  } catch {
    /* ignora */
  }
}

export default function useExamGuard({ enabled, storageKey, maxExits, onLimit }) {
  const [overlay, setOverlay] = useState(null); // null | { reached: boolean }
  const [exits, setExits] = useState(0);
  const dataRef = useRef(fresh());
  const awayStartRef = useRef(null);
  const suppressUntilRef = useRef(0);
  const finishedRef = useRef(false);
  const onLimitRef = useRef(onLimit);
  onLimitRef.current = onLimit;

  const limit = Math.max(1, Number(maxExits) || 3);

  const persist = useCallback(() => {
    if (storageKey) writeStore(storageKey, dataRef.current);
  }, [storageKey]);

  // abre: retoma a contagem guardada (e conta a recarga como saída)
  useEffect(() => {
    if (!enabled || !storageKey) return undefined;
    finishedRef.current = false;
    const saved = readStore(storageKey);
    dataRef.current = saved ? { ...fresh(), ...saved } : fresh();
    if (saved?.unloaded) {
      const data = dataRef.current;
      data.unloaded = false;
      data.exits += 1;
      data.events = [...data.events, [Math.round((Date.now() - data.started) / 1000), 0]].slice(-30);
      persist();
      setExits(data.exits);
      const reached = data.exits >= limit;
      setOverlay({ reached });
      if (reached) onLimitRef.current?.();
    } else {
      persist();
      setExits(dataRef.current.exits);
    }
    return undefined;
  }, [enabled, storageKey, limit, persist]);

  const registerExit = useCallback(
    (awayMs) => {
      const data = dataRef.current;
      data.exits += 1;
      data.away_seconds += Math.round(awayMs / 1000);
      data.events = [...data.events, [Math.round((Date.now() - data.started) / 1000), Math.round(awayMs / 1000)]].slice(-30);
      persist();
      setExits(data.exits);
      const reached = data.exits >= limit;
      setOverlay({ reached });
      if (reached) onLimitRef.current?.();
    },
    [limit, persist]
  );

  // vigia a tela
  useEffect(() => {
    if (!enabled) return undefined;
    const check = () => {
      if (finishedRef.current) return;
      const away = document.visibilityState === "hidden" || !document.hasFocus();
      if (away && awayStartRef.current === null) {
        if (Date.now() < suppressUntilRef.current) return;
        awayStartRef.current = Date.now();
      } else if (!away && awayStartRef.current !== null) {
        const awayMs = Date.now() - awayStartRef.current;
        awayStartRef.current = null;
        if (awayMs >= MIN_AWAY_MS) registerExit(awayMs);
      }
    };
    const timer = window.setInterval(check, CHECK_EVERY_MS);
    document.addEventListener("visibilitychange", check);
    window.addEventListener("blur", check);
    window.addEventListener("focus", check);
    // recarregar ou fechar: na volta conta como saída
    const markUnload = () => {
      if (finishedRef.current) return;
      dataRef.current.unloaded = true;
      persist();
    };
    window.addEventListener("beforeunload", markUnload);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", check);
      window.removeEventListener("blur", check);
      window.removeEventListener("focus", check);
      window.removeEventListener("beforeunload", markUnload);
    };
  }, [enabled, registerExit, persist]);

  // pausa a vigília por um tempo (seletor de arquivo e caixas de confirmação tiram o foco da página sem ser uma fuga)
  const suppress = useCallback((ms) => {
    suppressUntilRef.current = ms > 0 ? Date.now() + ms : 0;
  }, []);

  const dismiss = useCallback(() => setOverlay(null), []);

  // números para gravar junto com o envio
  const snapshot = useCallback((endedByExits = false) => {
    const { exits: total, away_seconds, events } = dataRef.current;
    return { exits: total, away_seconds, events, ended_by_exits: Boolean(endedByExits) || total >= limit };
  }, [limit]);

  // prova enviada: apaga a contagem guardada e deixa de vigiar
  const finish = useCallback(() => {
    finishedRef.current = true;
    try {
      if (storageKey) window.localStorage.removeItem(storeKey(storageKey));
    } catch {
      /* ignora */
    }
    leaveExamFullscreen();
  }, [storageKey]);

  return { exits, limit, overlay, dismiss, suppress, snapshot, finish };
}
