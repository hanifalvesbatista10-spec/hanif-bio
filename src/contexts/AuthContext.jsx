import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../services/supabase";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [profileError, setProfileError] = useState("");
  const [sessionLoading, setSessionLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);
  const lastProfileUser = useRef(null);

  const loadProfile = async (userId) => {
    if (!userId) {
      setProfile(null);
      setProfileError("");
      lastProfileUser.current = null;
      return null;
    }

    // recarga em segundo plano (mesmo usuário, perfil já carregado) não pode derrubar a tela com "Validando acesso..."
    const silent = lastProfileUser.current === userId;
    if (!silent) setProfileLoading(true);
    const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
    if (!silent) setProfileLoading(false);

    if (error || !data) {
      console.error("Erro ao carregar perfil:", error?.message || "perfil não encontrado");
      setProfile(null);
      // conta existe no login, mas o perfil não veio: a tela mostra opção de tentar de novo ou sair
      setProfileError(error ? "Não foi possível carregar os dados da sua conta agora." : "Não encontramos o perfil desta conta.");
      lastProfileUser.current = null;
      return null;
    }

    setProfileError("");
    setProfile(data);
    lastProfileUser.current = userId;
    return data;
  };

  useEffect(() => {
    let active = true;

    const start = async () => {
      const { data } = await supabase.auth.getSession();
      if (!active) return;
      setSession(data.session ?? null);
      if (data.session?.user) await loadProfile(data.session.user.id);
      if (active) setSessionLoading(false);
    };

    start();

    // Importante: não chamar o Supabase (await) direto dentro deste callback. Ele roda dentro de um bloqueio
    // interno do supabase-js e chamadas ali podem travar o login; por isso o perfil é carregado em seguida (setTimeout).
    const { data: listener } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!active) return;
      setSession(nextSession ?? null);
      if (!nextSession?.user) {
        setProfile(null);
        setProfileError("");
        lastProfileUser.current = null;
        setSessionLoading(false);
        return;
      }
      // renovações de token não precisam recarregar o perfil
      if (event === "TOKEN_REFRESHED" && lastProfileUser.current === nextSession.user.id) return;
      window.setTimeout(async () => {
        if (!active) return;
        await loadProfile(nextSession.user.id);
        if (active) setSessionLoading(false);
      }, 0);
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo(
    () => ({
      session,
      user: session?.user ?? null,
      profile,
      profileError,
      loading: sessionLoading || profileLoading,
      isAdmin: profile?.role === "admin",
      isBlocked: profile?.account_status === "blocked",
      refreshProfile: () => loadProfile(session?.user?.id),
      signOut: () => supabase.auth.signOut(),
      // encerra a sessão em todos os aparelhos (útil se a senha vazou ou o celular foi perdido)
      signOutEverywhere: () => supabase.auth.signOut({ scope: "global" }),
    }),
    [session, profile, profileError, sessionLoading, profileLoading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth precisa estar dentro de AuthProvider");
  return context;
}
