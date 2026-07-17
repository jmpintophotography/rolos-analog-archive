# Guia de utilização

## Entrada

A página inicial mostra o que ainda precisa de ação, o stock disponível e o progresso do arquivo. `Novo rolo` abre o formulário principal e `Ver todos em andamento` mostra tudo o que ainda não está arquivado.

## Criar e acompanhar um rolo

1. Carrega em `Novo rolo`.
2. Preenche o código, data, filme, câmara, formato e local.
3. Guarda.
4. Usa `Detalhes` para consultar o registo sem o alterar.
5. Usa a seta ou `Avançar estado` para passar ao passo seguinte.

O último estado é `Arquivado`. Um rolo arquivado continua disponível para pesquisa e estatísticas, mas deixa a fila de trabalho.

## Locais e mapa

Ao guardar um local novo, por exemplo `Paris`, a aplicação tenta obter as coordenadas e guarda o resultado. Na próxima abertura, não repete a pesquisa.

Para indicar vários locais no mesmo rolo, separa-os com vírgula, ponto e vírgula, barra ou ` + `. É preferível escrever nomes claros como `Paris`. Como a vírgula significa "outro local", não a uses entre a cidade e o país; num nome ambíguo escreve, por exemplo, `Paris França`, e confirma depois o ponto no mapa.

Se não houver internet ou o serviço não encontrar o nome, o rolo é guardado na mesma e aparece como `Por posicionar`. Podes editar e voltar a guardar mais tarde.

## Stock

O Stock agrupa referências por formato e mostra quantidade, ISO, tipo e validade. `Editar stock` permite atualizar uma referência. A aba `Embalagens` associa uma imagem ao filme; usa imagens próprias ou com autorização.

## Equipamento

Regista câmaras, lentes, flashes e acessórios. O valor total é apenas informativo e pode ser filtrado por tipo e estado.

## Estatísticas

Os filtros de câmara, filme, formato, tipo, estado, local e período afetam os gráficos em conjunto. Passa o cursor sobre os gráficos no computador ou toca nos elementos no telemóvel para ver valores.

## Português e inglês

O botão `EN` ou `PT` no topo muda a interface. A escolha fica guardada no dispositivo. Os teus próprios nomes, notas e locais nunca são traduzidos.

## Sincronização e backups

- Cada alteração é guardada localmente.
- Com Firebase configurado, a revisão mais recente é sincronizada entre dispositivos.
- O histórico semanal Firebase é mantido automaticamente.
- `Exportar JSON` cria uma cópia que podes guardar manualmente.
- O Google Drive mostra um aviso semanal; carrega em `Criar backup` para autorizar o envio.

Antes de uma importação ou alteração grande, exporta sempre um JSON. Importar um JSON ou Excel substitui a base atual depois da confirmação.

## Atualizações

Não é preciso desinstalar a app do Windows ou Android. Depois de uma nova publicação, fecha completamente a app e volta a abrir. A versão aparece no fundo da barra lateral e, no telemóvel, junto ao título.
