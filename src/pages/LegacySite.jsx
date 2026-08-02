import { useEffect, useMemo, useState } from "react";
import "../styles.css";

const PHONE = "5588993765491";
const COMMUNITY_URL = "https://chat.whatsapp.com/BkIqczjJ3Uv2AitaIRp4q4";
const EBOOK_URL = "https://hotm.io/4PuWDB";
const EBOOK_CHECKOUT_URL = "https://pay.hotmart.com/C106390978R?checkoutMode=2";
const LOGO_DATA = "data:image/png;base64,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";

const makeWhatsapp = (product) => {
  const text = product
    ? `Olá, Hanif! Acessei seu site e tenho interesse em ${product}. Gostaria de receber mais informações.`
    : "Olá, Hanif! Vim pelo seu site e quero saber mais sobre seus projetos em APH.";
  return `https://wa.me/${PHONE}?text=${encodeURIComponent(text)}`;
};

const expertise = [
  ["🚑", "Atendimento Pré-Hospitalar", "Avaliação inicial, prioridades, trauma e segurança no atendimento."],
  ["🩺", "Urgência e Emergência", "10 anos na linha de frente das urgências e emergências."],
  ["🎓", "Educação em Saúde", "Aulas, mentorias e materiais para estudantes e profissionais."],
  ["📚", "Base Científica", "Literaturas reconhecidas, protocolos e evidências científicas."],
];

// Adicione somente depoimentos reais aqui. A página não inventa avaliações.
const testimonials = [];

const commonObjections = [
  ["Sou estudante. Isso é para mim?", "Sim. Os produtos foram estruturados para estudantes e profissionais da saúde que desejam ingressar, revisar ou aprofundar conhecimentos em urgência e emergência."],
  ["A mentoria é prática?", "Não. A Mentoria APH é teórica e estratégica. Ela organiza fundamentos, prioridades e raciocínio, sem substituir treinamentos práticos obrigatórios."],
  ["O conteúdo substitui uma formação profissional?", "Não. Todo o conteúdo é complementar e respeita os limites legais, protocolos institucionais e exigências de formação."],
  ["Posso falar antes de comprar?", "Sim. Os botões de WhatsApp já identificam o produto de interesse e abrem uma mensagem direta para Hanif."],
];

const products = [
  {
    id: "mentoria",
    badge: "MENTORIA APH",
    eyebrow: "FORMAÇÃO TEÓRICA E ESTRATÉGICA",
    title: "Mentoria APH",
    short: "Preparação direcionada para quem deseja ingressar ou evoluir na urgência e emergência.",
    image: "/assets/mentoria-aph.png",
    headline: "Construa uma base sólida para atuar com mais segurança no APH.",
    lead: "Uma mentoria para profissionais e estudantes da saúde que precisam organizar conhecimentos, compreender prioridades e desenvolver raciocínio para a realidade da urgência e emergência.",
    promise: "Mais clareza para estudar, compreender condutas e se preparar para os desafios do atendimento pré-hospitalar.",
    palette: {
      primary: "#d6152d",
      secondary: "#071426",
      accent: "#ff4156",
      surface: "#0c1d31",
      soft: "#f6f8fb",
    },
    facts: [
      ["Formato", "Mentoria teórica e estratégica"],
      ["Público", "Profissionais e estudantes da saúde"],
      ["Base", "Literaturas, protocolos e evidências"],
    ],
    audience: [
      "Estudantes que desejam conhecer melhor a urgência e emergência",
      "Profissionais que pretendem ingressar em serviços de APH",
      "Profissionais que desejam revisar e aprofundar conhecimentos",
    ],
    deliverables: [
      ["Fundamentos do APH", "Organização do atendimento, segurança da cena e prioridades."],
      ["Avaliação inicial", "Raciocínio sistematizado para reconhecer ameaças imediatas à vida."],
      ["Trauma e hemorragias", "Princípios de reconhecimento, prioridade e controle inicial."],
      ["Urgências clínicas", "Sinais de gravidade e organização da tomada de decisão."],
      ["Imobilizações", "Indicações, limitações e prevenção de condutas inadequadas."],
      ["Erros frequentes", "Falhas comuns e estratégias para uma atuação mais segura."],
    ],
    primaryLabel: "Quero informações sobre a mentoria",
    primaryUrl: makeWhatsapp("Mentoria APH"),
    secondaryLabel: null,
    secondaryUrl: null,
    note: "A mentoria é educacional e teórica. Não substitui formação profissional, treinamentos práticos obrigatórios ou protocolos institucionais.",
  },
  {
    id: "ebook",
    badge: "E-BOOK",
    eyebrow: "CONTROLE DE HEMORRAGIAS E IMOBILIZAÇÕES",
    title: "Controle de Hemorragias e Imobilizações",
    short: "Conteúdo objetivo para estudar fundamentos essenciais do trauma e do atendimento inicial.",
    image: "/assets/ebook-hemorragias.png",
    headline: "Aprenda os fundamentos que ajudam a reconhecer e controlar situações críticas.",
    lead: "Um material direto, visual e organizado para facilitar o estudo sobre controle de hemorragias e imobilizações no atendimento pré-hospitalar.",
    promise: "Um guia de consulta e revisão para estudar com mais clareza, sequência e segurança.",
    palette: {
      primary: "#c81024",
      secondary: "#07162c",
      accent: "#e72335",
      surface: "#ffffff",
      soft: "#f3f5f8",
    },
    facts: [
      ["Formato", "E-book digital"],
      ["Acesso", "Imediato após a compra"],
      ["Conteúdo", "Objetivo, visual e fundamentado"],
    ],
    audience: [
      "Estudantes da área da saúde",
      "Técnicos de enfermagem e socorristas",
      "Profissionais que desejam revisar fundamentos do trauma",
    ],
    deliverables: [
      ["Controle de hemorragias", "Princípios, prioridades e métodos de controle inicial."],
      ["Reconhecimento da gravidade", "Sinais importantes e fatores que exigem atenção imediata."],
      ["Imobilizações", "Fundamentos, indicações e cuidados no atendimento inicial."],
      ["Erros comuns", "Condutas inadequadas que podem comprometer a segurança."],
      ["Organização didática", "Conteúdo dividido para facilitar leitura, estudo e revisão."],
      ["Base científica", "Informações apoiadas em referências e evidências reconhecidas."],
    ],
    primaryLabel: "Comprar com 1 clique",
    primaryUrl: EBOOK_CHECKOUT_URL,
    secondaryLabel: "Ver página do produto",
    secondaryUrl: EBOOK_URL,
    note: "Material educacional complementar. Não substitui treinamento prático, formação profissional ou protocolo institucional.",
  },
  {
    id: "comunidade",
    badge: "COMUNIDADE APH",
    eyebrow: "ATUALIZAÇÃO E CONEXÃO PROFISSIONAL",
    title: "Comunidade APH",
    short: "Um ambiente para acompanhar conteúdos, atualizações e oportunidades na área.",
    image: "/assets/comunidade-aph.png",
    headline: "Conecte-se com pessoas que também levam o APH a sério.",
    lead: "Uma comunidade voltada para profissionais e estudantes da saúde que desejam acompanhar conteúdos, novidades, materiais e oportunidades relacionadas à urgência e emergência.",
    promise: "Acesso direto a um ambiente de atualização, troca e desenvolvimento profissional.",
    palette: {
      primary: "#c9132b",
      secondary: "#050b15",
      accent: "#ff334a",
      surface: "#0b1625",
      soft: "#eef2f6",
    },
    facts: [
      ["Acesso", "Direto pelo WhatsApp"],
      ["Público", "Profissionais e estudantes da saúde"],
      ["Objetivo", "Atualização e fortalecimento profissional"],
    ],
    audience: [
      "Estudantes interessados em APH",
      "Profissionais da urgência e emergência",
      "Pessoas que desejam acompanhar novos conteúdos e projetos",
    ],
    deliverables: [
      ["Conteúdos exclusivos", "Materiais, orientações e publicações direcionadas à área."],
      ["Atualizações", "Novidades, turmas, eventos e oportunidades."],
      ["Troca de experiências", "Contato com pessoas que compartilham o mesmo interesse profissional."],
      ["Avisos em primeira mão", "Informações sobre novos projetos, mentorias e produtos."],
      ["Desenvolvimento contínuo", "Estímulo ao estudo e à evolução profissional."],
      ["Acesso simples", "Entrada direta pelo grupo oficial no WhatsApp."],
    ],
    primaryLabel: "Entrar na Comunidade APH",
    primaryUrl: COMMUNITY_URL,
    secondaryLabel: "Falar com Hanif",
    secondaryUrl: makeWhatsapp("Comunidade APH"),
    note: "A comunidade é um ambiente educacional e informativo. O conteúdo não substitui formação, protocolos ou orientações institucionais.",
  },
];

const productStyles = `
  .nav-products-button {
    border: 0;
    background: transparent;
    color: inherit;
    font: inherit;
    cursor: pointer;
    padding: 0;
  }

  .nav-products-button:hover { color: #fff; }

  .brand-logo-box {
    width: 54px;
    height: 54px;
    min-width: 54px;
    border-radius: 14px;
    background: #081525;
    border: 1px solid rgba(255,255,255,.12);
    display: grid;
    place-items: center;
    overflow: hidden;
    box-shadow: 0 10px 28px rgba(0,0,0,.28);
  }
  .brand-logo-box img {
    width: 46px;
    height: 46px;
    object-fit: contain;
  }

  .premium-product {
    --product-primary: #d6152d;
    --product-secondary: #071426;
    --product-accent: #ff4156;
    --product-surface: #ffffff;
    --product-soft: #f5f7fa;
    background: var(--product-soft);
    color: #132033;
    min-height: 100vh;
    padding-top: 72px;
  }

  .product-top {
    background: var(--product-secondary);
    color: #fff;
    padding: 18px 0;
  }

  .product-top-inner {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 18px;
  }

  .product-back {
    border: 0;
    background: transparent;
    color: rgba(255,255,255,.78);
    font-weight: 800;
    cursor: pointer;
    padding: 10px 0;
  }

  .product-top-label {
    color: #fff;
    font-weight: 900;
    letter-spacing: .12em;
    font-size: .74rem;
    text-transform: uppercase;
  }

  .product-cover-first {
    background: var(--product-secondary);
  }

  .product-cover-frame {
    position: relative;
    overflow: hidden;
    border-radius: 0 0 34px 34px;
    box-shadow: 0 30px 80px rgba(2,12,24,.28);
  }

  .product-cover-frame img {
    width: 100%;
    aspect-ratio: 16 / 7;
    object-fit: cover;
    display: block;
  }

  .product-cover-shade {
    position: absolute;
    inset: auto 0 0;
    height: 40%;
    background: linear-gradient(transparent, rgba(0,0,0,.72));
  }

  .product-cover-badge {
    position: absolute;
    left: 34px;
    bottom: 28px;
    background: var(--product-primary);
    color: #fff;
    padding: 10px 14px;
    border-radius: 10px;
    font-weight: 900;
    font-size: .78rem;
    letter-spacing: .1em;
  }

  .product-intro {
    padding: 58px 0 34px;
  }

  .product-intro-grid {
    display: grid;
    grid-template-columns: 1.2fr .8fr;
    gap: 50px;
    align-items: start;
  }

  .product-kicker {
    color: var(--product-primary);
    font-weight: 900;
    letter-spacing: .13em;
    font-size: .76rem;
    text-transform: uppercase;
    margin-bottom: 12px;
  }

  .product-main-title {
    margin: 0;
    color: var(--product-secondary);
    font-size: clamp(2.4rem, 5vw, 4.8rem);
    line-height: 1.02;
    letter-spacing: -.045em;
  }

  .product-lead {
    margin: 22px 0 0;
    color: #4b5d70;
    font-size: 1.12rem;
    line-height: 1.75;
    max-width: 780px;
  }

  .product-promise {
    margin-top: 24px;
    padding: 18px 20px;
    border-left: 5px solid var(--product-primary);
    background: #fff;
    border-radius: 0 16px 16px 0;
    color: var(--product-secondary);
    font-size: 1rem;
    font-weight: 800;
    box-shadow: 0 12px 35px rgba(12,31,52,.08);
  }

  .product-buy-box {
    background: var(--product-secondary);
    color: #fff;
    border-radius: 24px;
    padding: 28px;
    box-shadow: 0 22px 60px rgba(7,20,38,.22);
    position: sticky;
    top: 96px;
  }

  .product-buy-box small {
    display: block;
    color: rgba(255,255,255,.62);
    text-transform: uppercase;
    letter-spacing: .12em;
    font-weight: 800;
  }

  .product-buy-box h3 {
    margin: 8px 0 18px;
    font-size: 1.5rem;
    color: #fff;
  }

  .product-action {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 56px;
    border-radius: 14px;
    padding: 0 20px;
    font-weight: 900;
    text-align: center;
    transition: .2s ease;
  }

  .product-action:hover {
    transform: translateY(-2px);
  }

  .product-action.primary {
    background: linear-gradient(135deg, var(--product-primary), var(--product-accent));
    color: #fff;
    box-shadow: 0 14px 34px rgba(214,21,45,.28);
  }

  .product-action.secondary {
    margin-top: 10px;
    border: 1px solid rgba(255,255,255,.18);
    background: rgba(255,255,255,.06);
    color: #fff;
  }

  .product-action.whatsapp {
    margin-top: 10px;
    background: #20b665;
    color: #fff;
    box-shadow: 0 14px 34px rgba(32,182,101,.22);
  }

  .product-facts {
    padding: 18px 0 70px;
  }

  .product-facts-grid {
    display: grid;
    grid-template-columns: repeat(3,1fr);
    gap: 16px;
  }

  .product-fact {
    background: #fff;
    border: 1px solid rgba(10,31,54,.08);
    border-radius: 18px;
    padding: 22px;
    box-shadow: 0 12px 34px rgba(9,28,50,.06);
  }

  .product-fact span {
    display: block;
    color: var(--product-primary);
    font-size: .72rem;
    font-weight: 900;
    letter-spacing: .12em;
    text-transform: uppercase;
    margin-bottom: 6px;
  }

  .product-fact strong {
    color: var(--product-secondary);
    font-size: 1rem;
  }

  .product-section {
    padding: 78px 0;
  }

  .product-section.white {
    background: #fff;
  }

  .product-section.dark-theme {
    background: var(--product-secondary);
    color: #fff;
  }

  .product-section-head {
    max-width: 760px;
    margin-bottom: 36px;
  }

  .product-section-head .tag {
    color: var(--product-primary);
    font-size: .74rem;
    font-weight: 900;
    letter-spacing: .13em;
    text-transform: uppercase;
  }

  .product-section-head h2 {
    margin: 10px 0 0;
    color: var(--product-secondary);
    font-size: clamp(2rem,4vw,3.4rem);
    line-height: 1.08;
    letter-spacing: -.035em;
  }

  .dark-theme .product-section-head h2 {
    color: #fff;
  }

  .audience-list {
    display: grid;
    grid-template-columns: repeat(3,1fr);
    gap: 18px;
  }

  .audience-item {
    background: var(--product-soft);
    border-radius: 20px;
    padding: 25px;
    color: var(--product-secondary);
    border: 1px solid rgba(10,31,54,.08);
  }

  .audience-number {
    width: 42px;
    height: 42px;
    border-radius: 12px;
    background: var(--product-primary);
    color: #fff;
    display: grid;
    place-items: center;
    font-weight: 900;
    margin-bottom: 18px;
  }

  .audience-item p {
    margin: 0;
    font-weight: 800;
    line-height: 1.55;
  }

  .deliverables-grid {
    display: grid;
    grid-template-columns: repeat(2,1fr);
    gap: 16px;
  }

  .deliverable {
    display: grid;
    grid-template-columns: 46px 1fr;
    gap: 14px;
    align-items: start;
    padding: 22px;
    border-radius: 18px;
    background: rgba(255,255,255,.06);
    border: 1px solid rgba(255,255,255,.1);
  }

  .deliverable-icon {
    width: 42px;
    height: 42px;
    border-radius: 12px;
    background: var(--product-primary);
    display: grid;
    place-items: center;
    font-weight: 900;
    color: #fff;
  }

  .deliverable h3 {
    margin: 0 0 6px;
    color: #fff;
    font-size: 1rem;
  }

  .deliverable p {
    margin: 0;
    color: rgba(255,255,255,.7);
    line-height: 1.55;
    font-size: .9rem;
  }

  .product-final {
    padding: 74px 0 110px;
    background:
      radial-gradient(circle at 85% 20%, color-mix(in srgb, var(--product-primary) 28%, transparent), transparent 35%),
      var(--product-soft);
  }

  .product-final-card {
    background: var(--product-secondary);
    color: #fff;
    border-radius: 28px;
    padding: 42px;
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 30px;
    align-items: center;
    box-shadow: 0 26px 70px rgba(7,20,38,.25);
  }

  .product-final-card h2 {
    color: #fff;
    margin: 6px 0 10px;
    font-size: clamp(2rem,4vw,3.2rem);
  }

  .product-final-card p {
    color: rgba(255,255,255,.72);
    margin: 0;
    max-width: 690px;
  }

  .product-final-actions {
    display: grid;
    min-width: 270px;
    gap: 10px;
  }

  .product-disclaimer {
    margin-top: 18px;
    color: #718196;
    font-size: .82rem;
    line-height: 1.6;
  }

  @media (max-width: 900px) {
    .product-intro-grid {
      grid-template-columns: 1fr;
    }

    .product-buy-box {
      position: static;
    }

    .product-facts-grid,
    .audience-list {
      grid-template-columns: 1fr;
    }

    .deliverables-grid {
      grid-template-columns: 1fr;
    }

    .product-final-card {
      grid-template-columns: 1fr;
    }

    .product-final-actions {
      min-width: 0;
    }
  }


  .sales-page {
    min-height: 100vh;
    padding-top: 72px;
    background: #f4f7fb;
    color: #0b1a2c;
  }

  .sales-hero {
    position: relative;
    overflow: hidden;
    padding: 78px 0 68px;
    color: #fff;
    background:
      radial-gradient(circle at 82% 20%, rgba(228,23,52,.32), transparent 28%),
      linear-gradient(135deg, #071425 0%, #0b2038 64%, #111827 100%);
  }

  .sales-hero-grid {
    display: grid;
    grid-template-columns: 1.05fr .95fr;
    gap: 46px;
    align-items: center;
  }

  .sales-badge {
    display: inline-flex;
    padding: 9px 13px;
    border: 1px solid rgba(255,255,255,.18);
    border-radius: 999px;
    background: rgba(255,255,255,.07);
    color: #ff8491;
    font-size: .74rem;
    font-weight: 900;
    letter-spacing: .12em;
    text-transform: uppercase;
  }

  .sales-hero h1 {
    margin: 18px 0;
    font-size: clamp(2.75rem,5.5vw,5.6rem);
    line-height: 1.01;
    letter-spacing: -.05em;
    color: #fff;
  }

  .sales-hero h1 span { color: #ff334a; }

  .sales-hero p {
    margin: 0 0 26px;
    color: #c7d4e2;
    font-size: 1.08rem;
    line-height: 1.75;
    max-width: 700px;
  }

  .sales-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
  }

  .sales-btn {
    min-height: 56px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0 22px;
    border-radius: 14px;
    font-weight: 900;
    border: 0;
    cursor: pointer;
  }

  .sales-btn.primary {
    color: #fff;
    background: linear-gradient(135deg,#d9142d,#ff3a50);
    box-shadow: 0 16px 38px rgba(217,20,45,.3);
  }

  .sales-btn.secondary {
    color: #fff;
    border: 1px solid rgba(255,255,255,.18);
    background: rgba(255,255,255,.06);
  }

  .sales-visual-stack {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
    transform: rotate(1deg);
  }

  .sales-visual-stack img {
    width: 100%;
    height: 225px;
    object-fit: cover;
    border-radius: 20px;
    border: 1px solid rgba(255,255,255,.14);
    box-shadow: 0 24px 60px rgba(0,0,0,.3);
  }

  .sales-visual-stack img:first-child {
    grid-column: 1 / -1;
    height: 250px;
  }

  .sales-strip {
    padding: 20px 0 68px;
    background: #f4f7fb;
  }

  .sales-strip-grid {
    display: grid;
    grid-template-columns: repeat(3,1fr);
    gap: 14px;
    margin-top: -36px;
    position: relative;
    z-index: 2;
  }

  .sales-proof-card {
    background: #fff;
    border: 1px solid rgba(10,31,54,.08);
    border-radius: 18px;
    padding: 22px;
    box-shadow: 0 16px 42px rgba(10,31,54,.09);
  }

  .sales-proof-card strong {
    display: block;
    color: #071426;
    font-size: 1.05rem;
  }

  .sales-proof-card span {
    display: block;
    margin-top: 5px;
    color: #66788b;
    font-size: .88rem;
  }

  .sales-section {
    padding: 82px 0;
  }

  .sales-section.white { background: #fff; }
  .sales-section.navy { background: #071426; color: #fff; }

  .sales-heading {
    max-width: 820px;
    margin: 0 auto 38px;
    text-align: center;
  }

  .sales-heading .tag {
    color: #d9142d;
    font-weight: 900;
    letter-spacing: .13em;
    font-size: .74rem;
    text-transform: uppercase;
  }

  .sales-heading h2 {
    margin: 10px 0 0;
    color: #071426;
    font-size: clamp(2rem,4vw,3.45rem);
    line-height: 1.08;
    letter-spacing: -.035em;
  }

  .sales-heading p {
    margin: 15px auto 0;
    color: #6d7f91;
    line-height: 1.75;
  }

  .navy .sales-heading h2 { color: #fff; }
  .navy .sales-heading p { color: rgba(255,255,255,.68); }

  .pain-grid,
  .benefit-grid,
  .solution-grid {
    display: grid;
    grid-template-columns: repeat(3,1fr);
    gap: 16px;
  }

  .sales-card {
    padding: 25px;
    border-radius: 20px;
    background: #f6f8fb;
    border: 1px solid rgba(10,31,54,.08);
  }

  .sales-card .num,
  .sales-card .icon {
    width: 46px;
    height: 46px;
    display: grid;
    place-items: center;
    border-radius: 13px;
    margin-bottom: 17px;
    background: #d9142d;
    color: #fff;
    font-weight: 900;
  }

  .sales-card h3 {
    margin: 0 0 9px;
    color: #071426;
    font-size: 1.08rem;
  }

  .sales-card p {
    margin: 0;
    color: #66788b;
    line-height: 1.65;
    font-size: .92rem;
  }

  .solution-grid .sales-card {
    background: rgba(255,255,255,.06);
    border-color: rgba(255,255,255,.1);
  }

  .solution-grid .sales-card h3 { color: #fff; }
  .solution-grid .sales-card p { color: rgba(255,255,255,.68); }

  .sales-products {
    display: grid;
    gap: 24px;
  }

  .sales-product-row {
    display: grid;
    grid-template-columns: .9fr 1.1fr;
    gap: 0;
    overflow: hidden;
    border-radius: 26px;
    background: #fff;
    border: 1px solid rgba(10,31,54,.08);
    box-shadow: 0 18px 55px rgba(10,31,54,.09);
  }

  .sales-product-row:nth-child(even) .sales-product-image { order: 2; }

  .sales-product-image img {
    width: 100%;
    height: 100%;
    min-height: 340px;
    object-fit: cover;
  }

  .sales-product-copy {
    padding: 40px;
    display: flex;
    flex-direction: column;
    justify-content: center;
  }

  .sales-product-copy .label {
    color: #d9142d;
    font-size: .72rem;
    font-weight: 900;
    letter-spacing: .12em;
  }

  .sales-product-copy h3 {
    margin: 8px 0 12px;
    color: #071426;
    font-size: clamp(1.8rem,3vw,2.7rem);
  }

  .sales-product-copy p {
    margin: 0 0 20px;
    color: #67798b;
    line-height: 1.75;
  }

  .sales-product-copy ul {
    margin: 0 0 23px;
    padding: 0;
    list-style: none;
    display: grid;
    gap: 9px;
  }

  .sales-product-copy li {
    color: #203246;
    font-weight: 700;
  }

  .sales-product-copy li::before {
    content: "✓";
    color: #d9142d;
    margin-right: 9px;
    font-weight: 900;
  }

  .testimonial-grid {
    display: grid;
    grid-template-columns: repeat(3,1fr);
    gap: 16px;
  }

  .testimonial-card {
    padding: 25px;
    border-radius: 20px;
    background: #fff;
    border: 1px solid rgba(10,31,54,.08);
  }

  .testimonial-card blockquote {
    margin: 0 0 18px;
    color: #2c3f53;
    line-height: 1.7;
  }

  .testimonial-card strong { color: #071426; }
  .testimonial-card span { display: block; color: #7a8a9a; font-size: .84rem; }

  .testimonial-empty {
    max-width: 760px;
    margin: 0 auto;
    padding: 24px;
    text-align: center;
    border: 1px dashed rgba(10,31,54,.2);
    border-radius: 18px;
    color: #6b7c8e;
    background: #f8fafc;
  }

  .objections {
    max-width: 880px;
    margin: 0 auto;
    display: grid;
    gap: 12px;
  }

  .objection {
    border-radius: 16px;
    border: 1px solid rgba(255,255,255,.1);
    background: rgba(255,255,255,.05);
    padding: 19px 21px;
  }

  .objection summary {
    cursor: pointer;
    color: #fff;
    font-weight: 900;
  }

  .objection p {
    margin: 12px 0 0;
    color: rgba(255,255,255,.68);
    line-height: 1.65;
  }

  .sales-final {
    padding: 82px 0 120px;
    background:
      radial-gradient(circle at 80% 10%, rgba(217,20,45,.18), transparent 30%),
      #eef2f7;
  }

  .sales-final-card {
    background: linear-gradient(135deg,#071426,#0c2947);
    color: #fff;
    border-radius: 30px;
    padding: 48px;
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 30px;
    align-items: center;
    box-shadow: 0 26px 75px rgba(7,20,38,.24);
  }

  .sales-final-card h2 {
    margin: 0 0 10px;
    color: #fff;
    font-size: clamp(2rem,4vw,3.5rem);
  }

  .sales-final-card p {
    margin: 0;
    color: rgba(255,255,255,.7);
    max-width: 700px;
  }

  .sales-final-actions {
    display: grid;
    min-width: 280px;
    gap: 10px;
  }

  @media (max-width: 900px) {
    .sales-hero-grid,
    .sales-product-row,
    .sales-final-card {
      grid-template-columns: 1fr;
    }

    .sales-product-row:nth-child(even) .sales-product-image { order: initial; }

    .pain-grid,
    .benefit-grid,
    .solution-grid,
    .testimonial-grid {
      grid-template-columns: 1fr 1fr;
    }

    .sales-strip-grid {
      grid-template-columns: 1fr;
      margin-top: -24px;
    }

    .sales-final-actions { min-width: 0; }
  }

  @media (max-width: 620px) {
    .sales-page { padding-top: 64px; }
    .sales-hero { padding: 50px 0; }
    .sales-hero h1 { font-size: 2.7rem; }
    .sales-actions { display: grid; }
    .sales-btn { width: 100%; }
    .sales-visual-stack img,
    .sales-visual-stack img:first-child { height: 150px; }
    .pain-grid,
    .benefit-grid,
    .solution-grid,
    .testimonial-grid { grid-template-columns: 1fr; }
    .sales-product-copy { padding: 27px 22px; }
    .sales-product-image img { min-height: 230px; }
    .sales-final-card { padding: 30px 22px; }
  }


  @media (max-width: 620px) {
    .premium-product {
      padding-top: 64px;
    }

    .product-top {
      padding: 8px 0;
    }

    .product-top-label {
      display: none;
    }

    .product-cover-frame {
      border-radius: 0 0 22px 22px;
    }

    .product-cover-frame img {
      aspect-ratio: 16 / 10;
    }

    .product-cover-badge {
      left: 18px;
      bottom: 16px;
      font-size: .66rem;
    }

    .product-intro {
      padding: 38px 0 24px;
    }

    .product-main-title {
      font-size: 2.55rem;
    }

    .product-lead {
      font-size: 1rem;
    }

    .product-section {
      padding: 58px 0;
    }

    .product-final-card {
      padding: 28px 22px;
    }

    .nav-products-button {
    border: 0;
    background: transparent;
    color: inherit;
    font: inherit;
    cursor: pointer;
    padding: 0;
  }

  .nav-products-button:hover { color: #fff; }

  .brand-logo-box {
      width: 46px;
      height: 46px;
      min-width: 46px;
    }

    .brand-logo-box img {
      width: 40px;
      height: 40px;
    }
  }
`;


function SalesLandingPage({ onBack, onOpenProduct }) {
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
  }, []);

  return (
    <main className="sales-page">
      <section className="product-top">
        <div className="container product-top-inner">
          <button className="product-back" onClick={onBack}>← Voltar ao site</button>
          <div className="product-top-label">SOLUÇÕES EM APH • HANIF ALVES</div>
        </div>
      </section>

      <section className="sales-hero">
        <div className="container sales-hero-grid">
          <div>
            <span className="sales-badge">Para estudantes e profissionais da saúde</span>
            <h1>Não basta decorar condutas. É preciso <span>compreender prioridades.</span></h1>
            <p>
              Produtos educacionais criados para quem deseja ingressar na urgência e emergência,
              revisar fundamentos e desenvolver uma preparação mais organizada, segura e baseada em evidências.
            </p>
            <div className="sales-actions">
              <button className="sales-btn primary" onClick={() => document.getElementById("solucoes")?.scrollIntoView({ behavior: "smooth" })}>
                Encontrar o produto ideal
              </button>
              <a className="sales-btn secondary" href={makeWhatsapp("Produtos e formações em APH")} target="_blank" rel="noreferrer">
                Falar diretamente com Hanif
              </a>
            </div>
          </div>

          <div className="sales-visual-stack">
            <img src="/assets/mentoria-aph.png" alt="Mentoria APH" />
            <img src="/assets/ebook-hemorragias.png" alt="E-book Controle de Hemorragias" />
            <img src="/assets/comunidade-aph.png" alt="Comunidade APH" />
          </div>
        </div>
      </section>

      <section className="sales-strip">
        <div className="container sales-strip-grid">
          <article className="sales-proof-card">
            <strong>10 anos de experiência</strong>
            <span>Na linha de frente das urgências e emergências.</span>
          </article>
          <article className="sales-proof-card">
            <strong>Conteúdo fundamentado</strong>
            <span>Literaturas reconhecidas, protocolos e evidências científicas.</span>
          </article>
          <article className="sales-proof-card">
            <strong>Aplicação profissional</strong>
            <span>Materiais pensados para estudo, revisão e evolução na área.</span>
          </article>
        </div>
      </section>

      <section className="sales-section white">
        <div className="container">
          <div className="sales-heading">
            <div className="tag">A DOR</div>
            <h2>Talvez o problema não seja falta de vontade. É falta de direção.</h2>
            <p>
              Na urgência e emergência, estudar conteúdos isolados sem compreender a sequência do atendimento
              gera insegurança, confusão e dificuldade para reconhecer o que realmente importa.
            </p>
          </div>
          <div className="pain-grid">
            <article className="sales-card"><div className="num">01</div><h3>Conteúdo disperso</h3><p>Você consome vídeos, apostilas e posts, mas não consegue organizar o conhecimento em uma linha lógica.</p></article>
            <article className="sales-card"><div className="num">02</div><h3>Insegurança nas prioridades</h3><p>Conhece termos e técnicas, porém ainda tem dúvidas sobre o que reconhecer e priorizar primeiro.</p></article>
            <article className="sales-card"><div className="num">03</div><h3>Dificuldade para ingressar</h3><p>Quer atuar na área, mas não sabe quais fundamentos estudar e como se preparar de forma estratégica.</p></article>
          </div>
        </div>
      </section>

      <section className="sales-section navy">
        <div className="container">
          <div className="sales-heading">
            <div className="tag">A SOLUÇÃO</div>
            <h2>Uma trilha de conhecimento para diferentes momentos da sua jornada.</h2>
            <p>
              Você escolhe a solução mais adequada ao seu objetivo: aprofundamento, estudo dirigido ou atualização contínua.
            </p>
          </div>
          <div className="solution-grid">
            <article className="sales-card"><div className="icon">🎯</div><h3>Direção</h3><p>Conteúdo organizado para mostrar o que estudar, em qual sequência e com qual objetivo.</p></article>
            <article className="sales-card"><div className="icon">🧠</div><h3>Compreensão</h3><p>Menos memorização solta e mais entendimento de prioridades, riscos e raciocínio.</p></article>
            <article className="sales-card"><div className="icon">📈</div><h3>Evolução</h3><p>Produtos complementares que acompanham seu desenvolvimento acadêmico e profissional.</p></article>
          </div>
        </div>
      </section>

      <section className="sales-section white">
        <div className="container">
          <div className="sales-heading">
            <div className="tag">BENEFÍCIOS</div>
            <h2>O que muda quando você estuda com uma estrutura clara.</h2>
          </div>
          <div className="benefit-grid">
            <article className="sales-card"><div className="icon">✓</div><h3>Mais clareza</h3><p>Entenda a lógica do atendimento em vez de apenas acumular informações.</p></article>
            <article className="sales-card"><div className="icon">✓</div><h3>Mais confiança</h3><p>Fortaleça sua base teórica para discutir casos e compreender condutas.</p></article>
            <article className="sales-card"><div className="icon">✓</div><h3>Estudo objetivo</h3><p>Evite perder tempo com conteúdos desconectados do seu objetivo profissional.</p></article>
            <article className="sales-card"><div className="icon">✓</div><h3>Atualização</h3><p>Acompanhe conteúdos apoiados em referências e evidências reconhecidas.</p></article>
            <article className="sales-card"><div className="icon">✓</div><h3>Preparação profissional</h3><p>Organize seus conhecimentos para ingressar ou evoluir na área.</p></article>
            <article className="sales-card"><div className="icon">✓</div><h3>Acesso direto</h3><p>Fale com Hanif e receba orientação sobre o produto mais adequado ao seu momento.</p></article>
          </div>
        </div>
      </section>

      <section className="sales-section" id="solucoes">
        <div className="container">
          <div className="sales-heading">
            <div className="tag">ESCOLHA SUA SOLUÇÃO</div>
            <h2>Produtos desenvolvidos para necessidades diferentes.</h2>
            <p>Abra a página completa para conhecer conteúdos, público, benefícios e formas de acesso.</p>
          </div>

          <div className="sales-products">
            {products.map((product) => (
              <article className="sales-product-row" key={product.id}>
                <div className="sales-product-image">
                  <img src={product.image} alt={product.title} />
                </div>
                <div className="sales-product-copy">
                  <div className="label">{product.badge}</div>
                  <h3>{product.title}</h3>
                  <p>{product.short}</p>
                  <ul>
                    {product.facts.map(([label, value]) => <li key={label}>{label}: {value}</li>)}
                  </ul>
                  <button className="sales-btn primary" onClick={() => onOpenProduct(product)}>
                    Ver página completa
                  </button>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="sales-section white">
        <div className="container">
          <div className="sales-heading">
            <div className="tag">PROVA E CONFIANÇA</div>
            <h2>Conhecimento apoiado em experiência, estudo e responsabilidade profissional.</h2>
            <p>
              A autoridade desta proposta está na experiência de 10 anos na linha de frente,
              na atuação como técnico de enfermagem socorrista e instrutor de APH,
              e no compromisso com conteúdos fundamentados.
            </p>
          </div>

          {testimonials.length > 0 ? (
            <div className="testimonial-grid">
              {testimonials.map((item) => (
                <article className="testimonial-card" key={item.name}>
                  <blockquote>“{item.text}”</blockquote>
                  <strong>{item.name}</strong>
                  <span>{item.role}</span>
                </article>
              ))}
            </div>
          ) : (
            <div className="testimonial-empty">
              A estrutura para depoimentos reais já está pronta. Nenhum depoimento foi inventado.
              Basta adicionar avaliações verdadeiras no array <strong>testimonials</strong> do código.
            </div>
          )}
        </div>
      </section>

      <section className="sales-section navy">
        <div className="container">
          <div className="sales-heading">
            <div className="tag">OBJEÇÕES COMUNS</div>
            <h2>Dúvidas que você pode ter antes de escolher.</h2>
          </div>
          <div className="objections">
            {commonObjections.map(([question, answer]) => (
              <details className="objection" key={question}>
                <summary>{question}</summary>
                <p>{answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="sales-final">
        <div className="container">
          <div className="sales-final-card">
            <div>
              <h2>Escolha o próximo passo da sua evolução no APH.</h2>
              <p>
                Conheça cada produto ou fale diretamente comigo para identificar a solução mais adequada ao seu objetivo.
              </p>
            </div>
            <div className="sales-final-actions">
              <button className="sales-btn primary" onClick={() => document.getElementById("solucoes")?.scrollIntoView({ behavior: "smooth" })}>
                Ver todos os produtos
              </button>
              <a className="sales-btn secondary" href={makeWhatsapp("Produtos e formações em APH")} target="_blank" rel="noreferrer">
                Falar com Hanif
              </a>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

function ProductPage({ product, onBack }) {
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [product.id]);

  const themeStyle = {
    "--product-primary": product.palette.primary,
    "--product-secondary": product.palette.secondary,
    "--product-accent": product.palette.accent,
    "--product-surface": product.palette.surface,
    "--product-soft": product.palette.soft,
  };

  return (
    <main className="premium-product" style={themeStyle}>
      <section className="product-top">
        <div className="container product-top-inner">
          <button className="product-back" onClick={onBack}>← Voltar aos projetos</button>
          <div className="product-top-label">{product.badge} • HANIF ALVES</div>
        </div>
      </section>

      <section className="product-cover-first">
        <div className="container">
          <div className="product-cover-frame">
            <img src={product.image} alt={product.title} />
            <div className="product-cover-shade" />
            <div className="product-cover-badge">{product.badge}</div>
          </div>
        </div>
      </section>

      <section className="product-intro">
        <div className="container product-intro-grid">
          <div>
            <div className="product-kicker">{product.eyebrow}</div>
            <h1 className="product-main-title">{product.headline}</h1>
            <p className="product-lead">{product.lead}</p>
            <div className="product-promise">{product.promise}</div>
          </div>

          <aside className="product-buy-box">
            <small>Produto selecionado</small>
            <h3>{product.title}</h3>
            <a className="product-action primary" href={product.primaryUrl} target="_blank" rel="noreferrer">
              {product.primaryLabel}
            </a>
            {product.secondaryUrl && (
              <a className="product-action secondary" href={product.secondaryUrl} target="_blank" rel="noreferrer">
                {product.secondaryLabel}
              </a>
            )}
            <a className="product-action whatsapp" href={makeWhatsapp(product.title)} target="_blank" rel="noreferrer">
              💬 Falar com Hanif sobre este produto
            </a>
          </aside>
        </div>
      </section>

      <section className="product-facts">
        <div className="container product-facts-grid">
          {product.facts.map(([label, value]) => (
            <article className="product-fact" key={label}>
              <span>{label}</span>
              <strong>{value}</strong>
            </article>
          ))}
        </div>
      </section>

      <section className="product-section white">
        <div className="container">
          <div className="product-section-head">
            <div className="tag">PARA QUEM É</div>
            <h2>Um produto desenvolvido para pessoas com objetivos claros.</h2>
          </div>
          <div className="audience-list">
            {product.audience.map((item, index) => (
              <article className="audience-item" key={item}>
                <div className="audience-number">0{index + 1}</div>
                <p>{item}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="product-section dark-theme">
        <div className="container">
          <div className="product-section-head">
            <div className="tag">O QUE VOCÊ ENCONTRA</div>
            <h2>Conteúdo organizado, objetivo e conectado à realidade da área.</h2>
          </div>
          <div className="deliverables-grid">
            {product.deliverables.map(([title, description], index) => (
              <article className="deliverable" key={title}>
                <div className="deliverable-icon">{String(index + 1).padStart(2, "0")}</div>
                <div>
                  <h3>{title}</h3>
                  <p>{description}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="product-final">
        <div className="container">
          <div className="product-final-card">
            <div>
              <div className="product-kicker">PRÓXIMO PASSO</div>
              <h2>{product.title}</h2>
              <p>Escolha a ação principal ou fale diretamente comigo. A mensagem enviada já identifica este produto.</p>
            </div>
            <div className="product-final-actions">
              <a className="product-action primary" href={product.primaryUrl} target="_blank" rel="noreferrer">
                {product.id === "ebook" ? "Comprar agora" : product.primaryLabel}
              </a>
              <a className="product-action whatsapp" href={makeWhatsapp(product.title)} target="_blank" rel="noreferrer">
                💬 Tirar dúvidas no WhatsApp
              </a>
            </div>
          </div>
          <p className="product-disclaimer">{product.note}</p>
        </div>
      </section>
    </main>
  );
}

export default function App() {
  const [open, setOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [showSalesLanding, setShowSalesLanding] = useState(false);
  const whatsapp = useMemo(() => makeWhatsapp(), []);

  const openProduct = (product) => {
    setSelectedProduct(product);
    setShowSalesLanding(false);
    setOpen(false);
  };

  const openSalesLanding = () => {
    setSelectedProduct(null);
    setShowSalesLanding(true);
    setOpen(false);
  };

  const goHome = () => {
    setSelectedProduct(null);
    setShowSalesLanding(false);
    setTimeout(() => document.getElementById("projetos")?.scrollIntoView({ behavior: "smooth" }), 50);
  };

  return (
    <div className="app">
      <style>{productStyles}</style>

      <header className="header">
        <div className="container nav-wrap">
          <a className="brand" href="#inicio" onClick={() => { setSelectedProduct(null); setShowSalesLanding(false); }}>
            <span className="brand-logo-box">
              <img src={LOGO_DATA} alt="Logo Hanif Alves" />
            </span>
            <span>HANIF ALVES<small>APH • URGÊNCIA E EMERGÊNCIA</small></span>
          </a>

          <button className="menu-button" onClick={() => setOpen(!open)} aria-label="Abrir menu">
            <span /><span /><span />
          </button>

          <nav className={`nav ${open ? "open" : ""}`}>
            <a href="#sobre" onClick={() => { setSelectedProduct(null); setOpen(false); }}>Sobre</a>
            <a href="#atuacao" onClick={() => { setSelectedProduct(null); setOpen(false); }}>Atuação</a>
            <button className="nav-products-button" onClick={openSalesLanding}>Produtos</button>
            <a href="#contato" onClick={() => { setSelectedProduct(null); setOpen(false); }}>Contato</a>
            <a className="nav-cta" href={whatsapp} target="_blank" rel="noreferrer">Falar no WhatsApp</a>
          </nav>
        </div>
      </header>

      {selectedProduct ? (
        <ProductPage product={selectedProduct} onBack={openSalesLanding} />
      ) : showSalesLanding ? (
        <SalesLandingPage onBack={goHome} onOpenProduct={openProduct} />
      ) : (
        <main>
          <section className="hero" id="inicio">
            <div className="container hero-grid">
              <div className="hero-copy">
                <div className="eyebrow">Conhecimento que prepara. Experiência que direciona.</div>
                <h1>Atendimento Pré-Hospitalar com <span>clareza, segurança e propósito.</span></h1>
                <p className="hero-text">Conteúdos, mentorias e projetos para profissionais e estudantes da saúde que desejam ingressar ou evoluir na urgência e emergência.</p>
                <div className="hero-actions">
                  <a className="button primary" href={whatsapp} target="_blank" rel="noreferrer">Falar com Hanif</a>
                  <button className="button secondary" onClick={openSalesLanding}>Conhecer produtos</button>
                </div>
                <div className="hero-proof">
                  <div><strong>10 anos</strong><span>na linha de frente das urgências e emergências</span></div>
                  <div><strong>APH</strong><span>formação e atualização</span></div>
                  <div><strong>Ciência</strong><span>conteúdo fundamentado</span></div>
                </div>
              </div>
              <div className="hero-visual">
                <div className="visual-glow" />
                <img src="/assets/hanif-hero.png" alt="Hanif Alves" />
                <div className="hero-card">
                  <span className="status-dot" />
                  <div>
                    <strong>Hanif Alves</strong>
                    <small>Técnico de Enfermagem Socorrista • Instrutor APH</small>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="section" id="sobre">
            <div className="container about-grid">
              <div>
                <div className="section-tag">SOBRE O PROFISSIONAL</div>
                <h2>Experiência prática transformada em educação profissional.</h2>
              </div>
              <div className="about-text">
                <p>Sou <strong>Hanif Alves</strong>, técnico de enfermagem socorrista, instrutor de Atendimento Pré-Hospitalar e profissional com <strong>10 anos de experiência na linha de frente das urgências e emergências</strong>.</p>
                <p>Meu propósito é tornar o conhecimento em APH mais acessível, organizado e aplicável para quem deseja ingressar na área ou aprimorar sua atuação.</p>
                <div className="credentials">
                  <span>Técnico de Enfermagem Socorrista</span>
                  <span>Instrutor APH – SAB</span>
                  <span>SAMU CE 192</span>
                  <span>Instrumentador Cirúrgico – HRC</span>
                </div>
              </div>
            </div>
          </section>

          <section className="section dark" id="atuacao">
            <div className="container">
              <div className="section-heading">
                <div className="section-tag">ÁREAS DE ATUAÇÃO</div>
                <h2>Conteúdo para quem leva a urgência e emergência a sério.</h2>
                <p>Uma presença profissional voltada à formação, atualização e desenvolvimento de estudantes e profissionais da saúde.</p>
              </div>
              <div className="expertise-grid">
                {expertise.map(([icon, title, text]) => (
                  <article className="expertise-card" key={title}>
                    <div className="expertise-icon">{icon}</div>
                    <h3>{title}</h3>
                    <p>{text}</p>
                  </article>
                ))}
              </div>
            </div>
          </section>

          <section className="section" id="projetos">
            <div className="container">
              <div className="section-heading">
                <div className="section-tag">PROJETOS E PRODUTOS</div>
                <h2>Escolha o projeto ideal para o seu momento profissional.</h2>
                <p>Cada produto possui uma página exclusiva com informações objetivas, benefícios e acesso direto.</p>
              </div>
              <div className="projects-grid">
                {products.map((product) => (
                  <article className="project-card" key={product.id}>
                    <button className="project-image project-click" onClick={() => openProduct(product)} aria-label={`Abrir ${product.title}`}>
                      <img src={product.image} alt={product.title} />
                      <span>{product.badge}</span>
                    </button>
                    <div className="project-content">
                      <h3>{product.title}</h3>
                      <p>{product.short}</p>
                      <button className="project-link" onClick={() => openProduct(product)}>
                        Ver página completa <span>→</span>
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </section>

          <section className="section evidence">
            <div className="container evidence-grid">
              <div className="evidence-badge">✓</div>
              <div>
                <div className="section-tag">COMPROMISSO EDUCACIONAL</div>
                <h2>Baseado em literaturas mundiais e evidências científicas.</h2>
                <p>Os conteúdos são organizados com apoio de referências reconhecidas, atualização contínua e respeito aos protocolos e limites de atuação profissional.</p>
              </div>
            </div>
          </section>

          <section className="section contact-section" id="contato">
            <div className="container contact-card">
              <div>
                <div className="section-tag light">CONTATO</div>
                <h2>Vamos conversar sobre APH, formação e desenvolvimento profissional?</h2>
                <p>Entre em contato para conhecer mentorias, materiais, comunidade e novos projetos.</p>
              </div>
              <a className="button contact-button" href={whatsapp} target="_blank" rel="noreferrer">Abrir WhatsApp</a>
            </div>
          </section>
        </main>
      )}

      <a className="mobile-whatsapp" href={selectedProduct ? makeWhatsapp(selectedProduct.title) : showSalesLanding ? makeWhatsapp("Produtos e formações em APH") : whatsapp} target="_blank" rel="noreferrer">
        💬 {selectedProduct ? `Falar sobre ${selectedProduct.badge}` : showSalesLanding ? "Dúvidas sobre os produtos" : "Falar no WhatsApp"}
      </a>

      <footer>
        <div className="container footer-wrap">
          <div>
            <strong>Hanif Alves</strong>
            <span>APH • Urgência e Emergência</span>
          </div>
          <p>© {new Date().getFullYear()} Todos os direitos reservados.</p>
        </div>
      </footer>
    </div>
  );
}
