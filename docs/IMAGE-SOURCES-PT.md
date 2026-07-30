# Fontes das imagens da v2.6

## Âmbito

Foram preparadas 48 imagens novas: 20 embalagens de filmes em falta e 28 equipamentos. A lista auditável completa, com uma entrada por ficheiro, página de origem, classificação da licença/referência e nível de confiança, está em:

`docs/image-sources.json`

Os ficheiros foram normalizados para JPEG, sem metadados EXIF, sem cortar o produto e com limites de dimensão e peso adequados a telemóvel. O relatório de dimensões e SHA-256 está em:

`docs/image-normalization-report.json`

## Política de publicação

Por decisão do proprietário do projeto, as imagens estão incluídas no pacote privado, no site da Netlify e na edição GitHub. O GitHub inclui este relatório e o manifesto integral de fontes. As imagens oriundas de fabricantes, lojas, análises e arquivos são referências visuais; não ficam abrangidas pela licença MIT do código e continuam sujeitas aos direitos e termos das respetivas origens. Imagens com licença Creative Commons mantêm no manifesto a licença declarada pela página de origem.

## Casos que exigem atenção

- `Funghi Liquen 250D`: não foi encontrada uma embalagem pública inequívoca. A imagem usada é assumidamente uma representação da emulsão Kodak Vision3 250D subjacente, e não da embalagem Funghi. Está marcada como `proxy-underlying-kodak-vision3-250d`.
- `Kodak Ektar G 100 120`: a fonte encontrada é a embalagem Kodak Ektar 100 em 120; está marcada como variante de nome provável.
- `Kodak Gold 800`: a referência visual é o produto Kodak FunSaver com emulsão Gold 800; está marcada como imagem exata da emulsão no contexto de uma câmara descartável.
- `Pentax 50mm f1.4`: a imagem é da família SMC Pentax-M 50 mm e está marcada como `model-family`.
- `Hama Temporizador Mecânico`: a identificação é muito provável, mas a designação exata do exemplar é difícil de confirmar apenas pela fotografia.

## Controlo de qualidade

- 39 imagens foram classificadas como correspondência exata;
- as restantes têm no manifesto uma justificação explícita (`exact-emulsion`, `model-family`, `likely-exact`, `probable-name-variant` ou `proxy`);
- os 28 equipamentos da base têm correspondência automática;
- 81 das 83 referências de filme têm fotografia;
- as únicas duas referências sem fotografia são registos propositadamente não identificados: `Por identificar` e `Sem Marca`.
