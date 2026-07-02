# Dashboard Meta Ads, Waves Plus + CBS

Dashboard front-end estático para acompanhar campanhas do Meta Ads mês a mês, usando a planilha exportada do Meta como fonte de dados.

## O que vem pronto

- KPIs gerais
- Desempenho do mês selecionado
- Comparativo mês a mês
- Funil de resultados
- Campanhas do mês
- Ranking de campanhas com IEC
- Análise por idade
- Análise por gênero
- Insights rápidos
- Base em JSON em `data/meta-dashboard-data.json`

## Como rodar localmente

Use qualquer servidor estático. Exemplos:

```bash
python -m http.server 5500
```

Depois abra:

```text
http://localhost:5500
```

## Como publicar no GitHub Pages

1. Crie um novo repositório no GitHub.
2. Envie todos os arquivos desta pasta para o repositório.
3. Vá em **Settings > Pages**.
4. Em **Build and deployment**, selecione **Deploy from a branch**.
5. Escolha a branch `main` e a pasta `/root`.
6. Clique em **Save**.
7. O GitHub vai gerar um link público do dashboard.

## Como atualizar com uma nova planilha

Opção simples:

1. Substitua o arquivo do Meta na pasta do projeto.
2. Rode o parser Python `scripts_parse.py`, ajustando o caminho da planilha se necessário.
3. Ele irá gerar novamente `data/meta-dashboard-data.json`.
4. Faça commit e push no GitHub.

Opção rápida dentro do navegador:

- O botão **Atualizar planilha** lê a planilha no navegador, mas para consolidar 100% igual ao modelo, o ideal é gerar novamente o JSON.

## Logos

Neste MVP, as logos são recriadas em CSS como blocos de marca. Para usar as logos oficiais:

1. Coloque os arquivos em `assets/waves-logo.png` e `assets/cbs-logo.png`.
2. Substitua os blocos `.logo-card` no `index.html` por tags `<img>`.

## Observação sobre ROI

A planilha do Meta não trouxe faturamento por campanha. Por isso, o dashboard usa **ROI operacional**, calculado como:

```text
conversas iniciadas / valor investido
```

Para calcular ROI financeiro real, inclua uma coluna de vendas/faturamento por campanha ou integre com CRM/WhatsApp.
