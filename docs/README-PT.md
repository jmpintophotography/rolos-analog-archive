# Rolos

O Rolos é uma aplicação para catalogar fotografia analógica: acompanha cada rolo desde o carregamento até ao arquivo, gere o stock, organiza equipamento e apresenta estatísticas e um mapa dos locais fotografados.

[Guia de instalação passo a passo](INSTALLATION-PT.md) · [Guia de utilização](USAGE-PT.md) · [Privacidade dos locais](GEOCODING-PRIVACY.md)

## Porque foi criado

Este projeto nasceu porque as soluções existentes não correspondiam à forma como o autor trabalha com fotografia analógica. Era preciso juntar, num só lugar, o estado de cada rolo, os códigos dos negativos, os nomes das pastas, o stock e uma leitura visual do arquivo.

O projeto foi pensado e desenvolvido com a ajuda do OpenAI Codex.

## O que inclui

- Fluxo de estados desde `Em Uso` até `Arquivado`.
- Stock de filmes, validades e imagens de embalagens.
- Catálogo de câmaras, lentes e acessórios.
- Pesquisa, filtros, estatísticas e mapa.
- Posicionamento automático de novos locais ao guardar um rolo.
- Interface em português e inglês.
- Importação e exportação em JSON, Excel e CSV.
- Datas de calendário protegidas contra mudanças de fuso horário; na importação, o mês e o ano do ID do rolo são definitivos.
- Novo início protegido para substituir uma base Firebase antiga depois de importar um backup.
- Dados locais e sincronização privada opcional com Firebase.
- Gestão do historial Firebase na própria aplicação, com eliminação protegida e estimativa de espaço.
- Histórico semanal e cópia opcional para o Google Drive.
- Cada cópia manual no Google Drive cria um ficheiro independente, mesmo na mesma semana.
- Escolhas rápidas do novo rolo organizadas numa grelha tátil, sem arrastar lateralmente.
- Instalação como app no Android e no Windows.

## Base de demonstração

Esta edição pública inclui 10 rolos totalmente fictícios. Não contém dados pessoais, caminhos de discos, credenciais, fotografias privadas ou a base usada pelo autor.

Ao ativar o modo privado, estes 10 exemplos são ignorados automaticamente e a aplicação começa com um arquivo vazio.

## Imagens das embalagens

As digitalizações usadas no arquivo pessoal não são distribuídas neste repositório, porque os direitos de redistribuição podem variar. Cada utilizador pode carregar as suas próprias imagens na aba `Embalagens`.

## Licença

O código é disponibilizado sob a [licença MIT](../LICENSE).
