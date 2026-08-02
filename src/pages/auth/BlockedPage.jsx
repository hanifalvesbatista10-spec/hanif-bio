import { Link } from "react-router-dom";
export default function BlockedPage(){return <div className="auth-page"><div className="auth-card"><span className="auth-kicker">ACESSO SUSPENSO</span><h1>Conta bloqueada</h1><p>Esta conta está temporariamente bloqueada. Entre em contato com o administrador.</p><Link className="auth-primary link-button" to="/">Voltar ao site</Link></div></div>}
