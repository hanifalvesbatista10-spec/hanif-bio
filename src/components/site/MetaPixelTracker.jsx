import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { getConsent } from "../../services/consent";
import { isMetaPixelLoaded, loadMetaPixel, trackPageView } from "../../services/metaPixel";

// O site é uma página só que troca de tela sem recarregar, então o PageView precisa ser disparado a cada troca de rota.
// Na primeira tela, o Pixel carrega aqui se o visitante já tinha aceitado os cookies de anúncios; quem aceita agora
// no banner tem o Pixel carregado na hora (consent.js), com o PageView da tela atual.
export default function MetaPixelTracker() {
  const { pathname } = useLocation();
  const lastPath = useRef(null);

  useEffect(() => {
    if (lastPath.current === pathname) return; // não repete a mesma tela (o React roda o efeito duas vezes em desenvolvimento)
    lastPath.current = pathname;
    if (isMetaPixelLoaded()) trackPageView();
    else if (getConsent()?.marketing) loadMetaPixel(); // já dispara o PageView desta tela
  }, [pathname]);

  return null;
}
