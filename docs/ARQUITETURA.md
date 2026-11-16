# Arquitetura do Family Home

Levantamento de 16/11/2026 sobre `main` em `12c2f48`. O repositório começou limpo e o [README](../README.md) foi preservado como registro da V1. Sua lista de próximos passos precede a sincronização, a reposição e o planejamento de refeições presentes no código atual.

## Correção local v0.10.19

A descrição abaixo preserva o estado auditado em `12c2f48`. Na correção local, [list-sync.js](../public/list-sync.js) calcula mudanças por ID e campo sobre a leitura atual do banco. Atualizações e exclusões condicionam a escrita ao `updated_at` lido e repetem a leitura se a versão mudou. Mudanças independentes coexistem. Conflitos no mesmo campo ficam pendentes para revisão. O [controller](../public/family-sync-v1.js) persiste a fila e o último estado por conta e família, consulta na reconexão e faz leitura periódica em primeiro plano como alternativa a eventos Realtime perdidos.

O documento legado é usado quando a tabela de listas está ausente ou vazia e existe histórico legado. Com dados relacionais, uma falha de leitura pausa a fila e o documento antigo permanece disponível para recuperação. O cliente nunca publica automaticamente a cópia global anterior à atualização. Uma cópia dessa versão local é preservada sob `fh-list-recovery-v1` quando disponível.

A rota usa fragmento da URL e armazenamento local. O editor guarda um rascunho por perfil, associado à lista em edição. Recorrência, arraste e importação PDF entram no mesmo fluxo de alterações. O carregamento automático dos importadores FamilyWall e do filtro temporal de Realtime foi retirado do HTML. Os importadores ficaram arquivados em maintenance/legacy, fora dos arquivos públicos da build. O service worker evita navegar uma janela aberta ao receber um clique em notificação.

O CI passou a rodar `npm test`. Os testes usam cliente e dados simulados. A versão local ainda precisa de validação em duas sessões reais e no app instalado no aparelho afetado, com publicação autorizada. O schema e as políticas implantadas seguem fora da verificação.

## Stack e artefatos

| Camada | Implementação e versão observável |
| --- | --- |
| SPA e build | React, React DOM, TypeScript estrito, Vite, plugin React e Lucide. Todos usam `latest` no manifesto, inclusive os tipos de React. Sem lockfile ou instalação local, as versões efetivas e transitivas da publicação são indeterminadas. |
| Runtime | Node 22 no GitHub Actions. Ambiente analisado com Node 24.14.1 e npm 11.11.0. O alvo TypeScript é ES2020, com bibliotecas ES2022 e DOM. |
| Versão do app | Manifesto npm `0.1.0`. Badge do produto `0.10.18`. Cache do worker `family-home-v26` e revisão do seu URL `125`. São controles distintos. |
| Dados remotos | Supabase JS UMD `2.58.0` via jsDelivr, Supabase Auth, PostgREST, Realtime, RPCs PostgreSQL e uma Edge Function invocada pelo cliente. A versão do banco e o estado do schema implantado não foram verificados. |
| PDF | PDF.js `3.11.174` e worker da mesma versão, carregados sob demanda pelo navegador via jsDelivr. |

## Estrutura e inicialização

- [index.html](../index.html) é a composição efetiva do produto. Carrega CSS por módulo, SDK e scripts globais em ordem declarada, o módulo React e scripts imperativos com `defer`. Registra o service worker no evento `load`.
- [src/main.tsx](../src/main.tsx) concentra raiz React, tipos, listas, painel de edição, categorias, gestos, histórico e regras de reposição. [src/styles.css](../src/styles.css) tem estilos base e padrões reutilizados de cabeçalho, botão, linha, menu e modal inferior. [src/vite-env.d.ts](../src/vite-env.d.ts) declara tipos do Vite.
- [public/app-shell.js](../public/app-shell.js) injeta `#fhShell` ao lado de `#root`. Renderiza módulos com HTML e liga eventos. Módulos adicionais em [public](../public) incrementam o DOM de React ou do shell usando seletores, `MutationObserver`, timers e eventos globais. Os estilos do shell e os CSS dos módulos compartilham padrões de cartões, abas, menu, folha, emojis e áreas seguras móveis. Não há biblioteca interna de componentes, tokens formais ou catálogo de componentes.
- [supabase/schema.sql](../supabase/schema.sql) é o único SQL no checkout e no histórico local consultado. É um script de bootstrap para executar no editor do Supabase, com tabelas, grants, RLS e publicação Realtime. Não há diretório de migrações versionadas ou código da Edge Function.
- [vite.config.ts](../vite.config.ts), [tsconfig.json](../tsconfig.json) e [package.json](../package.json) definem a build. [deploy.yml](../.github/workflows/deploy.yml) usa checkout, Node 22, `npm install`, `node --check` nos JS, `npm run build`, upload de `dist` e publicação no GitHub Pages por push em `main` ou execução manual. A base Vite, o manifest e o worker usam `/family-home/`.

## Navegação e experiência

| Entrada | Superfície e estado |
| --- | --- |
| Início | Shell com cartões de Listas, Calendário, Dias especiais, Refeições, Horários, Orçamento e atalho do Nubank injetado. Mercado também tem atalho por seletor DOM. |
| Listas | `showLists()` oculta o shell. React exibe índice ou detalhe com base em `activeId` e na presença do ID no array de listas. O chevron do detalhe limpa `activeId`; o botão Início injetado muda a tela do shell. |
| Outros módulos | `modulePage` renderiza e substitui o conteúdo do shell e dispara os aprimoramentos. Financeiro e Nubank abrem também em painéis sobre a tela. |
| Restauração | URL única, sem React Router, History API, rotas por hash ou SSR. O shell grava `fh-shell-route` e, no boot, restaura exclusivamente o valor `lists`. React grava `fh-active-list-id` separadamente. `createRoot` renderiza no cliente; não há hidratação de HTML de servidor. |

Há gestos de toque, `safe-area`, modais inferiores, media queries, controles grandes e ações de contexto. Vários componentes dependem de estrutura, classes e rótulos em português. A acessibilidade, o gesto real, o foco e a apresentação mobile não foram testados em dispositivo.

## Fluxos e fronteiras

1. **Listas.** React lê `family-home-lists` no `localStorage` ou usa listas iniciais. Salva localmente a cada mudança. Após vincular uma família, `window.familyHomeCloud` tenta ler as tabelas relacionais e recorre ao documento legado. Realtime de listas, categorias e itens agenda recarga das listas, propagada por `family-home-cloud-data`. O efeito React faz debounce de 500 ms e serializa suas gravações. O salvamento relacional faz upserts e removes por ausência no snapshot; em seguida atualiza a cópia JSON. Exclusão pelo React, arraste e importadores têm chamadas diretas adicionais.
2. **Auth.** [family-sync-v1.js](../public/family-sync-v1.js) usa sessão Supabase, email/senha, criação de conta e busca de associação por usuário, com `limit(1)` sem seletor de família. Sem sessão, exibe um modal de entrada quando o SDK e a configuração estão carregados. Com sessão sem associação, oferece criação de família e entrada por convite via RPC. O logout explícito recarrega a página. O papel familiar `owner/member` é separado do perfil financeiro `admin/user`.
3. **Mercado.** PDF é lido localmente e seu resumo é mostrado antes de um evento entregar os registros ao histórico React. Preço, quantidade, unidade, categorias e equivalência são processados no navegador. Histórico de compras e certos gastos locais também alimentam cálculos financeiros.
4. **Finanças.** Dashboard, razão, categorias, faturas, rateio e usuários consultam o Supabase diretamente. O orçamento legado e as ligações de compras usam também estado local. A escolha de escopo da interface é diferente da autorização do banco. Não há integração bancária automática identificada.
5. **Família e agenda.** Calendário, dias especiais, horários, cardápio, pessoas e metadados de tarefas usam estado local. Calendário agrega outras fontes locais. O calendário escolar tem um caminho de gravação no Supabase, cópia local e exportação ICS. Os provedores de calendário externo são apresentados como indisponíveis.
6. **PWA.** [sw.js](../public/sw.js) faz precache da página inicial, network-first para GET de mesma origem e fallback de HTML só para navegação quando o fetch rejeita. Os demais assets precisam ter entrado no cache via uso anterior. Scripts CDN ficam fora do cache do worker. O navegador registra subscriptions e o wrapper de atividade invoca `push-test` em algumas mudanças de lista. Notificações podem exibir nomes e ações de lista na tela bloqueada. O envio efetivo depende de infraestrutura externa ausente do Git.

[sync-config.js](../public/sync-config.js) contém URL e chave publicável do projeto entregue ao navegador, sem substituição via ambiente no pipeline. Nenhuma chave privilegiada foi identificada na busca por padrões do checkout. A chave publicável depende de políticas e grants corretos. Para rodar a aplicação em isolamento, é preciso interceptar chamadas e desabilitar integrações no ambiente de teste, pois `localhost` por si só não troca o backend. Não se identificou API própria, ambiente de staging versionado, configuração de observabilidade externa ou estratégia de recuperação versionada.

## Evolução registrada no Git

- `94754f2` introduziu o bootstrap de sincronização compartilhada. O contrato relacional evoluiu no cliente sem DDL correspondente no histórico local.
- `f8f1435`, `d87f2ef`, `ab3ee66` e `be75a71` expandiram equivalências da reposição preservando registros históricos. `48522dd` limitou a ação em lote aos produtos com previsão de até sete dias. `282d286` tratou descrição e quantidade em páginas distintas do PDF. `607eb0b` ajustou preços e unidades reais.
- `0b8afcf`, `1dab1bd`, `293c4a4` e `5478d8d` mostram intervenções na lista selecionada e na restauração do shell, inclusive para reinícios no iOS. `604e175` corrigiu fallback HTML para scripts offline. `83fc66f` serializou gravações do efeito React e restringiu aplicação de snapshots antigos. `9f0b87b` e `12c2f48` atualizaram versão/referências HTML da release.

## Verificações locais

| Checagem | Resultado |
| --- | --- |
| Sintaxe de `public/*.js` | `node --check` passou em 37 arquivos, inclusive scripts sem entrada ativa. |
| Build | `npm run build` executado, encerrou com código 1 na chamada de `tsc`, ausente. `vite build` e checagem de tipos não chegaram a rodar. |
| Dependências | `npm ls --depth=0 --offline` retornou `ELSPROBLEMS` por oito dependências diretas ausentes. Não há lockfile para auditar a árvore efetiva. |
| Lint e testes | Sem scripts, configurações ou suítes automatizadas rastreadas. A validação de sintaxe no CI não cobre comportamento. |
| Execução dirigida | Node VM com armazenamento, DOM mínimo, cliente de nuvem e PDF.js simulados verificou restauração do shell, falhas parciais de sync, sobrescrita entre dois clientes, recarga por recorrência e pelo importador legado, alvo de push e regras específicas do parser PDF. Ver [problemas conhecidos](PROBLEMAS_CONHECIDOS.md) e [funcionalidades](FUNCIONALIDADES.md). |
| Código sem entrada | `finance-category-correction.js`, `house-drag-v1.js` e `market-budget-batches.js` não estão no HTML e não têm referência de carga encontrada. O último é relevante porque o dashboard lê sua chave de batches. A condição requer revisão de qualquer versão antiga em cache antes de remover arquivos. |

Logs estão principalmente no console do navegador e em mensagens de formulário, alertas, estados locais do painel e confirmações. Algumas exceções são silenciadas, e certas respostas de banco são ignoradas. Não há monitoramento central, trilha confiável de alterações, correlação entre eventos e gravações ou telemetria para a navegação. A versão e disponibilidade de produção, a build publicada e o comportamento E2E ficaram fora das verificações locais.
