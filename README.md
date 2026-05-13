# Finora

Sistema web de controle financeiro pessoal com frontend React, backend Express e banco SQLite via Prisma.

## Visao geral

O Finora foi pensado para uso pessoal, com foco em:

- controle de receitas, despesas e transferencias
- suporte a multiplos usuarios com dados separados por conta
- dashboard moderno com alertas, previsao e patrimonio
- importacao de extratos em CSV, OFX e PDF com texto
- uso no navegador do computador e do celular

## Stack utilizada

- `React 19`
- `Vite`
- `Express 5`
- `Prisma ORM`
- `SQLite`
- `JWT`
- `Recharts`
- `pdfjs-dist`
- `Lucide React`

## Funcionalidades principais

- cadastro, login e autenticacao local
- dashboard com saldo, entradas, saidas, taxa de economia e saldo previsto
- lancamentos com categorias, tags, observacoes, anexos e status
- parcelamentos e suporte a fatura por mes
- contas correntes, poupanca, dinheiro, investimento e cartao
- orcamentos mensais por categoria
- metas financeiras com prazo e progresso
- recorrencias com geracao manual de lancamentos
- relatorios com localizacao por moeda
- notificacoes e alertas financeiros
- patrimonio liquido consolidado
- importacao de CSV, OFX e PDF
- backup em JSON
- dark mode
- PWA instalavel

## Como rodar localmente

1. Instale o Node.js 20+.
2. Instale as dependencias:

```powershell
npm.cmd install
```

3. Crie o arquivo `.env` a partir de `.env.example`.
4. Inicie o projeto:

```powershell
npm.cmd start
```

5. Acesse:

```text
http://localhost:3333
```

## Desenvolvimento

```powershell
npm.cmd run dev
```

## Build de producao

```powershell
npm.cmd run build
```

## Variaveis de ambiente

Copie `.env.example` para `.env` e ajuste:

- `DATABASE_URL`
- `JWT_SECRET`
- `APP_PORT`

## Documentacao adicional

- [Guia Completo](./docs/GUIA_COMPLETO.md)
- [Deploy Linux](./docs/DEPLOY_LINUX.md)

## Observacoes importantes

- PDFs com texto sao suportados na importacao.
- PDFs escaneados como imagem ainda exigem OCR.
- O banco padrao e SQLite, bom para uso pessoal e pequeno volume.
- Para producao com varios acessos reais, vale considerar migracao futura para PostgreSQL.
