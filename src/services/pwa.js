// PWA: registra o service worker e controla o botão "Instalar aplicativo".
let deferredPrompt = null;
const listeners = new Set();
const notify = () => listeners.forEach((listener) => listener());

export function isStandalone() {
  if (typeof window === "undefined") return false;
  return window.matchMedia?.("(display-mode: standalone)").matches || window.navigator.standalone === true;
}

export function isIos() {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream;
}

// Android/Chrome: o navegador avisa que dá para instalar. iPhone não avisa, então mostramos o passo a passo.
export function canInstall() {
  if (isStandalone()) return false;
  return Boolean(deferredPrompt) || isIos();
}

export async function promptInstall() {
  if (deferredPrompt) {
    const event = deferredPrompt;
    deferredPrompt = null;
    notify();
    event.prompt();
    await event.userChoice.catch(() => null);
    return "prompted";
  }
  if (isIos()) {
    window.alert("No Safari, toque em Compartilhar (o quadrado com a seta) e depois em \"Adicionar à Tela de Início\".");
    return "ios";
  }
  return "unavailable";
}

export function subscribeInstall(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function initPwa() {
  if (typeof window === "undefined") return;

  // o aviso de instalação pode chegar antes do React montar, por isso é capturado aqui
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredPrompt = event;
    notify();
  });
  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    notify();
  });

  if (import.meta.env.PROD && "serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
        /* sem service worker o site continua normal, só não instala */
      });
    });
  }
}
