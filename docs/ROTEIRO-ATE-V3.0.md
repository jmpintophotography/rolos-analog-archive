# Roteiro do Rolos até à v3.0

A v3.0 deve ser uma versão final estável, não apenas uma versão com mais funcionalidades. Cada fase só avança depois de cumprir os respetivos critérios.

## Fase 1 — v2.8: estabilidade, simplicidade e manual

- Auditoria a IDs, datas, valores, referências, importações e sincronização.
- Deteção de edições concorrentes.
- Registo de rolo simplificado sem remover campos.
- Inserção intuitiva de rolos históricos.
- Manual completo para iniciantes.
- Testes automáticos, visuais, móveis, desktop e offline.

Critério de saída: todos os testes passam e a base real mantém os totais e hashes esperados.

## Fase 2 — utilização real da v2.8

- Utilizar diariamente durante quatro a oito semanas.
- Registar dúvidas, cliques desnecessários e campos pouco claros.
- Confirmar, com casos reais, os cálculos do Centro de Custos.
- Testar compras que terminam, sessões editadas, laboratórios externos e vários rolos.
- Evitar acrescentar funcionalidades durante a recolha de problemas.

Critério de saída: não existem perdas de dados, conflitos silenciosos nem contas inexplicáveis.

## Fase 3 — v2.9: polimento

- Corrigir apenas problemas observados no uso real.
- Melhorar acessibilidade, textos, tamanhos e velocidade.
- Reduzir passos repetidos.
- Afinar relatórios financeiros com base nos dados realmente úteis.
- Completar o manual com as dúvidas que surgiram.

Critério de saída: os fluxos diários são rápidos no telemóvel e no computador.

## Fase 4 — v2.9.5: candidata final

- Congelar novas funcionalidades.
- Ensaiar atualização, restauro e troca de dispositivo.
- Testar Firebase, Drive, JSON, Excel e funcionamento offline.
- Verificar a versão pública do GitHub sem dados privados.
- Manter a candidata em utilização real durante pelo menos duas semanas.

Critério de saída: zero erros críticos e restauro confirmado a partir de mais do que um tipo de backup.

## Fase 5 — v3.0: versão final de utilização

- Publicação da versão consolidada.
- Manual e guia de atualização definitivos.
- Pacote Netlify, pacote privado e edição GitHub validados.
- Base de dados migrada apenas se os testes demonstrarem essa necessidade.
- Política de manutenção: correções 3.0.x; funcionalidades novas ficam para uma futura 3.1.

A principal diferença da v3.0 será a garantia de maturidade: fluxos estabilizados pelo uso real, formato de dados congelado, migração ensaiada, documentação completa e ausência de alterações experimentais.
