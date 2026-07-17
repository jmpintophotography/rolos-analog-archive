# Instalação privada, explicada passo a passo

Este guia foi escrito para quem nunca programou. Não precisas de instalar ferramentas nem de escrever comandos. Reserva cerca de 30 a 45 minutos e faz uma etapa de cada vez.

No final terás:

- um endereço privado na Netlify;
- entrada apenas com a tua conta Google;
- a mesma base no computador e no telemóvel;
- histórico semanal no Firebase;
- uma cópia semanal opcional no Google Drive.

## Antes de começar

Precisas de:

1. Uma conta Google que será a única autorizada.
2. Uma conta gratuita no [GitHub](https://github.com/).
3. Uma conta gratuita na [Netlify](https://app.netlify.com/), de preferência ligada ao GitHub.
4. Uma cópia **privada** deste repositório.

Não coloques a tua configuração pessoal num repositório público. A forma mais simples é criar um repositório privado e carregar lá estes ficheiros.

## Parte 1: criar o projeto no Firebase

1. Abre a [Firebase Console](https://console.firebase.google.com/).
2. Carrega em `Criar um projeto` ou `Add project`.
3. Escolhe um nome, por exemplo `o-meu-arquivo-rolos`.
4. Podes desativar o Google Analytics; a aplicação não precisa dele.
5. Conclui a criação e abre o projeto.

## Parte 2: ativar o login Google

1. No menu do Firebase, abre `Security` > `Authentication`.
2. Carrega em `Começar` ou `Get started`.
3. Abre a aba `Método de início de sessão` ou `Sign-in method`.
4. Escolhe `Google`.
5. Ativa o interruptor.
6. Escolhe o teu email como endereço de suporte.
7. Carrega em `Guardar`.

## Parte 3: criar a base de dados

1. No menu do Firebase, abre `Databases & Storage` > `Firestore`.
2. Carrega em `Adicionar base de dados` ou `Add database`.
3. Escolhe a edição `Standard`.
4. Mantém o identificador `(default)`.
5. Escolhe uma região próxima. Depois de criada, esta escolha não é fácil de alterar.
6. Escolhe `Modo de produção` ou `Production mode`.
7. Cria a base.

O modo de produção começa por bloquear tudo. É exatamente o que queremos; no passo seguinte publicamos regras que só autorizam a tua conta.

## Parte 4: obter a configuração da aplicação

1. No Firebase, carrega na roda dentada junto de `Descrição geral do projeto`.
2. Abre `Definições do projeto` ou `Project settings`.
3. Na área `As suas aplicações`, carrega no símbolo da Web `</>`.
4. Dá um nome, por exemplo `Rolos Web`.
5. Não é necessário ativar Firebase Hosting.
6. Carrega em `Registar aplicação`.
7. Mantém esta página aberta. Vais ver valores como `apiKey`, `authDomain`, `projectId` e `appId`.

## Parte 5: preencher o ficheiro de configuração

1. No teu repositório **privado** do GitHub, abre `app/firebase-config.js`.
2. Carrega no lápis para editar.
3. Substitui o conteúdo pelos valores mostrados pelo Firebase, seguindo este modelo:

```js
window.ROLOS_FIREBASE_CONFIG = {
  apiKey: "VALOR_MOSTRADO_PELO_FIREBASE",
  authDomain: "VALOR_MOSTRADO_PELO_FIREBASE",
  projectId: "VALOR_MOSTRADO_PELO_FIREBASE",
  storageBucket: "VALOR_MOSTRADO_PELO_FIREBASE",
  messagingSenderId: "VALOR_MOSTRADO_PELO_FIREBASE",
  appId: "VALOR_MOSTRADO_PELO_FIREBASE",
  ownerEmail: "O_TEU_EMAIL_GOOGLE",
  privateAccess: true,
  demoMode: false,
};
```

4. Mantém as aspas e as vírgulas.
5. Em `ownerEmail`, escreve exatamente o email Google autorizado.
6. Confirma que `privateAccess` está em `true` e `demoMode` em `false`.
7. Guarda a alteração com `Commit changes`.

Os 10 rolos de demonstração são automaticamente ignorados quando estes dois valores ativam o modo privado.

## Parte 6: publicar as regras de segurança

1. No repositório, abre `firestore.rules.example`.
2. Copia todo o texto.
3. Substitui `YOUR_GOOGLE_EMAIL@example.com` pelo teu email Google exato.
4. Volta à Firebase Console.
5. Abre `Databases & Storage` > `Firestore` > `Rules`.
6. Apaga o conteúdo do editor e cola as regras corrigidas.
7. Carrega em `Publish`.

Não uses uma regra com `allow read, write: if true`. Isso tornaria a base pública.

## Parte 7: publicar através do GitHub e Netlify

1. Abre a [Netlify](https://app.netlify.com/).
2. Carrega em `Add new project`.
3. Escolhe `Import an existing project`.
4. Escolhe `GitHub` e autoriza o acesso ao teu repositório privado.
5. Seleciona o repositório do Rolos.
6. A Netlify deverá ler o ficheiro `netlify.toml` automaticamente.
7. Confirma que `Publish directory` é `app` e que não existe comando de construção obrigatório.
8. Carrega em `Publish`.
9. Espera pelo estado `Published`.
10. Copia o endereço final, por exemplo `nome-escolhido.netlify.app`.

A partir daqui, uma alteração guardada no ramo principal do GitHub é publicada automaticamente pela Netlify.

## Parte 8: autorizar o domínio na Firebase

1. Volta à Firebase Console.
2. Abre `Security` > `Authentication` > `Settings`.
3. Encontra `Authorized domains`.
4. Carrega em `Add domain`.
5. Escreve apenas o domínio da Netlify, sem `https://` e sem barra final.
6. Guarda.

Exemplo correto: `nome-escolhido.netlify.app`

## Parte 9: primeiro acesso

1. Abre o endereço da Netlify.
2. Carrega em `Entrar com Google`.
3. Escolhe exatamente a conta indicada em `ownerEmail`.
4. A aplicação deve abrir com zero rolos.
5. Cria um rolo de teste.
6. Abre `Backup` e confirma que aparece `Sincronizado`.
7. Abre o mesmo endereço noutro dispositivo e confirma que o rolo aparece.

Se outra conta tentar entrar, deverá ver uma mensagem de acesso recusado.

## Parte 10: instalar no Windows

1. Abre o site no Chrome ou Edge.
2. Procura o ícone `Instalar` na barra de endereço ou abre o menu do navegador.
3. Escolhe `Instalar Rolos` ou `Instalar esta aplicação`.
4. Confirma.

Uma atualização do site não obriga a desinstalar a app. Fecha e volta a abrir para receber a versão mais recente.

## Parte 11: instalar no Android

1. Abre o site no Chrome.
2. Abre o menu dos três pontos.
3. Escolhe `Instalar aplicação` ou `Adicionar ao ecrã principal`.
4. Confirma.

O telefone e o computador usam a mesma versão no Firebase. Ao abrir, a aplicação verifica e recebe a revisão mais recente.

## Parte 12: Google Drive opcional

O histórico semanal do Firebase é automático. A cópia no Google Drive precisa de um clique quando aparece o aviso semanal, porque o navegador tem de pedir autorização à tua conta.

1. Abre a [Google Cloud Console](https://console.cloud.google.com/).
2. Seleciona o mesmo projeto criado pelo Firebase.
3. Abre `APIs & Services` > `Library`.
4. Procura `Google Drive API` e carrega em `Enable`.
5. Abre `Google Auth Platform` > `Data Access`.
6. Adiciona apenas este âmbito:

   `https://www.googleapis.com/auth/drive.file`

7. Não escolhas `drive` nem `drive.readonly`.
8. Se a aplicação estiver em modo de teste, abre `Audience` e adiciona o teu email aos utilizadores de teste.
9. Abre o Rolos, entra em `Backup` e carrega em `Criar backup no Drive`.
10. Autoriza o acesso limitado e confirma no Drive a pasta `Rolos - Backups`.

A aplicação só consegue ver e gerir os ficheiros que ela própria criou. Mantém até 54 semanas. Se o site estiver fechado, não consegue iniciar sozinho uma sessão no Drive; mostra o aviso na próxima abertura.

## O que é automático

- Guardar alterações no dispositivo: automático.
- Sincronizar Firebase entre computador e telefone: automático quando existe internet.
- Criar/manter o histórico semanal Firebase: automático.
- Avisar que falta a cópia semanal no Drive: automático.
- Enviar para o Drive: requer carregar no botão e, por vezes, confirmar a conta.

## Se algo correr mal

1. Não apagues a base Firebase.
2. Abre `Backup` e exporta um JSON.
3. Confirma que o domínio Netlify está autorizado.
4. Confirma que o email no ficheiro e nas regras é exatamente o mesmo.
5. Confirma que a Netlify publicou a pasta `app`.
6. Fecha completamente a aplicação e abre de novo.

Documentação oficial útil: [configurar Firebase Web](https://firebase.google.com/docs/web/setup), [login Google](https://firebase.google.com/docs/auth/web/google-signin), [regras Firestore](https://firebase.google.com/docs/firestore/security/get-started), [publicar um repositório na Netlify](https://docs.netlify.com/start/quickstarts/deploy-from-repository/) e [permissões Google Drive](https://developers.google.com/workspace/drive/api/guides/api-specific-auth).
