# Deploy Linux

## 1. Objetivo

Este guia prepara o Finora para rodar em um servidor Linux com Node.js, PM2 e Nginx.

## 2. Requisitos

- Ubuntu 22.04+ ou distribuicao equivalente
- Node.js 20+ instalado
- NPM disponivel
- Nginx instalado
- PM2 instalado globalmente

## 3. Variaveis de ambiente

Crie um arquivo `.env` na raiz do projeto:

```env
DATABASE_URL="file:./data/finora.db"
JWT_SECRET="coloque-um-segredo-forte-aqui"
APP_PORT="3333"
```

Para uso inicial, o SQLite pode continuar sendo usado. Para mais usuarios e mais concorrencia, considere PostgreSQL no futuro.

## 4. Passo a passo no servidor

### 4.1 Clonar ou subir o projeto

```bash
git clone <URL_DO_REPOSITORIO> finora
cd finora
```

### 4.2 Instalar dependencias

```bash
npm install
```

### 4.3 Criar arquivo de ambiente

```bash
cp .env.example .env
```

Edite o `.env` com os valores reais.

### 4.4 Gerar build

```bash
npm run build
```

### 4.5 Subir com PM2

```bash
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup
```

## 5. Nginx como proxy reverso

Use o arquivo de exemplo:

- [nginx.finora.conf.example](../deploy/nginx.finora.conf.example)

Copie para algo como:

```bash
sudo cp deploy/nginx.finora.conf.example /etc/nginx/sites-available/finora
sudo ln -s /etc/nginx/sites-available/finora /etc/nginx/sites-enabled/finora
sudo nginx -t
sudo systemctl reload nginx
```

## 6. HTTPS

Depois de apontar o dominio para o servidor, gere SSL:

```bash
sudo certbot --nginx -d seudominio.com -d www.seudominio.com
```

## 7. Atualizacao de deploy

Quando subir uma nova versao:

```bash
git pull
npm install
npm run build
pm2 restart finora
```

## 8. Persistencia do banco

O SQLite fica em:

```text
prisma/data/finora.db
```

Garanta backup desse arquivo se usar SQLite em producao.

## 9. Recomendacoes de producao

- usar `JWT_SECRET` forte
- ativar HTTPS
- fazer backup do banco
- considerar PostgreSQL em crescimento real
- mover anexos para storage dedicado em fase futura

## 10. Observacao sobre importacao de PDF

O parser de PDF roda no navegador do usuario. PDFs com texto funcionam melhor. PDFs escaneados ainda precisam de OCR para atingir uma taxa de leitura alta.
