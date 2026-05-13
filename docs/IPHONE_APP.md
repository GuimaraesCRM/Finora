# App iPhone Nativo do Finora

## 1. Visao geral

O Finora agora tem uma base de app iPhone de verdade em:

- [mobile/App.tsx](../mobile/App.tsx)
- [mobile/src](../mobile/src)

Esse app:

- usa frontend mobile proprio
- conversa com a mesma API do Finora web
- compartilha os mesmos usuarios, contas e lancamentos
- nao depende de abrir o site dentro do app

Em outras palavras: web e iPhone continuam sincronizados, mas cada um com sua experiencia de interface.

## 2. Stack usada

O app foi estruturado com:

- `Expo`
- `React Native`
- `TypeScript`
- `React Navigation`
- `Expo Secure Store`

Hoje a API base configurada esta em:

```text
http://191.252.208.228:3333/api
```

Esse valor esta em:

- [mobile/app.json](../mobile/app.json)
- [mobile/src/lib/config.ts](../mobile/src/lib/config.ts)

## 3. O que o app ja faz

### Autenticacao

- login
- criacao de conta
- setup inicial
- sessao persistida no aparelho

### Dashboard nativo

- saude financeira
- saldo total
- previsto do mes
- entradas e saidas
- contas
- alertas
- categorias
- cartoes
- lancamentos recentes

### Lancamentos

- listar por mes
- buscar
- filtrar por tipo
- criar
- editar
- excluir

### Contas

- listar contas
- ver patrimonio consolidado
- criar
- editar
- excluir

### Area Mais

- trocar moeda
- ver orcamentos
- ver metas
- ver recorrencias
- executar recorrencia manualmente
- ver relatorios e comparativos
- sair da conta

## 4. Estrutura principal

### App shell

- [mobile/App.tsx](../mobile/App.tsx)

Responsavel por:

- tema
- sessao
- tabs principais
- gate de autenticacao

### Sessao e API

- [mobile/src/lib/session.tsx](../mobile/src/lib/session.tsx)
- [mobile/src/lib/api.ts](../mobile/src/lib/api.ts)
- [mobile/src/lib/storage.ts](../mobile/src/lib/storage.ts)

### Telas

- [mobile/src/screens/AuthScreen.tsx](../mobile/src/screens/AuthScreen.tsx)
- [mobile/src/screens/DashboardScreen.tsx](../mobile/src/screens/DashboardScreen.tsx)
- [mobile/src/screens/TransactionsScreen.tsx](../mobile/src/screens/TransactionsScreen.tsx)
- [mobile/src/screens/AccountsScreen.tsx](../mobile/src/screens/AccountsScreen.tsx)
- [mobile/src/screens/MoreScreen.tsx](../mobile/src/screens/MoreScreen.tsx)

### Componentes nativos

- [mobile/src/components/ui.tsx](../mobile/src/components/ui.tsx)
- [mobile/src/components/TransactionEditor.tsx](../mobile/src/components/TransactionEditor.tsx)
- [mobile/src/components/AccountEditor.tsx](../mobile/src/components/AccountEditor.tsx)

## 5. Comandos uteis

Entre na pasta:

```bash
cd mobile
```

Instalar dependencias:

```bash
npm install
```

Rodar o Expo:

```bash
npm run start
```

Rodar checagem de tipos:

```bash
npm run typecheck
```

Gerar projeto iOS nativo no Mac:

```bash
npm run ios:prebuild
```

Abrir no simulador / Xcode:

```bash
npm run ios:run
```

## 6. Como abrir no Xcode

No Mac:

1. clone o repositorio
2. entre em `mobile`
3. rode `npm install`
4. rode `npm run ios:prebuild`
5. abra o projeto iOS gerado na pasta:

```text
mobile/ios
```

Normalmente o arquivo relevante sera um `.xcworkspace` ou `.xcodeproj`, gerado pelo Expo no prebuild.

Depois:

1. escolha seu time de assinatura Apple no Xcode
2. selecione um simulador de iPhone ou aparelho fisico
3. clique em `Run`

## 7. Observacao importante sobre HTTP

Hoje o app esta apontando para um IP em `HTTP`, nao `HTTPS`.

Por isso a configuracao iOS foi deixada permissiva para testes internos.

Para publicacao mais seria, o ideal e:

1. usar dominio
2. ativar `HTTPS`
3. trocar a API base para o dominio final
4. reduzir ou remover a excecao ampla de transporte no iOS

## 8. Diferenca em relacao ao caminho antigo

Antes existia uma base com `Capacitor` empacotando o frontend web.

Essa nova estrutura em `mobile/` e a base correta para o app iPhone nativo, porque:

- a navegacao e mobile-first
- os componentes sao React Native
- o layout foi pensado para toque, safe area e tabs de iPhone
- o frontend nao depende de renderizar o site dentro do app

## 9. Proximos passos recomendados

Antes de publicar na App Store, eu recomendo:

1. colocar a API em `HTTPS`
2. definir icone e splash finais
3. adicionar biometria
4. adicionar push notifications
5. adicionar modo offline parcial
6. criar uma pipeline de build iOS
