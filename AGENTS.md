# Family Home

Family Home é uma PWA familiar em português do Brasil. Em tarefas de manutenção, leia o [inventário funcional](docs/FUNCIONALIDADES.md), a [arquitetura](docs/ARQUITETURA.md), o [modelo de dados](docs/MODELO_DADOS.md) e os [problemas conhecidos](docs/PROBLEMAS_CONHECIDOS.md) relevantes ao escopo.

## Organização e convenções

- `src/main.tsx` concentra listas React, estado e regras de Mercado. `src/styles.css` contém seus estilos. Preserve o TypeScript estrito e mantenha dados legados legíveis.
- `index.html` define os scripts e CSS ativos. Verifique seletores, eventos, ordem de carregamento e mudanças de DOM ao tocar em React ou em `public/`. Preserve o caminho-base `/family-home/`.
- Use rótulos em pt-BR, formatos locais de moeda BRL e unidades reais de compra. Preserve equivalências usadas na reposição, categorias de Mercado, higiene e pets, agrupamento fiscal, histórico e marcadores de finalização. Verifique fluxos históricos antes de modificar uma regra.
- `supabase/schema.sql` descreve parte do backend. Para mudanças em tabelas, políticas ou RPCs ausentes, obtenha a definição autorizada antes de assumir nomes, permissões, constraints ou cascatas.
- Preserve alterações locais já existentes. Limite as edições ao escopo e mantenha os documentos consistentes quando o comportamento descrito mudar.

## Desenvolvimento e validação

- Consulte scripts em `package.json`. Use `npm run dev` quando as dependências estiverem presentes. Antes de navegar na versão local, isole o backend e use fixtures sintéticas ou um projeto de teste autorizado, pois o config público aponta para o backend compartilhado.
- Execute `npm run build` com as dependências disponíveis. Esse comando roda `tsc` e `vite build`. `npm run preview` serve a build e também requer isolamento das integrações.
- O CI usa Node 22 e `node --check` nos JS de `public`. Em Bash, use `for file in public/*.js; do node --check "$file" || exit 1; done`. Em PowerShell, use `Get-ChildItem public -Filter *.js | ForEach-Object { node --check $_.FullName; if ($LASTEXITCODE -ne 0) { throw $_.Name } }`.
- Rode `npm test` para verificar sincronização e PWA com dados simulados, sem dependências adicionais. O projeto segue sem script de lint. Registre as verificações que de fato executou. Quando uma tarefa alterar listas/sync, teste o fluxo pela entrada normal, concorrência, reconexão, recarga e divergência de estado. Para PWA, confira a seleção e restauração de tela com cache e service worker em ambiente isolado. Para PDF e finanças, use dados sintéticos e valide totais, falhas e repetição conforme o escopo.

## Dados, credenciais e operações

- Não exponha segredos, tokens, endpoints de assinatura push, convites, dados familiares ou financeiros em logs, documentação ou resultados. Trate URLs/chaves publicáveis como configuração do cliente e mantenha credenciais privilegiadas fora de assets web.
- Confirme RLS e autorização na camada de dados para operações sensíveis. Restringir controles de UI é uma medida de experiência. Tenha em conta contas múltiplas, dados antigos, isolamento por família e consistência após falhas parciais.
- Durante investigação, simule gravações e use dados de teste. Não altere dados de produção, não execute operações destrutivas ou migrações e não faça deploy sem aprovação explícita. Observe que enviar alterações para `main` pode disparar publicação. Não faça commits ou pushes sem autorização.
- Quando faltar configuração ou dependência para validar, descreva a limitação. Não substitua dependências, credenciais ou configurações do ambiente fora do escopo autorizado.
