# Modelo de dados do Family Home

O inventário diferencia DDL versionado, contratos inferidos das chamadas do frontend e armazenamento local. A auditoria se baseia no Git em `12c2f48`, sem consultar um banco implantado.

## DDL versionado

Fonte única: [supabase/schema.sql](../supabase/schema.sql).

| Entidade | Chave e campos relevantes | Relações e ciclo de vida |
| --- | --- | --- |
| `auth.users` | ID Supabase Auth | Referenciado como proprietário, membro ou autor de atualização. Credenciais geridas pelo Supabase Auth. |
| `families` | UUID, nome, `invite_code` único, `owner_id`, `created_at` | Proprietário obrigatório. A exclusão dessa conta em `auth.users` tem cascade para a família. |
| `family_members` | PK `(family_id,user_id)`, `display_name`, papel `owner/member`, `joined_at` | Liga contas e famílias, permitindo várias associações. As duas FKs têm cascade. Cliente elege uma associação sem ordem explícita. |
| `family_documents` | PK `(family_id,doc_key)`, `payload jsonb`, `updated_at`, `updated_by` | Família em cascade, autor em set null. Para `doc_key='lists'`, o cliente armazena um snapshot completo da coleção. Publicada em `supabase_realtime` neste SQL. |

RLS habilitada nas três tabelas públicas. A função `private.user_family_ids()` usa `auth.uid()`, `SECURITY DEFINER`, `search_path` vazio e execução restrita a `authenticated`. Grupos e membros são legíveis por membros da família. Qualquer membro pode ler, inserir, atualizar e excluir documentos da sua família. Inserção e atualização exigem `updated_by = auth.uid()`. O papel familiar não restringe a exclusão de documentos. O código de convite fica legível aos membros conforme grants e RLS versionados.

`create_family` cria grupo e associação do proprietário na mesma função. `join_family` valida o código e registra associação como membro ou atualiza o nome da associação existente. Ambas são `SECURITY DEFINER`, verificam usuário autenticado, fixam `search_path` e restringem execução. Não há rotação/expiração de convite ou administração da associação implementada no SQL versionado.

## Contratos remotos observados nas chamadas

Os vínculos abaixo descrevem como o cliente consulta ou grava. Declarações de FK, índices/uniqueness, tipos físicos, triggers, RLS, grants, publicação Realtime e privilégios destas tabelas não constam do Git.

| Tabela | Campos e vínculo inferido | Operações |
| --- | --- | --- |
| `family_lists` | `id`, `family_id`, `client_key`, `name`, `emoji`, `sort_order`, `extra`, `updated_at` | Uma lista por chave de cliente dentro da família no contrato de upsert. Histórico e marcadores de importação em `extra`. |
| `list_categories` | `id`, `list_id`, `client_key`, `name`, `emoji`, `sort_order`, `updated_at` | Upsert por lista/chave. Categoria `other` é virtual na sincronização. |
| `list_items` | `id`, `list_id`, `category_id`, `client_key`, `name`, `done`, `note`, `sort_order`, `data`, `updated_at` | Upsert por lista/chave. `data` leva quantidade, unidade, preço e data de finalização; categoria ausente é nullable no contrato do cliente. |
| `finance_users` | `family_id`, `user_id`, `name`, `email`, `role` | Perfil financeiro ligado à conta. RPCs `finance_register_member` e `finance_update_user` administram perfis pela interface. |
| `finance_accounts` | `family_id`, `owner_id`, `name`, `kind` | Cadastro de conta, cartão, dinheiro ou outro. `owner_id = null` representa escopo familiar nas consultas. |
| `finance_transactions` | `id`, `family_id`, `owner_id`, `account_id`, `title`, `amount`, `direction`, `status`, `category`, `competence`, `due_date`, `payment_status`, `paid_on` | Entradas e despesas em BRL, competência separada do pagamento; categorias usadas também por nome. Criação pelo razão, edição/pagamento por `finance_edit_entry` e `finance_set_payment`. A fatura é um lançamento agregado. |
| `finance_categories` | `id`, `family_id`, `name`, `monthly_limit` | Inserção pelo cliente e edição por `finance_edit_category`. Rateio mensal chamado por `finance_monthly_split`. |
| `finance_card_lines` | `id`, `statement_transaction_id`, `title`, `amount`, `installment_label`, `source_row`, `allocation`, `category` | Vínculo por ID da fatura. RPCs `finance_edit_card_line`, `finance_delete_card_line`, `finance_save_card_line`. Cliente consulta total após operações. |
| `finance_nubank_personal_import` | `id`, `family_id`, `person`, `description`, `amount`, `installment`, `note`, `month` | Consulta, edição e exclusão diretas por família e ID; filtro pessoal por rótulo. A origem e pipeline do conjunto importado não estão versionados. |
| `family_calendar_events` | `family_id`, `source_key`, `title`, `event_date`, `all_day`, `calendar_name`, `notes`, `source_document`, `created_by` | O importador faz upsert ignorando conflitos por família/chave, após consultar perfil financeiro; mantém cópia local. |
| `push_subscriptions` | `id`, `family_id`, `user_id`, `endpoint`, `p256dh`, `auth`, `user_agent`, `updated_at` | O cliente registra, localiza e desativa o endpoint do usuário. O código de servidor de `push-test` não está versionado. |

A fonte para listas e push é [family-sync-v1.js](../public/family-sync-v1.js). Para finanças, ver [finance-dashboard.js](../public/finance-dashboard.js), [finance-ledger.js](../public/finance-ledger.js), [finance-users.js](../public/finance-users.js), [finance-split.js](../public/finance-split.js), [finance-card-details.js](../public/finance-card-details.js) e [finance-nubank-shared.js](../public/finance-nubank-shared.js). Para agenda, ver [calendar-school-import.js](../public/calendar-school-import.js).

## Estado no navegador

| Chaves | Conteúdo e regras |
| --- | --- |
| `family-home-lists` | Array de listas com `id/name/emoji`, itens, categorias e histórico. Itens têm `id/name/done` e dados opcionais como `category/quantity/unit/note/price/recordedPurchaseAt`. Fallback inicial traz listas semeadas. |
| `purchaseHistory` na lista | Registros com `id/itemName/purchasedAt`, categoria, quantidade, unidade, preço total e unitário opcionais. PDF acrescenta `receiptKey/source/receiptLines` com rastreio da descrição, código e posição; esses campos extras são preservados no snapshot. |
| `fh-shell-route`, `fh-active-list-id`, `family-home-last-category` | Estado de tela, lista e preferência. O editor mantém o rascunho principalmente no estado React; um reload perde os campos ainda não enviados. |
| `fh-house-meta-v1`, `fh-house-cats-v1`, `fh-house-people-v1` | Categorias/responsáveis/detalhes e recorrência. Metadados usam nome de tarefa normalizado como chave, com risco de colisão entre tarefas homônimas. |
| `fh-calendar-v1`, `fh-special-v1`, `fh-timetable-v1`, `fh-meals-v1`, `fh-meal-visible-v1` | Agenda, datas especiais, horários, refeições e preferência. A agenda escolar também pode escrever no banco. |
| `fh-budget-v1`, `fh-budget-view-v1`, `fh-market-batches-v1`, `fh-home-profile-v1` | Orçamento antigo e suas categorias/transações, preferência de visão, lotes de compra e personalização do início. A chave de lotes tem consumidor ativo, mas o produtor dedicado está fora do HTML. |

O navegador isola essas chaves por origem, e o código usa chaves globais dentro dela. O logout preserva as chaves de listas, tarefas, calendário e orçamento. A origem e o cache PWA não constituem isolamento por membro ou família.

## Autoridade, integridade e recuperação

A leitura dá preferência à estrutura relacional. Erros nas listas/filhos e a ausência de linhas de lista provocam fallback para o legado; erro no legado retorna `null`. O boot React pode tratar `null` e array vazio como sinal para publicar sua cópia local. A gravação relacional é uma sequência de requisições e remove registros que o snapshot não contém. A cópia `family_documents` registra a última gravação bem-sucedida desse passo, sem versionamento ou histórico de restauração. Erros devolvidos por certas operações não são propagados como falha global. Afinidade entre categoria e lista, cascatas relacionais, limites de API e consistência dos totais financeiros precisam ser verificados no backend real.

A deduplicação fiscal usa informações do histórico carregado no aparelho. Não há entidade própria de nota fiscal, chave única por família ou transação para nota e linhas no SQL versionado. Esse desenho deixa concorrência entre dispositivos, correções e reversões dependentes da sincronização do snapshot.

Há cache local e snapshot JSON de compatibilidade, sem retenção, backup independente, restauração testada ou política de recuperação documentada. Backups gerenciados, PITR, retenção, política de acesso, registros de auditoria e rotina de restauração do projeto Supabase permanecem pendentes de verificação.
