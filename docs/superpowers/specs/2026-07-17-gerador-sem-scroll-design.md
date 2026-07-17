# Design: Tela Gerador sem rolagem

**Data:** 2026-07-17  
**Escopo:** frontend (`frontend/src/pages/Gerador.tsx` e componentes relacionados)  
**Status:** Aprovado para implementação

## Problema

A tela `Gerador` atual apresenta três gargalos de altura que forçam rolagem vertical em resoluções comuns de notebook (1366×768 a 1920×1080):

1. O painel de configuração ocupa muita altura por empilhar campos verticalmente.
2. Os jogos gerados são exibidos em lista vertical, uma linha por jogo.
3. A tabela de resultados da simulação aparece abaixo dos jogos, aumentando ainda mais o scroll.

## Objetivo

Reorganizar a tela para que, no cenário típico de uso (gerar até 10 jogos e simular), toda a página caiba na viewport sem barras de rolagem, mantendo a usabilidade e as funcionalidades existentes.

## Princípios

- Não alterar a API/backend. Usar endpoints e contratos atuais.
- Preservar os 8 modos de geração existentes.
- Preservar a capacidade de digitar números fixos/excluídos/semente manualmente.
- Reduzir altura vertical sem esconder funcionalidades — usando grids, drawers e popovers.
- Manter a identidade visual atual (cores, tipografia, componentes shadcn/base-ui).

## Solução

### 1. Painel de configuração compacto

- Layout em grid de 2 colunas no desktop, 1 coluna no mobile.
- Ordem dos campos:
  - Coluna 1: Modo de geração (select) + Números fixos (com botão Selecionar)
  - Coluna 2: Quantidade de jogos (1–10) + Números excluídos (com botão Selecionar)
  - Linha extra abaixo, quando modo = `dreams`: Números semente (texto).
- Campos `fixed`, `exclude` e `seed` continuam como texto livre, permitindo digitação rápida.
- Botão “Gerar números” permanece abaixo dos campos, em largura total.

### 2. Helper flutuante de seleção de dezenas

- Ao clicar no botão “Selecionar” ao lado de “Números fixos” ou “Números excluídos”, abre um popover com grade 6×10 das 60 dezenas da Mega-Sena.
- Clique em uma dezena alterna sua seleção.
- Botão “Aplicar” preenche o campo de origem com os números escolhidos, formatados como `01,15,30`.
- O helper pode ser usado também como componente reutilizável para outros contextos futuros.

### 3. Resultados em grid

- Os jogos gerados deixam de ser lista vertical e passam para grid de 2 colunas no desktop, 1 coluna no mobile.
- Cada card (`GameCard`) mantém: label “Jogo X”, as 6 bolinhas e ações.
- Ações por card: “Simular” (primário) e “Copiar” (secundário).
- Quando há mais de 1 jogo, mantém o botão “Simular todos” no canto inferior direito da seção.
- “Simular” e “Simular todos” não mais renderizam a tabela na mesma página.

### 4. Simulação em drawer lateral

- Ao clicar em “Simular” (card) ou “Simular todos”, abre um drawer deslizando da direita.
- O drawer contém a tabela atual de resultados da simulação (acertos 6, 5, 4, 3), preservando colunas e dados.
- Ação “Salvar” do jogo simulado fica dentro do drawer.
- Fechamento via botão X, tecla Escape ou clique fora do drawer.
- Em telas pequenas, o drawer ocupa 100% da largura ou 90%, conforme necessário.

### 5. Aba “Simulador”

- A aba interna “Gerador de números / Simulador” é removida do `Gerador.tsx`.
- A simulação passa a ser ação secundária dos cards de jogo.
- As configurações de simulação (modo `historical` vs `random` e quantidade de sorteios) ficam dentro do drawer, em um pequeno painel fixo no topo do drawer.

## Componentes envolvidos / alterados

- `frontend/src/pages/Gerador.tsx`: reestruturação completa do layout, remoção da aba Simulador, integração com drawer.
- `frontend/src/components/GameCard.tsx`: adicionar ação “Copiar” e manter “Simular”.
- Novo componente `frontend/src/components/NumberPicker.tsx`: popover com grade 6×10 das dezenas.
- Novo componente `frontend/src/components/SimulationDrawer.tsx` (ou similar): drawer com configurações e tabela de simulação.
- Possível pequena alteração em `frontend/src/lib/api.ts` ou hooks se necessário para expor ação de simulação individual.

## Fluxo do usuário

1. Usuário escolhe modo e quantidade.
2. (Opcional) Clica em “Selecionar” para escolher fixos/excluídos no popover.
3. Clica em “Gerar números”.
4. Jogos aparecem em grid compacto.
5. Usuário clica em “Simular” em um jogo ou “Simular todos”.
6. Drawer abre pela direita mostrando configuração da simulação e a tabela de resultados.
7. Usuário pode salvar jogo direto do drawer.

## Critérios de aceitação

- [ ] A página `Gerador` não apresenta rolagem vertical em resolução 1366×768 quando gerados até 10 jogos.
- [ ] Todos os 8 modos de geração continuam funcionando.
- [ ] Campos de fixos/excluídos permitem digitação e seleção via popover.
- [ ] A simulação individual e “simular todos” abrem no drawer.
- [ ] A tabela de resultados continua mostrando acertos 6, 5, 4, 3 com porcentagens.
- [ ] A ação “Salvar jogo” funciona dentro do drawer.
- [ ] Layout responsivo: grid de jogos vira 1 coluna no mobile e drawer vira full-width/sheet.
- [ ] Nenhuma regressão nos testes existentes do backend (a API não muda).

## Não faz parte deste escopo

- Alterações no backend (`backend/src/generators.ts`, rotas, etc.).
- Mudanças nas páginas Dashboard, Análise, Sorteios ou Salvos.
- Adição de novos modos de geração.
- Mudança no banco de dados.
