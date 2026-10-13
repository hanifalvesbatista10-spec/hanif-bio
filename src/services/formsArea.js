// As telas de provas (lista, editor e resultados) servem a duas áreas: o painel do administrador (/admin/formularios) e a área do
// parceiro (/parceiro/provas), onde só aparece o que o próprio parceiro criou. Este gancho diz em qual área a tela está.
import { useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

export function useFormsArea() {
  const { pathname } = useLocation();
  const { user } = useAuth();
  const partner = pathname.startsWith("/parceiro");
  return { partner, base: partner ? "/parceiro/provas" : "/admin/formularios", userId: user?.id || null };
}
