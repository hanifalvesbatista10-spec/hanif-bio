import { useEffect } from "react";
import { Link } from "react-router-dom";
import { getProductCheckout } from "../../services/productCheckout";
import "./mentorship.css";

const checkout = getProductCheckout({ slug: "mentoria-aph" });
function Acquire({ children = "Adquirir mentoria", className = "" }) {
  return <a className={`mentor-cta ${className}`} href={checkout}>{children}</a>;
}

export default function MentorshipPage() {
  useEffect(() => {
    window.scrollTo(0, 0);
    const previous = document.title;
    document.title = "Mentoria de APH | Hanif Alves";
    return () => { document.title = previous; };
  }, []);

  return <div className="mentor-page">
    <header className="mentor-header"><div className="mentor-container"><Link className="mentor-brand" to="/">HANIF ALVES<small>APH · URGÊNCIA · EMERGÊNCIA</small></Link><Acquire>Adquirir</Acquire></div></header>
    <main>
      <section className="mentor-hero"><div className="mentor-container mentor-columns">
        <div><p className="mentor-eyebrow">MENTORIA DE APH</p><h1>Seu próximo passo no estudo do atendimento pré-hospitalar.</h1><p className="mentor-lead">Conheça a Mentoria de APH com Hanif Alves, profissional com 10 anos de linha de frente em urgências e emergências.</p><div className="mentor-actions"><Acquire /><a className="mentor-secondary" href="#sobre">Conhecer o mentor ↓</a></div><p className="mentor-note">Confira os detalhes da oferta, o valor e as condições de pagamento na Kiwify.</p></div>
        <figure><img src="/assets/hanif-hero.png" alt="Hanif Alves, mentor de APH" /><figcaption><strong>Hanif Alves</strong><span>Técnico de Enfermagem Socorrista – SAMU CE 192</span></figcaption></figure>
      </div></section>
      <section className="mentor-section"><div className="mentor-container"><p className="mentor-eyebrow">UM NOVO PASSO NA SUA FORMAÇÃO</p><h2>Quer dar mais atenção ao seu desenvolvimento em APH?</h2><p className="mentor-copy">Se o atendimento pré-hospitalar faz parte dos seus estudos ou da sua trajetória profissional, conheça a proposta da mentoria e avalie se ela se conecta ao seu momento.</p><div className="mentor-grid"><article><span>01</span><h3>Conheça o mentor</h3><p>Veja a trajetória profissional de Hanif Alves antes de decidir.</p></article><article><span>02</span><h3>Confira a oferta</h3><p>Consulte as informações da mentoria e as condições apresentadas no checkout.</p></article><article><span>03</span><h3>Dê o próximo passo</h3><p>Quando estiver pronto, conclua sua aquisição diretamente pela Kiwify.</p></article></div></div></section>
      <section className="mentor-section mentor-about" id="sobre"><div className="mentor-container mentor-columns"><div><p className="mentor-eyebrow">SOBRE O MENTOR</p><h2>Hanif Alves</h2><p className="mentor-copy">10 anos de linha de frente em urgências e emergências.</p><Acquire>Quero adquirir a mentoria</Acquire></div><ul className="mentor-credentials"><li>Técnico de Enfermagem Socorrista – SAMU CE 192</li><li>Instrumentador Cirúrgico – HRC</li><li>Instrutor APH – SAB</li><li>Analista de Dados</li></ul></div></section>
      <section className="mentor-section"><div className="mentor-container"><p className="mentor-eyebrow">ANTES DE ADQUIRIR</p><h2>Dúvidas frequentes</h2><div className="mentor-faq"><details><summary>Onde faço a compra?</summary><p>Os botões “Adquirir” desta página levam diretamente ao checkout da Mentoria de APH na Kiwify.</p></details><details><summary>Onde vejo o valor e o que está incluído?</summary><p>Confira as informações da oferta e as condições de pagamento na Kiwify antes de concluir sua aquisição.</p></details><details><summary>Como encontro as orientações após a compra?</summary><p>Confira as mensagens enviadas ao e-mail utilizado na compra, incluindo spam e promoções, e siga as instruções de acesso recebidas.</p></details></div></div></section>
      <section className="mentor-final"><div className="mentor-container"><p className="mentor-eyebrow">MENTORIA DE APH · HANIF ALVES</p><h2>Pronto para dar o próximo passo?</h2><p>Consulte a oferta e adquira sua mentoria pela Kiwify.</p><Acquire>Adquirir na Kiwify</Acquire></div></section>
    </main><footer className="mentor-footer"><Link to="/">← Voltar para a bio</Link><p>Hanif Alves · Mentoria de APH</p></footer>
    <div className="mentor-mobile"><Acquire /></div>
  </div>;
}
