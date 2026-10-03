import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../services/supabase";
import { safeUrl } from "../../services/radar";
import SiteHeader from "../../components/layout/SiteHeader";
import SiteFooter from "../../components/layout/SiteFooter";
import "./ConversionHomePage.css";

const fallbackSettings = {
  hero_primary_label: "Conhecer treinamentos",
  whatsapp_url: "https://wa.me/5588993765491",
  instagram_url: "",
  footer_description: "Educação aplicada à tomada de decisão em situações críticas.",
  footer_disclaimer: "Conteúdo educacional. A aplicação prática deve respeitar protocolos, legislação e atribuições profissionais vigentes.",
  copyright_text: "© 2026 Hanif Alves. Todos os direitos reservados.",
};

const UPDATED = "3 de outubro de 2026";

// Serviços que recebem dados para o site funcionar. Mantenha esta lista igual ao que o projeto realmente usa.
const PROCESSORS = [
  ["Supabase", "banco de dados e login (servidor no Canadá)"],
  ["Vercel", "hospedagem do site (servidores nos Estados Unidos)"],
  ["InfinitePay e Asaas", "processamento dos pagamentos"],
  ["Resend", "envio de e-mails, como os lembretes de compra não finalizada"],
  ["Mux", "exibição protegida das videoaulas"],
  ["Cloudflare", "armazenamento dos arquivos para download"],
  ["Daily.co", "encontros ao vivo na área de membros"],
  ["Telegram", "avisos internos ao responsável pelo site, que incluem nome, WhatsApp e e-mail de novos cadastros"],
  ["Google (Google Ads)", "medição de resultados de anúncios, somente se você aceitar os cookies de anúncios"],
];

const linkStyle = { color: "#ff9aa8", textDecoration: "underline", textUnderlineOffset: 3 };
const h2Style = { margin: "34px 0 10px", fontSize: "1.35rem", fontFamily: "var(--font-display)", color: "#fff" };
const pStyle = { margin: "0 0 12px", color: "var(--brand-text-soft)", lineHeight: 1.75 };
const listStyle = { margin: "0 0 12px", paddingLeft: 22, color: "var(--brand-text-soft)", lineHeight: 1.8 };

export default function PrivacyPage() {
  const [settings, setSettings] = useState(fallbackSettings);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
    document.title = "Política de privacidade | Hanif Alves";
    supabase.from("site_settings").select("*").eq("id", 1).maybeSingle().then(({ data }) => {
      if (data) setSettings((current) => ({ ...current, ...data }));
    });
  }, []);

  const contact = safeUrl(settings.whatsapp_url);
  const email = String(settings.contact_email || "").trim();
  const contactEmail = /^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']+$/.test(email) ? email : "";
  const contactLinks = (
    <>
      {contact ? <a href={contact} target="_blank" rel="noopener noreferrer" style={linkStyle}>WhatsApp do site</a> : "WhatsApp do site"}
      {contactEmail && <> ou pelo e-mail <a href={`mailto:${contactEmail}`} style={linkStyle}>{contactEmail}</a></>}
    </>
  );

  return (
    <div className="site-page">
      <SiteHeader primaryLabel={settings.hero_primary_label || "Ver treinamentos"} />
      <section className="site-section alt" style={{ paddingTop: "calc(var(--header-h) + 40px)" }}>
        <article className="site-container" style={{ maxWidth: 820 }}>
          <span className="site-eyebrow">PRIVACIDADE</span>
          <h1 style={{ margin: "8px 0 8px", fontSize: "clamp(1.9rem,4.5vw,2.8rem)", lineHeight: 1.1, fontFamily: "var(--font-display)" }}>Política de privacidade</h1>
          <p style={{ ...pStyle, fontSize: ".9rem" }}>Última atualização: {UPDATED}.</p>
          <p style={pStyle}>
            Esta página explica, em linguagem simples, quais dados pessoais o site <strong>www.aphhardcore.com</strong> coleta, para que usa, com quem
            divide e como você pode controlar tudo isso, conforme a Lei Geral de Proteção de Dados (LGPD, Lei 13.709/2018).
          </p>

          <h2 style={h2Style}>1. Quem é o responsável</h2>
          <p style={pStyle}>
            O responsável pelo tratamento dos seus dados é <strong>Hanif Alves</strong>, instrutor de APH e titular deste site. Para qualquer assunto
            sobre seus dados, fale conosco pelo{" "}
            {contactLinks}.
          </p>

          <h2 style={h2Style}>2. Quais dados coletamos e quando</h2>
          <ul style={listStyle}>
            <li><strong>Cadastro no Radar de Evidências:</strong> nome, WhatsApp, e-mail, data e hora da sua autorização e qual análise você abriu.</li>
            <li><strong>Conta de aluno:</strong> nome, e-mail e senha (a senha fica protegida pelo serviço de login e não é lida por nós), mais telefone e CPF se você informar no perfil. Dentro da área de membros registramos seu progresso, provas e atividades, comentários e certificados.</li>
            <li><strong>Compras:</strong> nome, e-mail, CPF, telefone, produto, valor, forma de pagamento e situação do pedido. Os dados do seu cartão são digitados na página do processador de pagamento e <strong>não passam nem ficam guardados no nosso site</strong>.</li>
            <li><strong>Inscrições em eventos e programa de afiliados:</strong> os dados que você preenche no formulário, como nome, contato, cidade, ocupação e, no caso de afiliados, a chave Pix para pagamento de comissões.</li>
            <li><strong>Depoimentos e comentários:</strong> o texto que você enviar e o nome que acompanha.</li>
            <li><strong>Dados de navegação:</strong> informações técnicas como endereço IP, tipo de aparelho e páginas acessadas, geradas pela hospedagem e, se você aceitar os cookies de anúncios, pela etiqueta do Google.</li>
          </ul>

          <h2 style={h2Style}>3. Para que usamos seus dados</h2>
          <ul style={listStyle}>
            <li>liberar a leitura das análises do Radar e enviar o convite para a comunidade APH Hardcore e outros conteúdos de APH (com a sua autorização);</li>
            <li>criar sua conta, entregar os cursos, emitir certificados e dar suporte;</li>
            <li>processar pagamentos, liberar o acesso após a confirmação e cumprir obrigações fiscais e legais;</li>
            <li>enviar lembretes de compra não finalizada, quando você iniciou um pedido;</li>
            <li>manter a segurança do site e prevenir fraudes;</li>
            <li>medir os resultados dos nossos anúncios.</li>
          </ul>
          <p style={pStyle}>
            As bases legais usadas são o seu consentimento (por exemplo, no cadastro do Radar), a execução do contrato (compras e acesso aos
            cursos), o cumprimento de obrigações legais e o legítimo interesse (segurança e prevenção a fraudes).
          </p>

          <h2 style={h2Style}>4. Com quem compartilhamos</h2>
          <p style={pStyle}>Não vendemos seus dados. Eles são repassados apenas aos serviços que o site precisa para funcionar:</p>
          <ul style={listStyle}>
            {PROCESSORS.map(([name, what]) => (
              <li key={name}><strong>{name}</strong>: {what}.</li>
            ))}
          </ul>
          <p style={pStyle}>
            Alguns desses serviços ficam em outros países, como Estados Unidos e Canadá. Nesses casos, os dados são enviados ao exterior apenas para
            o funcionamento do site, com os serviços escolhidos pelo responsável. Também podemos informar dados a autoridades quando a lei exigir.
          </p>

          <h2 style={h2Style}>5. Cookies e armazenamento no navegador</h2>
          <ul style={listStyle}>
            <li><strong>Sessão de login:</strong> mantém você conectado na área de membros.</li>
            <li><strong>Cadastro do Radar:</strong> guardamos no seu navegador o nome, o e-mail e o WhatsApp que você informou, para não pedir de novo nas próximas visitas.</li>
            <li><strong>Preferências do app:</strong> por exemplo, se você escondeu o aviso de instalação.</li>
            <li><strong>Google Ads (só se você aceitar):</strong> se você aceitar no aviso de cookies, a etiqueta do Google grava cookies para medir se um anúncio levou a uma compra. Sem a sua permissão ela não é carregada. Você pode mudar a escolha a qualquer momento em “Preferências de cookies”, no rodapé do site.</li>
          </ul>
          <p style={pStyle}>
            Você pode apagar os dados guardados no navegador e bloquear cookies de terceiros a qualquer momento nas configurações dele. Se fizer isso, o
            site pode pedir seu cadastro de novo e algumas funções podem deixar de funcionar.
          </p>

          <h2 style={h2Style}>6. Por quanto tempo guardamos</h2>
          <p style={pStyle}>
            Guardamos seus dados pelo tempo necessário para cumprir as finalidades acima. Registros de compra são mantidos pelo prazo exigido pela
            legislação fiscal. Os demais dados, como o cadastro do Radar, ficam conosco até você pedir a exclusão ou retirar sua autorização.
          </p>

          <h2 style={h2Style}>7. Seus direitos</h2>
          <p style={pStyle}>A LGPD garante que você pode, a qualquer momento e gratuitamente:</p>
          <ul style={listStyle}>
            <li>confirmar se tratamos seus dados e ter acesso a eles;</li>
            <li>corrigir dados incompletos, errados ou desatualizados;</li>
            <li>pedir a anonimização, o bloqueio ou a exclusão de dados desnecessários ou tratados em desacordo com a lei;</li>
            <li>pedir a portabilidade dos dados;</li>
            <li>saber com quem compartilhamos seus dados;</li>
            <li>retirar a autorização que deu, por exemplo para parar de receber os conteúdos e o convite da comunidade.</li>
          </ul>
          <p style={pStyle}>
            Para exercer qualquer um desses direitos, fale conosco pelo{" "}
            {contactLinks}.
            Se achar que algo não foi resolvido, você também pode recorrer à Autoridade Nacional de Proteção de Dados (ANPD).
          </p>

          <h2 style={h2Style}>8. Segurança</h2>
          <p style={pStyle}>
            O site usa conexão criptografada (HTTPS), o banco de dados tem regras de acesso para que cada pessoa veja apenas o que lhe pertence e o
            painel de administração é restrito. Nenhum sistema é 100% seguro, mas trabalhamos para proteger seus dados e corrigir falhas quando as encontramos.
          </p>

          <h2 style={h2Style}>9. Menores de idade</h2>
          <p style={pStyle}>O site é voltado a profissionais e estudantes da saúde e não coleta dados de crianças de propósito.</p>

          <h2 style={h2Style}>10. Mudanças nesta política</h2>
          <p style={pStyle}>
            Podemos atualizar esta página quando o site mudar ou a lei exigir. A data da última atualização fica no topo. Quando a mudança for
            relevante, avisaremos pelos nossos canais.
          </p>

          <p style={{ marginTop: 34 }}><Link className="site-about-link" to="/">← Voltar ao site</Link></p>
        </article>
      </section>
      <SiteFooter settings={settings} />
    </div>
  );
}
