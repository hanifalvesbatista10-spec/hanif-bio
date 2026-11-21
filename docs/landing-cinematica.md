# Landing cinematográfica (abertura da home)

Abertura da home com quatro momentos guiados pela rolagem: **CENA → PREPARAÇÃO → TREINAMENTO → FORMAÇÃO**, seguida do catálogo real
(produtos do cadastro). Branch de trabalho: `feat/landing-cinematica`. Nada foi publicado.

## Como funciona

- `src/components/cinematic/CinematicHero.jsx`: a "pista" (`.cx-track`, ~340 svh no computador e ~270 svh no celular) contém uma cena
  fixa com `position: sticky` logo abaixo do cabeçalho. Textos, links e botões ficam sempre em HTML; a mídia são camadas de imagem.
- `src/components/cinematic/useScrollScene.js`: o progresso da rolagem dentro da pista (0 a 1) vira variáveis CSS (`--p`, `--push`,
  `--pull`, `--t1o`...). Só `transform` e `opacity` se movem; o React não renderiza a cada evento de rolagem. O estado visual é uma
  função pura do progresso: volta no sentido inverso ao rolar para cima, estabiliza ao parar e não usa temporizadores.
  Limpeza ao desmontar: listeners, `IntersectionObserver`, `ResizeObserver` e `requestAnimationFrame`.
- `src/components/cinematic/cinematic.css`: composição do computador, do celular (texto embaixo, recortes verticais, fixação mais
  curta) e do tablet em pé. Carregado só junto com o componente (bloco separado, ~6,6 KB de CSS e ~6,7 KB de JS), que é importado
  sob demanda por `ConversionHomePage.jsx`; enquanto baixa, a própria imagem de abertura já ocupa a tela.
- `src/components/cinematic/config.js`: textos padrão, mídia e mesclagem com o que o painel salvar (destinos só aceitam `#`, `/rota` ou
  `https://`; qualquer outra coisa volta ao padrão).
- **Sem biblioteca nova.** GSAP/ScrollTrigger foi avaliado e dispensado: para uma cena só, `sticky` + variáveis CSS entregam o efeito
  sem ~40 KB extras e sem sequestrar a rolagem.
- **Movimento reduzido** (`prefers-reduced-motion`): sem fixar, sem parallax e sem imagem só para o efeito; os quatro momentos viram
  blocos em sequência, com todo o conteúdo e os destinos. **Economia de dados**: só a versão menor da imagem.
- Mentoria: o destino de "Conhecer a mentoria" e do link "Mentoria" do cabeçalho vem do cadastro (`src/services/mentorship.js`):
  o primeiro produto ATIVO com "mentoria" no título; sem ele, vai para o catálogo. (`/produto/mentoria-aph` é uma página antiga,
  sem produto, e mostra "Mentoria indisponível".)

## O que o painel edita (Configurações do site → "Abertura da home")

`site_settings.cinematic` (jsonb, **SQL 65**, aditivo, coluna nasce nula): ativar/desativar a cena (desativada, volta à abertura simples
antiga), linha de marca, título/apoio dos 4 momentos, textos e destinos dos botões, e 5 imagens (abertura PC/celular, preparo celular,
treinamento PC/celular) com URL ou envio (bucket `forms-media`). Em branco = padrão. Nos títulos, `**trecho**` sai em vermelho.
Sem a migration a home usa os textos padrão e o painel avisa para rodar `supabase/65_abertura_cinematografica.sql`.

## Mídia usada hoje (só arquivos próprios do projeto)

| Uso | Arquivo | Origem |
|---|---|---|
| Abertura (PC) | `public/media/hero/hero-desktop-poster(.webp, -4k.webp)` | já existia |
| Abertura (celular) | `public/media/cinematic/abertura-mobile.webp` (50 KB) | poster vertical existente, recomprimido |
| Preparo (celular) | `public/media/cinematic/preparo-mobile.webp` (19 KB) | recorte vertical do vídeo original `hero-desktop-novo.mp4` |
| Treinamento (PC) | `public/media/cinematic/treinamento-desktop.webp` (69 KB) | quadro do vídeo original `hero-desktop-novo.mp4` |
| Treinamento (celular) | `public/media/cinematic/treinamento-mobile.webp` (30 KB) | recorte vertical do mesmo quadro |

No computador, o "preparo" é a aproximação em close do manequim em maca (sala de simulação) que depois recua e revela o instrutor.

## Fidelidade à referência (limitação registrada)

O vídeo de referência (~23 s, café e logística) **não estava disponível** no computador; foi usada a descrição da especificação. Os
vídeos de Downloads com duração parecida eram de outros assuntos e foram descartados (alguns mostram ferimentos reais de terceiros).
A solução é o caminho 3 da especificação: composição em camadas com as imagens disponíveis, profundidade moderada, aproximação e
recuo coordenados com os textos. **Fidelidade visual parcial**: não há filmagem de cena de resgate nem sequência de quadros, então a
abertura não tem o "assunto central que muda de estado" da referência. O briefing abaixo fecha essa distância.

## Briefing de mídia (o que ainda falta para chegar à qualidade da referência)

Regras gerais: imagens próprias ou licenciadas; prática só com simulação e manequins; pessoas identificáveis só com autorização de
imagem; nada que sugira demonstração clínica ou site oficial do SAMU; manter meu rosto e aparência.

1. **CENA (momento 1):** equipe em preparação ou resgate simulado, luz controlada e fria (azul-marinho), plano aberto, assunto forte,
   **área livre de ~45% à esquerda** para o texto. Horizontal 3840×2160 e vertical 1080×1920 (no vertical, área livre nos 40% de baixo).
2. **PREPARAÇÃO (momento 2):** continuidade direta da cena 1 (mesma luz e paleta): close em equipamento (maca, bolsa-válvula-máscara,
   DEA, prancha), em foco e com profundidade. Horizontal e vertical.
3. **TREINAMENTO (momento 3):** aula ou simulação com manequim e o instrutor orientando; texto à esquerda, instrutor à direita.
4. **Opcional, nível "referência":** sequência de 120 a 180 quadros (WebP/AVIF, 1920×1080 e 1080×1920) de uma única câmera passando
   por essas cenas, para sincronizar quadro a quadro com a rolagem; ou vídeo H.264 só para esse fim, exportado com um quadro-chave por
   quadro (`-g 1`). Só vale se a busca de quadros ficar fluida no celular; senão ficam as camadas.
5. **Formato:** WebP (ou JPG), até ~300 KB no computador e ~150 KB no celular por imagem; sempre com versão vertical.

## Validação (resultados reais)

Executado: `npm run build` (ok); navegador em 1440×900 (recorte do painel), 1280×720, 768×1024 e 390×844; cena em seis posições de
progresso (0, 0,2, 0,4, 0,55, 0,72, 0,97); movimento reduzido simulado; ida e volta por outras rotas (sem acúmulo de listeners);
configuração desligada, editada e com falha do banco; foco por teclado só no momento ativo; jornada visitante → catálogo → produto →
botão de compra (`/checkout/...`, sem concluir compra); `/login`, `/admin` e `/minha-area` sem sessão continuam redirecionando.
Medição (build de produção, `vite preview`, sem limitação de rede, **laboratório; não prova aprovação em campo**): CLS 0 no
computador e no celular; LCP ~0,5 s; no celular baixam só as imagens de celular (~97 KB, sem vídeo; a abertura antiga puxava ~1,9 MB de
poster e 1,1 MB de vídeo). INP não foi medido. A versão anterior não foi medida pelo mesmo método.
Não executado: lint e testes (o projeto não tem), teste em aparelho físico, Safari/Firefox e leitores de tela.
