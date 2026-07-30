# Manual completo do Rolos v2.8.1

Este manual foi escrito para alguém que nunca utilizou a aplicação. O Rolos é um arquivo pessoal para acompanhar filmes fotográficos, stock, equipamento, custos, processamento, arquivo físico e cópias de segurança.

## 1. Antes de começar

O arquivo principal vive no dispositivo e pode ser sincronizado com o Firebase. As cópias JSON e Excel permitem recuperar ou transportar os dados. As fotografias incluídas dos filmes e equipamentos são ficheiros públicos; os teus rolos, custos e restantes dados pessoais nunca devem ser colocados no GitHub.

Regras de segurança:

1. Antes de uma atualização ou importação, exporta sempre um backup JSON.
2. Não abras duas versões diferentes da aplicação em simultâneo.
3. Depois de publicar uma atualização, confirma o número da versão antes de sincronizar.
4. Nunca publiques a pasta `DADOS-PRIVADOS` nem o pacote `COMPLETO-PRIVADO`.
5. Quando houver um aviso de integridade, não forces a sincronização. Os dados locais continuam preservados.

## 2. Navegação

A aplicação tem oito áreas:

- **Entrada:** resumo do trabalho em curso e atalhos.
- **Rolos:** arquivo completo, filtros, pesquisa e arquivo físico.
- **Stock:** filmes ainda disponíveis.
- **Estatísticas:** padrões, custos, tempos e localizações.
- **Equipamento:** câmaras, lentes, flashes e acessórios.
- **Custos:** compras, químicos, consumíveis e sessões.
- **Backup:** exportação, importação, Firebase, Drive e integridade.
- **Manual:** guia completo de utilização, também disponível sem internet.

No computador, estas áreas aparecem no lado esquerdo. No telemóvel, aparecem na barra inferior.

## 3. Registar um novo rolo

1. Carrega em **Novo rolo**.
2. Escolhe o **Mês de entrada**.
3. Preenche câmara, marca, modelo, ISO e formato.
4. Se precisares, abre **Detalhes opcionais**, **Processamento e custos** ou **Arquivo físico e notas**.
5. Carrega em **Guardar**.

O ID é criado automaticamente no formato `IIMMAAAA`. Por exemplo, `01072026` é o primeiro rolo de julho de 2026. A data guardada será sempre o primeiro dia desse mês, neste caso `2026-07-01`.

### Inserir um rolo antigo

É possível inserir registos antigos:

1. Abre **Novo rolo**.
2. Em **Mês de entrada**, escolhe o mês e ano antigos.
3. A aplicação procura os IDs que já existem nesse mês e mostra o próximo ID livre.
4. Preenche apenas a informação que conheces e guarda.

Não precisas de inventar um dia. O arquivo trabalha por mês.

### Usar preenchimento rápido

Abre **Usar preenchimento rápido** para escolher:

- um modelo pessoal;
- uma câmara utilizada recentemente;
- um filme existente no stock;
- um local recente.

Quando escolhes um filme do stock, podes manter ativa a opção **Retirar uma unidade deste stock ao guardar**.

### Guardar e adicionar outro

Usa **Guardar e adicionar outro** quando tens vários rolos semelhantes. O próximo formulário mantém os dados de captura, mas cria um ID novo.

### Criar um rolo semelhante

Abre um rolo existente e escolhe **Novo semelhante**. Câmara, lente e filme são reutilizados, mas o novo registo recebe outro ID.

## 4. Editar um rolo

1. Abre o rolo.
2. Escolhe **Editar**.
3. Altera os campos necessários.
4. Guarda.

O mês é determinado pelo ID. Se alterares o ID, a aplicação valida o formato, impede duplicados e atualiza as referências existentes no Centro de Custos.

Se o mesmo registo tiver sido alterado noutro dispositivo enquanto o formulário estava aberto, a aplicação bloqueia a gravação. Fecha o formulário, volta a abrir o registo atualizado e repete a alteração.

Um rolo associado a uma sessão de custos não pode ser eliminado sem primeiro ser retirado dessa sessão.

## 5. Estados do rolo

O fluxo normal é:

`Em Uso → Disparado → Em Revelação → Revelado → Digitalizado → Editado → Recolhido → Arquivado`

Usa **Avançar** para passar ao estado seguinte. As datas principais são preenchidas quando o rolo avança. Também podes editar o estado manualmente.

## 6. Fotografias e arquivo físico

No detalhe do rolo podes guardar:

- link do álbum Google Photos;
- localização física;
- confirmação do negativo;
- confirmação da folha de contacto;
- confirmação das digitalizações;
- notas e projeto/viagem.

Na página **Rolos**, abre **Arquivo físico e etiquetas** para:

- pesquisar um rolo;
- selecionar os que precisam de atenção;
- atribuir uma localização a vários rolos;
- confirmar elementos físicos;
- marcar vários como arquivados;
- imprimir etiquetas com QR.

## 7. Stock

### Adicionar stock

1. Abre **Stock**.
2. Carrega em **Novo stock**.
3. Indica marca, modelo, formato, ISO, tipo e quantidade.
4. Opcionalmente, adiciona data de compra, custo unitário e validade.
5. Guarda.

A quantidade tem de ser um número inteiro igual ou superior a zero. Custos negativos não são aceites.

### Usar stock

Podes carregar um rolo diretamente a partir de um cartão de stock. O filme fica preenchido e uma unidade é retirada ao guardar.

### Vistas

- **Catálogo:** mais visual.
- **Lista:** mais compacta.
- **Embalagens:** mostra todas as caixas de filme e permite adicionar uma imagem pessoal.

## 8. Equipamento

### Adicionar equipamento

1. Abre **Equipamento**.
2. Carrega em **Novo item**.
3. Escolhe o tipo e indica o modelo.
4. Adiciona marca, sistema, valor, data, estado e notas.
5. Guarda.

### Vendido ou abatido

Equipamento com estado **Vendido** ou **Abatido** fica oculto por defeito. Usa **Mostrar vendidos** para o consultar. O registo e o respetivo histórico não são eliminados.

## 9. Centro de Custos

O Centro de Custos separa compras de utilizações:

- **Compra:** algo que adquiriste, como Rodinal, fixador, água ou luvas.
- **Sessão:** momento em que utilizaste produtos ou pagaste um serviço.

### Registar uma compra por quantidade

Exemplo: Rodinal 500 ml por 15 €.

1. Abre **Custos → Nova compra**.
2. Dá um nome à compra.
3. Escolhe **Por quantidade usada**.
4. Indica custo `15`, capacidade `500` e unidade `ml`.
5. Guarda.

A aplicação calcula o custo por ml, o valor consumido e o saldo.

### Registar uma compra por número de rolos

Exemplo: um fixador de 10 € para aproximadamente 20 rolos.

1. Escolhe **Pelo número de rolos**.
2. Indica custo `10` e capacidade `20`.
3. Em cada sessão, indica quantos rolos dessa capacidade foram utilizados.

### Criar uma sessão em casa

1. Carrega em **Nova sessão**.
2. Escolhe **Revelação em casa**.
3. Seleciona os rolos.
4. Indica quanto utilizaste de cada produto.
5. Guarda como **Concluída**.

O custo é dividido automaticamente pelos rolos selecionados.

### Registar um laboratório externo

1. Cria uma sessão.
2. Escolhe **Laboratório externo**.
3. Seleciona os rolos.
4. Indica o fornecedor e o valor em **Serviço ou custo extra**.
5. Guarda como concluída.

### Rascunhos

Uma sessão em **Rascunho** não altera saldos nem estatísticas. Só passa a contar depois de concluída.

### Capacidade e conflitos

A aplicação não permite utilizar mais quantidade do que a disponível. Se o valor real da embalagem estava incorreto, edita primeiro a capacidade da compra. Uma capacidade já utilizada não pode ser reduzida para menos do que o consumo registado.

Uma compra utilizada numa sessão não pode ser eliminada. Marca-a como **Terminada**.

### Evitar custos duplicados

Os rolos mantêm os campos antigos de custo de filme, revelação e digitalização. Não registes o mesmo valor nesses campos e numa sessão. O detalhe do rolo mostra separadamente:

- custos diretamente no rolo;
- custos do Centro de Custos;
- total real.

## 10. Estatísticas

Em **Estatísticas** podes filtrar por câmara, filme, formato, tipo, estado, ano e localização. A página inclui:

- rolos por estado, câmara, filme, mês, ISO e local;
- valor e autonomia do stock;
- custos por ano;
- tempos médios de processamento;
- custos por categoria e mês;
- média de revelação em casa e laboratório;
- mapa de localizações.

Os filtros alteram apenas a visualização, nunca os dados.

## 11. Pesquisa, favoritos, modelos e revisão

- O botão de pesquisa encontra rolos, stock e equipamento.
- A estrela marca um rolo como favorito.
- **Guardar modelo** cria uma combinação reutilizável de câmara e filme.
- **Revisão** apresenta sugestões sem alterar os dados.
- **Desfazer** recupera a última alteração local disponível.

## 12. Backups

### Exportar JSON

É a cópia mais completa e recomendada:

1. Abre **Backup**.
2. Escolhe **Exportar JSON**.
3. Guarda o ficheiro fora da pasta do site.

### Exportar Excel

Cria folhas para rolos, stock, equipamento, compras, sessões e consumos. Pode voltar a ser importado pela aplicação.

### Verificar um backup

Usa **Testar um backup** para confirmar o conteúdo sem substituir o arquivo atual.

### Importar JSON ou Excel

1. Exporta primeiro um JSON atual.
2. Fecha a aplicação nos outros dispositivos.
3. Importa o ficheiro.
4. Lê a pré-visualização.
5. Confirma os totais e a integridade.
6. Se pretendes substituir o arquivo online, segue a opção apresentada pela aplicação.

Importações com IDs duplicados, datas incoerentes, valores negativos ou referências partidas são canceladas.

### Firebase

O Firebase mantém a versão atual, cópias semanais e cópias de recuperação. A sincronização utiliza transações: se outro dispositivo tiver publicado uma versão mais recente, essa versão é preservada e a alteração concorrente fica guardada no histórico de recuperação.

### Google Drive

Cada clique em **Criar backup** cria um ficheiro independente. Vários backups na mesma semana não se substituem.

## 13. Confiança nos dados

Em **Backup → Confiança nos dados**, carrega em **Verificar agora**. A aplicação verifica:

- IDs duplicados em rolos, stock, equipamento, custos e modelos;
- IDs e datas dos rolos;
- quantidades e valores negativos;
- datas inválidas;
- produtos ou rolos em falta nas sessões de custos;
- campos obrigatórios.

Se existir um problema crítico, a sincronização é pausada para impedir que o erro passe para outros dispositivos.

## 14. Atualizar a aplicação

Para uma atualização normal:

1. Exporta JSON.
2. Fecha a aplicação nos outros dispositivos.
3. Publica o novo ZIP da Netlify.
4. Fecha e reabre a aplicação.
5. Confirma a versão.
6. Confirma os totais.
7. Sincroniza.
8. Atualiza os outros dispositivos antes de os utilizar.

Na passagem de v2.8 para v2.8.1 não é necessário alterar a base de dados nem as regras Firestore.

## 15. Resolução de problemas

### Vejo uma versão antiga

Fecha completamente a aplicação e volta a abrir. Numa PWA pode ser necessário repetir uma segunda vez para ativar a cache nova.

### A sincronização está pausada

Abre **Backup → Confiança nos dados**. Não reinstales nem apagues os dados do navegador.

### Um registo mudou noutro dispositivo

Fecha o formulário, sincroniza ou aguarda a atualização e volta a abrir o registo.

### O Firebase diz que não tenho permissão

Confirma a conta Google, a versão publicada e as regras Firestore. Os dados locais continuam guardados.

### O mapa não aparece

O arquivo continua funcional. O mapa e a procura de coordenadas precisam de ligação à internet.

### Não consigo eliminar um rolo ou produto

Existem referências financeiras. Remove primeiro a associação na sessão correspondente.

## 16. Rotina recomendada

- Depois de cada sessão fotográfica: criar ou atualizar o rolo.
- Depois da revelação: avançar estado e criar a sessão de custos.
- Quando compras filme ou químicos: atualizar stock ou compras.
- Uma vez por semana: criar backup no Drive.
- Antes de atualizações: exportar JSON.
- Periodicamente: executar **Verificar agora**.
