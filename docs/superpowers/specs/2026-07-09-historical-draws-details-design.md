# Histórico Detalhado de Sorteios

## Objetivo

Ampliar o sistema para preservar os dados oficiais de premiação retornados pelo serviço de loterias e criar uma tela dedicada `/sorteios` para consultar, filtrar e analisar qualquer concurso histórico.

## Escopo

Inclui a sincronização de dados de premiação, persistência compatível com registros existentes, API dedicada de concursos, análise contextual por concurso e uma nova tela responsiva. O comportamento atual de geração, simulação, estatísticas gerais e `/api/status` deve continuar funcionando.

## Dados preservados

Cada sorteio deve preservar concurso, data, local, dezenas na ordem do sorteio, dezenas ordenadas, concurso especial, premiações por faixa, estados e locais ganhadores, status de acumulação, próximo concurso, data do próximo concurso, arrecadação e valores acumulados/estimados quando retornados pelo serviço externo.

Premiações devem preservar descrição, faixa, quantidade de ganhadores e valor do prêmio. Listas e estruturas variáveis podem ser armazenadas como JSON. Registros antigos sem esses campos permanecem válidos e devem aparecer com uma indicação clara de dados de premiação indisponíveis.

## API

- `GET /api/draws`: lista paginada com `page`, `limit`, `search`, `from`, `to` e `accumulated`.
- `GET /api/draws/:concurso`: retorna o detalhe completo de um concurso.
- `GET /api/draws/:concurso/analysis`: retorna pares/ímpares, soma das dezenas, distribuição nas faixas 01–20, 21–40 e 41–60, além de comparação com médias históricas.

A listagem deve retornar metadados de paginação e um resumo suficiente para a lista. O detalhe deve retornar o registro completo. A análise deve ser calculada no backend usando o histórico armazenado.

## Tela `/sorteios`

O cabeçalho apresenta contexto, total de concursos e filtros. A lista mostra concurso, data, dezenas resumidas, status acumulou/não acumulou e valor da faixa principal. O concurso mais recente é selecionado inicialmente.

O painel de detalhe mostra dezenas em destaque, ordem do sorteio, local, faixas de premiação, acumulou, arrecadação, próximo concurso, estados/locais ganhadores e a análise contextual. Inclui navegação para concurso anterior e próximo.

Em mobile, filtros permanecem no topo, a lista aparece antes do detalhe e tabelas densas podem rolar horizontalmente. A tela usa o mesmo sistema visual da aplicação: navy/azul, amarelo de loteria, superfícies claras, estados de carregamento/erro/sem dados e foco acessível.

## Fluxo e compatibilidade

1. A tela carrega a primeira página e seleciona o concurso mais recente.
2. Busca, período e status atualizam a lista sem recarregar a aplicação.
3. Selecionar um concurso carrega detalhe e análise.
4. Paginação permite acessar todo o histórico sem carregar tudo de uma vez.
5. Ausência de premiação não impede resultado ou análise.
6. A sincronização atualiza concursos existentes sem apagar dados já persistidos.

## Validação

Testar parser/sincronização, migração e fallback de registros antigos, filtros, paginação, cálculo das métricas, rotas da API, navegação frontend, estados de erro e a nova tela em desktop e mobile. Executar testes de backend, lint e build do frontend.

## Arquitetura escolhida

Uma API dedicada de concursos é preferida a ampliar `/api/status` ou enviar todo o histórico bruto ao frontend. Isso mantém status operacional enxuto, permite paginação e concentra a análise histórica no backend.

