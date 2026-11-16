# Funcionalidades do Family Home

Inventário do checkout `12c2f48`. A classificação reporta a evidência obtida nesta etapa.

| Classificação | Critério |
| --- | --- |
| Implementada e verificada | Comportamento executado localmente no recorte indicado, com dados simulados quando especificado. |
| Parcialmente implementada | Há implementação, com uma lacuna concreta no alcance solicitado ou coexistência de caminhos incompletos. |
| Encontrada no código, mas não verificada em execução | A entrada e a lógica existem no Git, sem verificação do fluxo em execução. |
| Não encontrada no repositório | Nenhuma implementação executável encontrada para o comportamento. |
| Necessita de esclarecimento | O comportamento depende do banco implantado, de requisitos ainda ambíguos ou de informação externa ao Git. |

## Mercado e listas

| Função | Classificação | Comportamento e evidência |
| --- | --- | --- |
| Criar e renomear listas, adicionar, concluir, reabrir, editar e excluir itens | Encontrada no código, mas não verificada em execução | Estado React, persistência em lista local e sincronizador. O menu agrupa ações para concluídos, exibição e histórico. [main.tsx](../src/main.tsx#L76) |
| Cadastro de produtos e categorias | Parcialmente implementada | Produto é um item da lista ou registro do histórico, com nome, quantidade, unidade, nota e preço opcionais. Categorias podem ser criadas, editadas, reordenadas e excluídas; itens da categoria removida vão para `other`. Não há catálogo independente de produtos. [main.tsx](../src/main.tsx#L105) |
| Edição inline | Parcialmente implementada | Tocar no item abre folha de edição no contexto da lista, com os dados preenchidos. Edição direta na própria linha não foi encontrada. [main.tsx](../src/main.tsx#L77) |
| Exclusão por swipe e arraste no Mercado | Encontrada no código, mas não verificada em execução | Swipe horizontal revela ação de exclusão. Arraste longo permite reorganizar itens entre categorias. [main.tsx](../src/main.tsx#L93), [market-drag-v1.js](../public/market-drag-v1.js) |
| Lista selecionada e recuperação da tela | Parcialmente implementada | O shell restaura `lists` no boot em simulação, enquanto React restaura um ID separado, desde que exista no snapshot. Outros módulos voltam ao início. Não se identificou conceito de lista ativa compartilhada. Ver [diagnóstico](PROBLEMAS_CONHECIDOS.md#navegação-inesperada). |
| Finalizar compra e histórico | Encontrada no código, mas não verificada em execução | Finalizar coleta itens concluídos ainda sem `recordedPurchaseAt`; marca-os, tira o preço dos itens e registra o preço no histórico. Histórico também recebe entradas manuais e importadas. [main.tsx](../src/main.tsx#L99) |
| Preço por unidade e comparação histórica | Encontrada no código, mas não verificada em execução | Histórico e reposição preferem preço unitário explícito quando disponível e podem dividir total por quantidade. O painel de preços agrupa histórico e compara unidades compatíveis. [main.tsx](../src/main.tsx#L15), [price-insights.js](../public/price-insights.js) |
| Reposição inteligente | Encontrada no código, mas não verificada em execução | Agrupa equivalentes no cálculo sem reescrever o histórico, calcula intervalo com datas distintas e reaproveita item da lista quando possível. A ação em lote considera previsões até sete dias, incluindo atrasados. Há lógica adicional de apresentação em [replenishment-v2.js](../public/replenishment-v2.js). [main.tsx](../src/main.tsx#L116) |
| Sincronização entre aparelhos e offline | Parcialmente implementada | Cache local, leitura relacional, Realtime, fallback JSON e fila em parte das operações. Há relatos de divergência entre usuários. As simulações confirmaram sucesso reportado depois de erros parciais e perda de adição quando o segundo cliente gravou um snapshot antigo. Recuperação offline, concorrência e entrega em dois aparelhos precisam de validação. |

## Notas fiscais

| Função | Classificação | Comportamento e evidência |
| --- | --- | --- |
| NFC-e por QR Code | Não encontrada no repositório | Sem câmera, leitura de QR ou serviço de consulta fiscal disparado pelo QR. |
| PDF da consulta NFC-e | Parcialmente implementada | Há seletor PDF, leitura no navegador, conferência editável e envio ao histórico. O parser usa coordenadas e rótulos específicos da consulta, sem OCR para documentos digitalizados. Não foi testado com arquivos reais. [receipt-pdf-import.js](../public/receipt-pdf-import.js#L71) |
| Extração, consistência e item em duas páginas | Implementada e verificada | Em VM, com coordenadas de texto simuladas, extraiu descrição, quantidade, unidade, preço unitário e total de um item repartido e rejeitou resumo com soma divergente. Também exige correspondência com a contagem declarada. |
| Normalização, equivalência e categorias | Implementada e verificada | No parser simulado, aliases representativos foram classificados em higiene e pets. O parser privilegia o prefixo mais específico, depois tenta casar item conhecido por nome limpo, reaproveita categoria conhecida e usa regras de categoria em ordem. Agrupa por nome limpo, unidade e preço unitário. Para reposição, React tem outra regra de equivalência (por exemplo, agrupa sachês por espécie e água de coco por nome canônico). A matriz inteira de aliases e a UI de conferência não foram executadas. |
| Deduplicação de nota | Parcialmente implementada | Em simulação, chave já presente bloqueou a importação. O código também confere a origem e o timestamp. O reconhecimento de chave fiscal fica restrito ao padrão `3526`; fallback usa número, série e data sem emissor. Não há proteção transacional ou deduplicação entre aparelhos demonstrável. [receipt-pdf-import.js](../public/receipt-pdf-import.js#L84) |
| Registro durável de quantidades, valores e linhas | Encontrada no código, mas não verificada em execução | Revisão exige nomes não vazios; grava unidades, totais, preços unitários, chave e rastreabilidade da linha no histórico via evento em janela. O modal fecha após emitir o evento. A gravação remota só ocorre depois no fluxo React. |

## Finanças

| Função | Classificação | Comportamento e evidência |
| --- | --- | --- |
| Contas, cartões, despesas, entradas e histórico | Encontrada no código, mas não verificada em execução | Razão cria contas e lançamentos Supabase, com direção, estado e competência, e lista até 100 lançamentos. Dashboard edita entradas e agrega por mês. [finance-ledger.js](../public/finance-ledger.js), [finance-dashboard.js](../public/finance-dashboard.js) |
| Pagas e pendentes | Encontrada no código, mas não verificada em execução | Dashboard lê situação de pagamento, data efetiva e vencimento. RPC alterna o pagamento após confirmação para marcar como pago. O resultado no banco depende da RPC externa. |
| Dashboard mensal, orçamentos e planejado × realizado | Encontrada no código, mas não verificada em execução | Seleção de competência/escopo, saldo, entradas, despesas e realizado. Categorias remotas têm limites mensais. Há orçamento legado local e agregação de Mercado/Pets a partir de registros do dispositivo. |
| Metas financeiras estruturadas | Não encontrada no repositório | Existem limites de orçamento e listas semeadas de objetivos; não foi encontrada entidade/fluxo de meta financeira com valor alvo, prazo e evolução. |
| Faturas, parcelas, Nubank e rateio familiar | Encontrada no código, mas não verificada em execução | Trilha de faturas e parcelas, painel Nubank com fatura única, filtros família/indivíduo, dados pessoais importados e edição/exclusão. Rateio aparece no escopo familiar para perfil admin. [finance-nubank-shared.js](../public/finance-nubank-shared.js), [finance-split.js](../public/finance-split.js) |
| Importação financeira automática e sincronização bancária | Não encontrada no repositório | Há leitura de registros já importados e referências a planilhas. Não foi encontrado fluxo de importação da planilha ou conexão com o banco no produto atual. |
| Autorização financeira real | Necessita de esclarecimento | A interface distingue `admin/user`, limita seleção e oferece gerenciamento por RPC a admins. A efetividade da autorização, isolamento por proprietário/família e integridade do rateio dependem de políticas e funções que não estão no Git. |

## Família, agenda e experiência móvel

| Função | Classificação | Comportamento e evidência |
| --- | --- | --- |
| Conta e família por convite | Encontrada no código, mas não verificada em execução | Email/senha, criação de conta, grupo e adesão por convite. A associação familiar e o perfil financeiro são distintos. |
| Pessoas, categorias e responsáveis em tarefas domésticas | Encontrada no código, mas não verificada em execução | Gerenciamento local de pessoas e categorias, responsável, detalhes, conclusão e recorrência/lembrete. Metadados por nome de tarefa. [house-tasks.js](../public/house-tasks.js), [task-details-v1.js](../public/task-details-v1.js) |
| Recorrência reabre tarefa vencida | Implementada e verificada | Em VM, uma tarefa concluída e vencida voltou a pendente e acionou reload pelo caminho de reconciliação em execução. Entrega de lembrete real não foi testada. [task-recurrence-reminders.js](../public/task-recurrence-reminders.js#L32) |
| Consolidação doméstica e por pessoa | Parcialmente implementada | Shell combina listas e módulos. Calendário agrega eventos, refeições, horários, dias especiais e tarefas. Pessoas participam de horários e atribuições. Metadados e planejamento permanecem específicos do aparelho. |
| Refeições | Encontrada no código, mas não verificada em execução | Planejamento semanal por tipo de refeição e data, preferências de visibilidade e inclusão na agenda. Não foi encontrada geração de lista de compras a partir do cardápio. [app-shell.js](../public/app-shell.js#L42), [calendar-experience-v2.js](../public/calendar-experience-v2.js) |
| Agenda escolar e provedores de calendário | Parcialmente implementada | A importação usa catálogo escolar embutido, grava registros e permite exportar ICS. Sem OAuth, sincronização Google/Outlook/iCloud ou importador genérico de arquivo de agenda. |
| PWA, mobile e feedback | Parcialmente implementada | Manifest standalone, navegação por cartões, folhas e gestos, confirmações, feedback de formulários. Persistência por tela e confiabilidade offline são parciais. Rascunhos de listas podem sumir em reload, e falhas de sincronização podem aparecer só no console. A avaliação de facilidade de uso, responsividade, instalação e acessibilidade permanece pendente em dispositivos. |
| Estoque doméstico | Não encontrada no repositório | Citado no README histórico, sem fluxo, modelo ou acesso correspondente. |
