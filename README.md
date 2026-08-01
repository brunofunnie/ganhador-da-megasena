<p align="center">
  <img src="https://img.shields.io/badge/Mega%20Sena-Intelig%C3%AAncia%20de%20Jogos-075ca8" alt="Mega Sena Inteligência de Jogos">
  <img src="https://img.shields.io/badge/React%2019-%230d2d62" alt="React 19">
  <img src="https://img.shields.io/badge/Node%20%2B%20Express-blue" alt="Node + Express">
  <img src="https://img.shields.io/badge/SQLite-%23075ca8" alt="SQLite">
</p>

<div align="center">

# 🍀 GanhaDorDaMegaSena

### Inteligência para os seus jogos da Mega-Sena

> Gere combinações com **12 algoritmos de IA**, compare contra **3.000+ concursos reais**, cheque seus jogos com o sorteio atual e organize tudo em **carteiras de apostas** — tudo em uma interface moderna e responsiva.

</div>

---

## ✨ Recursos

### 🤖 Gerador inteligente — 12 estratégias de IA

| Estratégia | O que faz |
|---|---|
| 🎲 **Aleatório Puro** | Combinações aleatórias do universo de 60 números |
| 🔥 **Quentes** | Ponderado pelos números **mais sorteados** de todo o histórico |
| ❄️ **Frios** | Ponderado pelos números **mais atrasados** (há mais tempo sem sair) |
| ⚖️ **Balanceado 3P-3I** | 3 pares + 3 ímpares para distribuição equilibrada |
| 🧬 **Genético** | Mistura dos 3 mais quentes com os 3 mais frios |
| 🔢 **Sequências** | Prioriza números **primos e da sequência de Fibonacci** |
| 🎯 **Fechamento** | Combinações a partir de um fechamento com cobertura ampla |
| 💭 **Sonhos** | Números-semente escolhidos por você (jogo dos sonhos) |
| 📈 **Tendência Temporal** | Detecta números em **alta recente** comparando frequência atual vs. histórica |
| 🎲 **Monte Carlo** | Simula dezenas de milhares de jogos e retorna os de **melhor desempenho médio** contra o histórico |
| 🗳️ **Ensemble** | **Votação entre estratégias** — cada estratégia "vota" e os mais votados vencem |
| 🔗 **Markov** | **Cadeia de Markov** modela a probabilidade de transição entre números |

### 🧪 Simulador de sorteios

- Compare seus jogos contra o **histórico real** ou contra uma **amostra aleatória** (até 100.000 sorteios)
- Veja a **incidência de acertos** por faixa (6, 5, 4 e 3 acertos) com porcentagens
- Resultados **ordenados pelos melhores** — os jogos com mais acertos primeiro

### 👛 Carteiras de apostas

- Guarde grupos de jogos em **carteiras nomeadas** (ex: "Mega da Virada", "Aposta do mês")
- **Finalize** uma carteira como rótulo de organização — e continue adicionando jogos depois
- Visualize em **tabela compacta** (padrão) ou **cards** selecionáveis
- **Cheque seus jogos com o sorteio atual** — os números acertados ficam destacados em amarelo
- **Copie todos os jogos** de uma carteira (um por linha) direto para o clipboard
- **Proteção contra duplicados**: jogos repetidos são rejeitados e carteiras antigas são limpas automaticamente
- Nome padrão inteligente: **"Concurso X"** com o número do próximo sorteio

### 📊 Análise completa

- Tabela de **frequência** de todos os 60 números (vezes sorteadas + porcentagem)
- **Top 15** mais frequentes e **mais atrasados**
- Grade visual de frequência 01–60
- Distribuição **pares × ímpares** por concurso
- Tabela de **intervalos (gaps)** — quanto tempo cada número fica sem sair entre aparições, com legenda explicativa e janela configurável (últimos 10 a 1.000 sorteios)

### 📅 Sorteios

- Histórico completo com **paginação e filtros** (busca por concurso, intervalo de datas, acumulado)
- Detalhe de cada concurso: dezenas, ordem do sorteio, **premiação completa**, locais dos ganhadores e **análise da soma/paridade** comparada à média histórica

### 🖥️ Painel (Dashboard)

- Último sorteio em destaque
- Total de concursos, número mais frequente e maior atraso
- Gráficos de **top 10 frequentes** e **top 10 atrasados**
- Distribuição de pares e ímpares

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
- Vitest (testes: **83 testes passando**)

**Dados**
- Sincronização automática com a **API pública da Caixa** (loteriascaixa-api) — resultados oficiais atualizados a cada inicialização

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
| **Backend** | http://localhost:3001 |
| **API** | http://localhost:3001/api |

> No primeiro boot, o backend baixa automaticamente todo o histórico oficial da Mega-Sena. Depois disso, os resultados ficam armazenados em SQLite local (`backend/data/megasena.db`).

### Rodando separadamente

```bash
# Backend (porta 3001)
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

### Testes

```bash
cd backend && npm test      # 83 testes
```

---

## 📡 API

Tudo sob `/api`:

| Método | Rota | Descrição |
|---|---|---|
| `GET` | `/status` | Status do banco + último sorteio + próximo concurso |
| `POST` | `/sync` | Sincroniza resultados com a API da Caixa |
| `GET` | `/statistics` | Frequência, atrasados e paridade |
| `GET` | `/statistics/intervals?window=N` | Tabela de intervalos (gaps) dos últimos N sorteios |
| `GET` | `/generate?mode=X&count=N` | Gera jogos (12 modos de IA) |
| `GET` | `/simulate?numbers=X&mode=Y` | Simula jogos contra histórico/aleatório |
| `GET` | `/draws` | Histórico paginado e filtrável |
| `GET` | `/draws/:concurso` | Detalhe de um concurso |
| `GET` | `/draws/:concurso/analysis` | Análise comparativa de um concurso |
| `GET/POST` | `/wallets` | Lista/cria carteiras |
| `GET/PATCH/DELETE` | `/wallets/:id` | Obtém/atualiza/exclui carteira |
| `POST` | `/wallets/:id/games` | Adiciona jogo (rejeita duplicados) |
| `DELETE` | `/wallets/:id/games/:gameId` | Remove um jogo |

---

## 📁 Estrutura do projeto

```
├── backend/                 # API + inteligência
│   └── src/
│       ├── generators.ts    # 12 estratégias de geração
│       ├── monteCarlo.ts    # Simulação Monte Carlo
│       ├── ensemble.ts      # Votação entre estratégias
│       ├── markov.ts        # Cadeia de Markov
│       ├── temporalTrend.ts # Tendência temporal
│       ├── strategies.ts    # Estratégias combinatórias
│       ├── simulator.ts     # Simulador contra histórico
│       ├── statistics.ts    # Frequência, atrasos, intervalos
│       ├── wallets.ts       # Carteiras de apostas
│       ├── sync.ts          # Sincronização com API da Caixa
│       └── routes/          # Endpoints HTTP
└── frontend/                # Interface React
    └── src/
        ├── pages/           # Painel, Gerador, Carteiras, Análise, Sorteios
        ├── components/      # GameCard, NumberBall, SimulationDrawer, ...
        ├── hooks/           # useStatistics, useWallets, useStatus, ...
        └── lib/api.ts       # Cliente da API tipado
```

---

## ⚠️ Aviso importante

> Este projeto é uma ferramenta **educacional e estatística**. Nenhuma estratégia, algoritmo ou análise consegue prever ou garantir resultados de loteria, que são **sorteios 100% aleatórios**. Jogue com responsabilidade e apenas o que puder gastar.

---

## 📜 Licença

Distribuído sob a licença ISC. Veja o arquivo de licença para mais detalhes.

---

<div align="center">

**Feito com 💙 para quem joga Mega-Sena com inteligência**

</div>
