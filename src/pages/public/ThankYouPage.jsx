import { useEffect } from "react";
import { Link } from "react-router-dom";
import "./thank-you.css";

export default function ThankYouPage() {
  useEffect(() => {
    window.scrollTo(0, 0);
    const previousTitle = document.title;
    document.title = "Obrigado | Mentoria de APH – Hanif Alves";
    const robots = document.createElement("meta");
    robots.name = "robots";
    robots.content = "noindex, nofollow";
    document.head.appendChild(robots);
    return () => { document.title = previousTitle; robots.remove(); };
  }, []);

  return <div className="thanks-page">
    <header className="thanks-header"><Link to="/">HANIF ALVES <span>APH · URGÊNCIA · EMERGÊNCIA</span></Link></header>
    <main className="thanks-shell">
      <div className="thanks-symbol" aria-hidden="true">♡</div>
      <p className="thanks-eyebrow">MENTORIA DE APH</p>
      <h1>Obrigado por escolher a Mentoria de APH.</h1>
      <p className="thanks-lead">Confira os próximos passos para encontrar as orientações de acesso à sua mentoria.</p>
      <a className="thanks-button" href="https://dashboard.kiwify.com.br/courses">Acessar meus cursos na Kiwify</a>
      <p className="thanks-note">Use o mesmo e-mail informado na compra.</p>
      <section className="thanks-steps" aria-label="Próximos passos">
        <article><span>01</span><h2>Confira seu e-mail</h2><p>Procure a mensagem da Kiwify com as informações da compra. Confira também as pastas de spam e promoções.</p></article>
        <article><span>02</span><h2>Confira o pagamento</h2><p>A liberação do conteúdo depende da confirmação do pagamento pela Kiwify. Consulte o status na plataforma.</p></article>
        <article><span>03</span><h2>Acesse o conteúdo</h2><p>Siga as instruções enviadas pela Kiwify ou abra “Meus cursos” com o e-mail usado no pedido.</p></article>
      </section>
      <section className="thanks-help"><h2>Não encontrou o acesso?</h2><p>Verifique o e-mail utilizado no pedido e o status do pagamento. Se precisar de ajuda, consulte o atendimento da Kiwify.</p><a href="https://ajuda.kiwify.com.br/pt-br/">Abrir a Central de Ajuda da Kiwify →</a></section>
      <p className="thanks-signature">Bons estudos!<br/><strong>Hanif Alves</strong></p>
      <Link className="thanks-back" to="/">← Voltar para a bio</Link>
    </main>
    <footer className="thanks-footer">Esta página orienta os próximos passos e não é um comprovante de pagamento. A confirmação e o acesso são gerenciados pela Kiwify.</footer>
  </div>;
}
