# App iPhone do Finora

## 1. Como o app funciona

O app iPhone do Finora usa o mesmo backend e o mesmo banco do sistema web. Isso significa:

- tudo que for lancado no web aparece no app
- tudo que for lancado no app aparece no web
- o login e o mesmo
- os dados continuam centralizados no servidor

Hoje o app mobile foi preparado para consumir:

```text
http://191.252.208.228:3333/api
```

## 2. Tecnologia usada

O app foi preparado com:

- `Capacitor`
- `React`
- `Vite`

O frontend e empacotado dentro do app, e as requisicoes seguem para a API do seu servidor.

## 3. O que ja foi feito

- configuracao do `Capacitor`
- projeto iOS criado na pasta `ios/`
- build mobile com API apontando para o seu servidor
- sincronizacao dos assets dentro do projeto iOS
- ajustes de layout para uso no iPhone
- navegacao rapida inferior no mobile
- suporte a safe area

## 4. Arquivos principais

- [capacitor.config.ts](../capacitor.config.ts)
- [src/api.js](../src/api.js)
- [src/main.jsx](../src/main.jsx)
- [src/styles.css](../src/styles.css)
- [ios/App/App/Info.plist](../ios/App/App/Info.plist)

## 5. Comandos do projeto

### Build normal

```bash
npm run build
```

### Build para iPhone

```bash
npm run build:ios
```

### Sincronizar com o projeto iOS

```bash
npm run ios:sync
```

## 6. Como abrir no Mac

No Mac com Xcode instalado:

1. clone o repositorio
2. instale dependencias com `npm install`
3. rode `npm run ios:sync`
4. abra:

```text
ios/App/App.xcodeproj
```

5. selecione um simulador ou iPhone fisico
6. clique em Run no Xcode

## 7. Observacao importante sobre HTTP

Seu servidor atual esta em IP e HTTP, nao HTTPS.

Por isso eu deixei o `Info.plist` do iOS permitindo trafego sem HTTPS para teste. Isso funciona para desenvolvimento e testes internos, mas para publicacao mais seria o ideal e:

- usar dominio
- ativar HTTPS
- remover a excecao ampla de transporte no iOS

## 8. Layout mobile

Para o iPhone, o app recebeu:

- encaixe melhor com safe area
- espaco inferior para navegacao fixa
- dock inferior com acesso rapido
- menu lateral para areas secundarias

## 9. Limites atuais

- o app ainda depende do servidor estar online
- o app ainda nao tem biometria nativa
- o app ainda nao tem push notification
- o icone final do iOS pode ser refinado depois no Xcode

## 10. Proximos passos recomendados

- colocar a API em HTTPS com dominio
- adicionar icones e splash nativos
- opcionalmente adicionar biometria
- opcionalmente adicionar notificacoes push
