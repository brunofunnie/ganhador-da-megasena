<p align="center">
  <img src="https://img.shields.io/badge/Mega%20Sena-Intelig%C3%AAncia%20de%20Jogos-075ca8" alt="Mega Sena Inteligência de Jogos">
  <img src="https://img.shields.io/badge/React%2019-%230d2d62" alt="React 19">
  <img src="https://img.shields.io/badge/Node%20%2B%20Express-blue" alt="Node + Express">
  <img src="https://img.shields.io/badge/SQLite-%23075ca8" alt="SQLite">
</p>

<div align="center">

# 🍀 GanhaDorDaMegaSena

### Inteligência estatística para os seus jogos da Mega-Sena

> Gere combinações com **13 modos de geração**, valide qualquer modo com **backtest walk-forward**, compare contra **3.000+ concursos reais**, cheque seus jogos e organize tudo em **carteiras de apostas**.

</div>

---

## ✨ Recursos

### 🤖 Gerador — 13 modos

| Modo | O que faz de verdade |
|---|---|
| 🧪 **Estatístico (features)** | Sorteia um **bilhete real do histórico como alvo** e escolhe candidatos que combinam soma, paridade, quadrantes, consecutivos, repetição e primos. É o modo padrão. |
| 🎲 **Aleatório Puro** | Amostragem uniforme sem reposição, com sobreposição controlada entre os jogos do lote. |
| 🔥 **Quentes** | Peso exponencial no **z-score de frequência** (taxa suavizada), não na contagem bruta. |
| ❄️ **Frios** | Peso no **z-score do atraso** contra o gap geométrico esperado (p = 10%, média 10 sorteios). |
| ⚖️ **Balanceado 3P-3I** | 3 pares + 3 ímpares (quando os números fixos permitem), escolhidos por frequência suavizada. |
| 🧬 **Genético** | Algoritmo genético real: população, seleção por torneio, crossover e mutação. Fitness = verossimilhança estrutural + mistura quente/frio − penalidade de bilhete popular. |
| 🔢 **Sequências** | Primos e Fibonacci ponderados por frequência, variando a cada jogo (não devolve sempre os mesmos 6). |
| 🎯 **Fechamento** | **Wheel de cobertura** (set cover) com pool de 7–12 dezenas e garantia configurável de 4 ou 5 acertos. |
| 💭 **Sonhos** | Números-semente fixos + preenchimento ponderado; sementes excluídas são respeitadas. |
| 📈 **Tendência Temporal** | **z-score assinado** da diferença entre taxa recente e histórica — números esfriando não recebem o mesmo peso dos que estão esquentando. |
| 🎲 **Monte Carlo** | Busca de portfólio: avalia N candidatos e seleciona por estrutura, diversificação e menor rateio. A média de acertos é exibida apenas como informação. |
| 🗳️ **Ensemble** | Voto **suave** de todas as estratégias (normalizado por quantidade de jogos), usado como prior no sampler condicionado. |
| 🔗 **Markov** | Matriz de **transição temporal** P(j no próximo sorteio \| i neste sorteio), assimétrica, estimada em sorteios consecutivos. |

Todos os modos aceitam **números fixos, exclusões e semente de geração** (mesma semente → mesmos jogos). Nos modos de amostragem o lote é montado como **portfólio**: por padrão dois jogos não compartilham mais de 2 dezenas (no fechamento, a sobreposição segue a cobertura do wheel).

### 🔬 Motor estatístico

O app mede o histórico em vez de confiar em "quente/frio" intuitivo:

- **Taxa base**: cada dezena sai com probabilidade **10%** por sorteio (6 de 60). Após N concursos, a contagem esperada é `0,1·N` com desvio `√(N·0,1·0,9)`. Com **3.073 concursos**: **307,3 ± 16,6**.
- **Significância**: a tabela de frequência mostra o **z-score** de cada dezena. Hoje o maior desvio é `+3,11` (dezena 10, 359 vezes) e o menor `−3,45` (dezena 26, 250 vezes) — compatíveis com ruído amostral (χ² = 91,0 para 59 g.l.) e sem sobreviver à validação out-of-sample. O painel de Análise exibe o **χ²**, os outliers e a interpretação.
- **Shrinkage**: as taxas usadas nos pesos são puxadas para 10% (empirical Bayes), para não transformar ruído amostral em "sinal".
- **Atraso**: o intervalo entre aparições é **geométrico** (média 10, desvio 9,49). `P(atraso ≥ 30) = 4,2%`, então "número devendo sair" não existe; o atraso é mostrado como z-score e sobrevivência.
- **Bilhete típico** (medido no histórico): soma **183,1 ± 40,0** (P25–P75 = 155–211); **30,8%** dos sorteios têm 3 pares (2 a 4 pares = 79,1%); **93,6%** ocupam 3 ou 4 quadrantes; **92,9%** têm 0 ou 1 par consecutivo; **90,9%** repetem 0 ou 1 dezena do sorteio anterior; apenas **1,3%** têm todas as dezenas ≤ 31 e **0%** formam progressão aritmética.
- **Anti-rateio**: bilhetes com todas as dezenas ≤ 31 (aniversários), progressão aritmética, muitos finais repetidos ou múltiplos de 5/10 recebem penalidade. Isso **não muda a chance de 6 acertos**, mas reduz a chance de dividir o prêmio com muita gente.
- **Diversificação**: o otimizador escolhe jogos com sobreposição máxima configurável, aproveitando melhor a carteira.

### 🧪 Validação walk-forward (backtest)

A aba **Gerador → Validação estatística** roda o modo escolhido contra o histórico:

- Para cada concurso alvo, o modo gera **usando apenas os dados anteriores** (nunca o sorteio que será avaliado).
- O mesmo número de jogos aleatórios é gerado como **baseline** no mesmo concurso.
- O resultado mostra média de acertos, diferença e **intervalo de confiança de 95% (bootstrap)**, além de quadras ou mais.
- Se o IC inclui zero, o app diz explicitamente: **sem diferença confiável do acaso**.

Exemplo real (janela de 60 concursos, 3 jogos por concurso, semente fixa):

| Modo | Média de acertos | Aleatório | Δ | IC 95% | Significativo? |
|---|---|---|---|---|---|
| Estatístico | 0,650 | 0,667 | −0,017 | [−0,178; +0,150] | Não |
| Quentes | 0,578 | 0,667 | −0,089 | [−0,228; +0,056] | Não |
| Frios | 0,561 | 0,667 | −0,106 | [−0,250; +0,033] | Não |
| Genético | 0,561 | 0,667 | −0,106 | [−0,256; +0,050] | Não |
| Monte Carlo | 0,700 | 0,667 | +0,033 | [−0,117; +0,172] | Não |

> O próprio baseline aleatório oscila entre janelas/sementes (aqui, 0,667). É exatamente por isso que a comparação é **pareada** e com intervalo de confiança.

Esse é o resultado esperado e é o principal valor da ferramenta: **mostrar com números que nenhum modo prevê o próximo sorteio**.

### 🧪 Simulador de sorteios

- Compare seus jogos contra o **histórico real** ou contra uma **amostra aleatória** (até 100.000 sorteios).
- Veja a **incidência de acertos** por faixa (6, 5, 4 e 3 acertos) com porcentagens.
- Resultados **ordenados pelos melhores** — os jogos com mais acertos primeiro.

### 👛 Carteiras de apostas

- Guarde grupos de jogos em **carteiras nomeadas** (ex.: "Mega da Virada", "Aposta do mês").
- Cada jogo guarda o **modo de geração** que o produziu (badge na tabela e nos cards; jogos importados manualmente aparecem como **Manual**).
- **Finalize** uma carteira como rótulo de organização — e continue adicionando jogos depois.
- Visualize em **tabela compacta** (padrão) ou **cards** selecionáveis.
- **Cheque seus jogos com o sorteio atual** — os números acertados ficam destacados em amarelo.
- **Copie todos os jogos** de uma carteira (um por linha) direto para o clipboard.
- **Proteção contra duplicados**: jogos repetidos são rejeitados e carteiras antigas são limpas automaticamente.
- Nome padrão inteligente: **"Concurso X"** com o número do próximo sorteio.

### 📊 Análise completa

- Tabela de **frequência** de todos os 60 números (vezes sorteadas e porcentagem).
- **z-score** e taxa suavizada por dezena no painel de significância e na API.
- **Top 15** mais frequentes e **mais atrasados**.
- Grade visual de frequência 01–60.
- **Significância estatística**: χ², desvio-padrão esperado e dezenas com |z| ≥ 2.
- **Modelo estrutural**: como é um bilhete típico (soma, paridade, quadrantes, consecutivos, repetição, primos).
- Distribuição **pares × ímpares** por concurso.
- Tabela de **intervalos (gaps)** com janela configurável (últimos 10 a 1.000 sorteios) e gap atual.

### 📅 Sorteios

- Histórico completo com **paginação e filtros** (busca por concurso, intervalo de datas, acumulado).
- Detalhe de cada concurso: dezenas, ordem do sorteio, **premiação completa**, locais dos ganhadores e **análise da soma/paridade**.

### 🖥️ Painel (Dashboard)

- Último sorteio em destaque.
- Total de concursos, número mais frequente e maior atraso.
- Gráficos de **top 10 frequentes** e **top 10 atrasados**.
- Distribuição de pares e ímpares.

---

## 🛠️ Stack tecnológica

**Frontend**
- React 19 + TypeScript + Vite
- React Router + TanStack Query
- Tailwind CSS 4 + Base UI (acessível)
- Recharts (gráficos) + Lucide (ícones)

**Backend**
- Node.js + Express 5 + TypeScript
- better-sqlite3 (SQLite) — sem servidor de banco externo
- Vitest — **136 testes**

**Dados**
- Sincronização automática com **duas fontes selecionáveis**: a **API pública da Caixa** (loteriascaixa-api) ou a **guidI loteria_api**, escolhidas no botão de sincronização e lembradas entre sessões.
- A fonte guidI é incremental (busca apenas os concursos novos) e pode ser apontada para uma instância própria via `LOTERIA_GUIDI_BASE_URL`.
- O histórico é carregado uma vez por processo e convertido em **máscaras de 60 bits**; o cache é invalidado pelo fingerprint `(banco, quantidade, último concurso)` e pelo sync.

---

## 🚀 Instalação e execução

### Pré-requisitos

- **Node.js** ≥ 20
- **npm** ≥ 10

### Passo a passo

```bash
# 1. Clone o repositório
git clone git@github.com:brunofunnie/ganhador-da-megasena.git
cd ganhador-da-megasena

# 2. Instale as dependências
npm install
(cd backend && npm install)
(cd frontend && npm install)

# 3. Suba backend + frontend juntos (desenvolvimento)
npm run dev
```

Pronto! Acesse:

| Serviço | URL |
|---|---|
| **Frontend** | http://localhost:5173 |
| **Backend** | http://localhost:3002 |
| **API** | http://localhost:3002/api |

> No primeiro boot, o backend baixa automaticamente todo o histórico oficial da Mega-Sena. Depois disso, os resultados ficam armazenados em SQLite local (`backend/data/megasena.db`).

### Rodando separadamente

```bash
# Backend (porta 3002)
cd backend && npm run dev

# Frontend (porta 5173)
cd frontend && npm run dev
```

### Build de produção

```bash
# Backend
cd backend && npm run build && npm start

# Frontend
cd frontend && npm run build
```

### Testes e qualidade

```bash
cd backend && npm test        # 136 testes
cd backend && npx tsc --noEmit
cd frontend && npm run lint
cd frontend && npm run build
```

---

## 📡 API

Tudo sob `/api`:

| Método | Rota | Descrição |
|---|---|---|
| `GET` | `/status` | Status do banco + último sorteio + próximo concurso |
| `POST` | `/sync` | Sincroniza resultados com a fonte escolhida |
| `GET` | `/statistics` | Frequência (com **z-score**), atrasados (com **z do gap**), paridade e **significância** |
| `GET` | `/statistics/intervals?window=N` | Tabela de intervalos (gaps) dos últimos N sorteios |
| `GET` | `/generate?...` | Gera jogos (13 modos) |
| `GET` | `/generator/modes` | Lista os modos disponíveis |
| `GET` | `/generator/features` | Modelo estrutural do bilhete típico + baseline (0,6 acerto, quadra 1/2.332) |
| `GET` | `/backtest?...` | Validação walk-forward com IC 95% bootstrap |
| `GET` | `/strategies` | Lista as estratégias combinatórias |
| `GET` | `/strategies/:id` | Executa uma estratégia |
| `GET` | `/simulate?numbers=X&mode=Y` | Simula jogos contra histórico/aleatório |
| `GET` | `/draws` | Histórico paginado e filtrável |
| `GET` | `/draws/:concurso` | Detalhe de um concurso |
| `GET` | `/draws/:concurso/analysis` | Análise comparativa de um concurso |
| `GET/POST` | `/wallets` | Lista/cria carteiras |
| `GET/PATCH/DELETE` | `/wallets/:id` | Obtém/atualiza/exclui carteira |
| `POST` | `/wallets/:id/games` | Adiciona jogo (rejeita duplicados; aceita `mode`) |
| `DELETE` | `/wallets/:id/games/:gameId` | Remove um jogo |

### Parâmetros de `/generate`

| Parâmetro | Descrição |
|---|---|
| `mode` | `statistical`, `random`, `hot`, `cold`, `balanced`, `genetic`, `sequences`, `fechamento`, `dreams`, `trend`, `monte-carlo`, `ensemble`, `markov` |
| `count` | 1–10 jogos |
| `fixed` / `exclude` | Dezenas fixas/excluídas, ex.: `01,15,30` |
| `seeds` | Números-semente do modo `dreams` |
| `seed` | Semente do gerador (reprodutibilidade) |
| `iterations` | Candidatos do modo `monte-carlo` |
| `strategies` | Estratégias do modo `ensemble` |
| `windowSize` | Janela do modo `trend` |
| `poolSize` / `guarantee` | Pool e garantia do `fechamento` |
| `candidates` | Candidatos por jogo em `statistical`/`genetic` |
| `maxOverlap` | Sobreposição máxima entre jogos do lote |

Exemplo:

```bash
curl "http://localhost:3002/api/generate?mode=statistical&count=5&seed=demo&maxOverlap=2"
curl "http://localhost:3002/api/backtest?mode=statistical&window=80&games=5"
```

---

## 📁 Estrutura do projeto

```
├── backend/                    # API + inteligência
│   └── src/
│       ├── dataset.ts          # cache do histórico + máscaras de 60 bits
│       ├── rng.ts              # PRNG semeado (mulberry32) e utilidades
│       ├── statistical.ts      # z-score, shrinkage, tendência assinada, gaps
│       ├── features.ts         # modelo estrutural (soma, paridade, quadrantes...)
│       ├── portfolio.ts        # sampler condicionado + seleção diversificada
│       ├── wheel.ts            # fechamento por cobertura (set cover)
│       ├── backtest.ts         # walk-forward + IC bootstrap
│       ├── generators.ts       # os 13 modos de geração
│       ├── strategies.ts       # estratégias combinatórias
│       ├── ensemble.ts         # voto suave entre estratégias
│       ├── monteCarlo.ts       # busca de portfólio
│       ├── markov.ts           # matriz de transição temporal
│       ├── temporalTrend.ts    # tendência recente vs histórica
│       ├── simulator.ts        # simulador contra histórico
│       ├── statistics.ts       # frequência, atrasos, intervalos, significância
│       ├── wallets.ts          # carteiras de apostas
│       ├── sync.ts             # sincronização com as APIs
│       └── routes/             # endpoints HTTP
└── frontend/                   # Interface React
    └── src/
        ├── pages/              # Painel, Gerador (+ backtest), Carteiras, Análise, Sorteios
        ├── components/         # GameCard, NumberBall, SimulationDrawer, ...
        ├── hooks/              # useStatistics, useWallets, useStatus, ...
        └── lib/api.ts          # Cliente da API tipado
```

---

## 📐 O que dá para melhorar (e o que não dá)

O universo da Mega-Sena é de **50.063.860** combinações. Cada sorteio é independente: **nenhum filtro estatístico aumenta a chance de acertar as 6 dezenas**. O que o app otimiza de verdade:

| Alavanca | Efeito |
|---|---|
| **Cobertura da carteira** | Mais combinações distintas e menos sobreposição → maior chance de *algum* prêmio no conjunto. |
| **Realismo estrutural** | Bilhetes com soma/paridade/quadrantes/repetição parecidos com sorteios reais, sem combinações degeneradas. |
| **Menos rateio** | Evitar padrões populares (aniversários, sequências, finais repetidos) → se ganhar, divide com menos gente. |
| **Validação honesta** | Backtest walk-forward com IC mostra quando o "ganho" é só ruído. |

Números de referência: um jogo tem **0,6 acerto esperado** por sorteio e **1 chance em 2.332** de quadra. O backtest é a prova de que os modos não superam o acaso de forma confiável — e continuará sendo exibido para qualquer modo novo.

---

## ⚠️ Aviso importante

> Este projeto é uma ferramenta **educacional e estatística**. Nenhuma estratégia, algoritmo ou análise consegue prever ou garantir resultados de loteria, que são **sorteios independentes e aleatórios**. Os números de significância e os backtests existem justamente para deixar isso explícito. Jogue com responsabilidade e apenas o que puder gastar.

---

## 📜 Licença

Distribuído sob a licença ISC. Veja o arquivo de licença para mais detalhes.

---

<div align="center">

**Feito com 💙 para quem joga Mega-Sena com inteligência**

</div>
