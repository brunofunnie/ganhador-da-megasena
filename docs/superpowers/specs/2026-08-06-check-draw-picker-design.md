# Escolher concurso na checagem de jogos da carteira

**Data:** 2026-08-06
**Escopo:** `frontend/src/pages/Carteiras.tsx` (`WalletDetailView`). Sem mudança de backend.

## Problema

O botão "Checar com o sorteio atual" só compara os jogos da carteira com o último sorteio (`status.latestDraw`). O usuário quer escolher com qual concurso checar.

## Solução

### Estado

- Novo estado `checkConcurso: number | null` em `WalletDetailView` (inicial `null`).
- Ao ligar o toggle de checagem, se `checkConcurso` for `null`, inicializa com `status.latestDraw.concurso`.
- Desligar o toggle mantém o valor (religar volta no mesmo concurso).

### Dados

- Buscar o concurso selecionado com o hook existente `useDraw(checkDraw ? checkConcurso : null)` (React Query, já cacheado; usar `placeholderData: keepPreviousData` no hook se ainda não houver, para evitar flicker ao navegar).
- `drawnNumbers` passa a derivar de `draw.dezenas` do concurso selecionado — não mais de `status.latestDraw.dezenas`.
- O botão de toggle fica habilitado quando `status.latestDraw` existe (igual hoje).

### UI

- Rótulo do botão muda de "Checar com o sorteio atual" para "Checar sorteio" (mesmo estilo/toggle).
- Com o toggle ligado, aparece ao lado um stepper: botão `◀` (concurso − 1), input numérico com o concurso, botão `▶` (concurso + 1).
  - Limites: mínimo 1, máximo `status.latestDraw.concurso`. `▶` desabilitado no último; `◀` desabilitado no 1.
  - Digitar número direto também funciona; valores fora dos limites são normalizados (clamp) ao sair do campo/Enter.
- Header da coluna de acertos mostra o concurso: `Acertos (2870)`.
- `GameCard` (modo cards) e destaque das dezenas usam as mesmas `drawnNumbers` — sem mudança estrutural.
- "Ordenar por acertos" continua igual — já deriva de `drawnNumbers`.

### Erros e carregamento

- Concurso inexistente (404): texto pequeno "Concurso não encontrado" perto do stepper; nenhuma dezena destacada; coluna Acertos oculta valores (drawnNumbers vazio ⇒ 0 acertos é aceitável, mas preferir não destacar).
- Carregando: sem destaque até os dados chegarem (com `keepPreviousData` só ocorre na primeira busca).

## Testes

- Se houver infra de teste no frontend, cobrir: default = último concurso; navegação com setas respeita limites; `drawnNumbers` vem do concurso selecionado.
- Verificação manual: `npm run dev`, abrir carteira, ligar checagem, navegar concursos, conferir acertos/destaques.

## Fora de escopo

- Dropdown/modal de seleção de concursos.
- Mudanças no Dashboard ou em outras telas.
- Persistir concurso escolhido entre sessões.
