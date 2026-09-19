import { Link } from "react-router-dom";

export default function SiteFooter({ settings }) {
  return (
    <footer className="site-footer">
      <div className="site-container site-footer-grid">
        <div className="site-footer-brand">
          <img src="/assets/logo-ha.png" alt="Hanif Alves" />
          <p>{settings.footer_description}</p>
        </div>
        <div>
          <h4>Navegação</h4>
          <Link to="/">Início</Link>
          <a href="/#produtos">Produtos</a>
          <Link to="/sobre">Sobre</Link>
          <Link to="/conteudos">Conteúdos</Link>
          <a href="/#depoimentos">Depoimentos</a>
        </div>
        <div>
          <h4>Contato</h4>
          {settings.whatsapp_url && <a href={settings.whatsapp_url} target="_blank" rel="noreferrer">WhatsApp</a>}
          {settings.instagram_url && <a href={settings.instagram_url} target="_blank" rel="noreferrer">Instagram</a>}
        </div>
        <div>
          <h4>Acesso</h4>
          <Link to="/login">Área do aluno</Link>
          <Link to="/certificado">Verificar certificado</Link>
          <Link to="/admin/login">Acesso administrativo</Link>
          <p style={{ marginTop: 12 }}>{settings.footer_disclaimer}</p>
        </div>
      </div>
      <div className="site-container site-footer-note">
        <span>{settings.copyright_text}</span>
        <span>Site profissional • Produtos direcionados para checkout externo</span>
      </div>
    </footer>
  );
}
