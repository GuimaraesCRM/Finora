# Guia Completo do Finora

## 1. O que e o Finora

O Finora e um sistema web de controle financeiro pessoal com foco em uso individual ou familiar leve. Ele permite registrar movimentacoes, organizar contas, acompanhar metas, controlar orcamentos e analisar a saude financeira em uma interface moderna e responsiva.

## 2. Objetivos do projeto

- centralizar o controle financeiro em um unico lugar
- permitir uso diario no computador e no celular
- manter os dados separados por usuario
- oferecer uma experiencia visual moderna
- suportar importacao de extratos e historicos financeiros

## 3. Tecnologias utilizadas

### Frontend

- `React 19`: construcao da interface
- `Vite`: ambiente de desenvolvimento e build
- `Recharts`: graficos e relatorios
- `Lucide React`: icones
- `pdfjs-dist`: leitura de PDF no navegador

### Backend

- `Node.js`: runtime
- `Express 5`: API HTTP
- `Zod`: validacao de payloads
- `JWT`: autenticacao baseada em token
- `bcryptjs`: hash de senha
- `helmet`: headers de seguranca
- `cors`: controle de acesso entre frontend e API

### Banco e persistencia

- `Prisma ORM`: acesso ao banco e modelagem
- `SQLite`: banco padrao do projeto

### Experiencia de uso

- `PWA`: instalavel no navegador
- `localStorage`: persistencia de tema e token no cliente

## 4. Arquitetura geral

O projeto esta dividido em tres blocos:

- `src/`: frontend React
- `server/`: API Express
- `prisma/`: schema e banco

Fluxo resumido:

1. o usuario acessa a interface web
2. faz login ou cria conta
3. o frontend consome a API autenticada com JWT
4. a API valida os dados com Zod
5. o Prisma persiste e consulta dados no SQLite

## 5. Funcionalidades implementadas

### 5.1 Autenticacao e usuarios

- setup inicial do primeiro usuario
- cadastro de multiplos usuarios
- login com e-mail e senha
- isolamento de dados por conta
- moeda por usuario

### 5.2 Dashboard

- saldo do mes
- total de entradas
- total de saidas
- taxa de economia
- saldo previsto com base em recorrencias
- saude financeira com score
- lista de alertas
- resumo de cartoes
- ultimos lancamentos

### 5.3 Lancamentos

- receitas
- despesas
- transferencias
- status pago ou pendente
- tags
- observacoes
- anexos
- filtros avancados
- edicao e exclusao

### 5.4 Parcelamentos e cartoes

- criacao de despesas parceladas
- distribuicao de parcelas por mes
- controle de mes de fatura
- limite do cartao
- dia de fechamento
- dia de vencimento

### 5.5 Contas

- conta corrente
- poupanca
- dinheiro
- cartao
- investimento
- cor personalizada
- conta marcada como compartilhada

### 5.6 Orcamentos

- orcamento mensal por categoria
- comparacao entre limite e gasto realizado
- alertas por aproximacao e estouro

### 5.7 Metas

- valor alvo
- valor ja guardado
- prazo final
- cor visual

### 5.8 Recorrencias

- receitas recorrentes
- despesas recorrentes
- frequencia semanal, mensal e anual
- geracao manual do proximo lancamento

### 5.9 Relatorios

- fluxo mensal
- categorias com maior gasto
- comparativo mensal
- medias por categoria
- localizacao por moeda
- exportacao para PDF via impressao

### 5.10 Patrimonio

- total de ativos
- total de dividas
- patrimonio liquido
- distribuicao por conta
- visao de contas compartilhadas

### 5.11 Importacao

- CSV
- OFX
- PDF com texto
- sugestao automatica de categoria

Limite atual:

- PDF escaneado como imagem ainda nao possui OCR

### 5.12 PWA e experiencia mobile

- interface responsiva
- instalacao via navegador
- funcionamento como app web no celular
- dark mode persistente

## 6. Banco de dados

### Entidades principais

- `User`
- `Account`
- `Category`
- `Transaction`
- `Attachment`
- `Budget`
- `Goal`
- `Recurring`

### Decisoes de modelagem

- todos os dados importantes pertencem a um `userId`
- valores monetarios sao persistidos em centavos
- anexos ficam hoje em `base64` no banco
- transacoes suportam `installmentGroupId`, `installmentNumber`, `installmentTotal` e `invoiceMonth`

## 7. Seguranca atual

- senhas com hash em `bcrypt`
- autenticacao com `JWT`
- headers de seguranca com `helmet`
- validacao de entrada com `Zod`
- separacao de dados por usuario em todas as consultas relevantes

## 8. Arquivos mais importantes

- [src/main.jsx](../src/main.jsx)
- [src/api.js](../src/api.js)
- [src/styles.css](../src/styles.css)
- [server/index.ts](../server/index.ts)
- [prisma/schema.prisma](../prisma/schema.prisma)

## 9. Estado atual do projeto

O sistema esta pronto para:

- uso pessoal local
- testes em rede local
- publicacao em servidor Linux simples

Antes de producao mais robusta, as proximas evolucoes recomendadas sao:

- migrar de SQLite para PostgreSQL
- mover anexos para armazenamento em arquivo ou objeto
- adicionar reset de senha
- adicionar rate limit
- fortalecer o modo compartilhado com permissoes reais

## 10. Resumo final

O Finora hoje entrega uma base full stack completa para controle financeiro pessoal, com visual moderno, autenticacao, relatorios, importacao e suporte mobile via navegador. A arquitetura atual e enxuta, facil de hospedar e adequada para evolucao gradual para um ambiente mais robusto.
