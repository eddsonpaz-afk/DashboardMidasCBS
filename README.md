# CBS Analytics V5

Versão reconstruída com 2 abas:
- Meta Ads
- Sala de Guerra

## Logos oficiais
Coloque os arquivos:
- assets/waves-logo.png
- assets/cbs-logo.png

Se não colocar, o dashboard usa fallback visual.

## Planilhas
As duas abas aceitam upload:
- Meta Ads: exportação do Meta ou planilha consolidada do Midas
- Sala de Guerra: modelo Excel da operação ExpoConstruir

### Importação do Midas
O importador reconhece automaticamente as abas:
- `Resumo Mensal`
- `Campanhas`
- `Idade`
- `Gênero`
- `Creative Reporting`

Na aba `Resumo Mensal`, use uma linha por mês. Os campos principais são `Mês`, `Investimento` e `Vendas`.
O dashboard calcula os indicadores financeiros sem depender de fórmulas prontas na planilha:
- `ROAS = Vendas ÷ Investimento`
- `ROI = (Vendas − Investimento) ÷ Investimento`

Se a planilha trouxer apenas um novo mês, os meses anteriores continuam preservados.

Suba todos os arquivos para o GitHub. A Vercel publica automaticamente.
