(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.MidasMetaParser = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const monthNames = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  const monthLookup = {
    janeiro: 1, jan: 1, january: 1,
    fevereiro: 2, fev: 2, february: 2, feb: 2,
    marco: 3, mar: 3, march: 3,
    abril: 4, abr: 4, april: 4, apr: 4,
    maio: 5, mai: 5, may: 5,
    junho: 6, jun: 6, june: 6,
    julho: 7, jul: 7, july: 7,
    agosto: 8, ago: 8, august: 8, aug: 8,
    setembro: 9, set: 9, september: 9, sep: 9,
    outubro: 10, out: 10, october: 10, oct: 10,
    novembro: 11, nov: 11, november: 11,
    dezembro: 12, dez: 12, december: 12, dec: 12
  };

  const aliases = {
    month: ['Mês', 'Mes', 'Chave', 'month', 'MES_ANO', 'Início dos relatórios', 'Inicio dos relatorios', 'reporting_start'],
    investment: ['Investimento', 'Valor usado (BRL)', 'spend', 'VALOR_INVESTIMENTO', 'Valor Investido'],
    impressions: ['Impressões', 'Impressoes', 'impressions'],
    reach: ['Alcance', 'reach'],
    clicks: ['Cliques', 'Cliques no link', 'Cliques (todos)', 'link_clicks', 'clicks'],
    conversations: ['Conversas', 'Conversas iniciadas', 'Resultados', 'results'],
    cpa: ['CPA', 'Custo por resultado', 'cost_per_result'],
    ctr: ['CTR (%)', 'CTR', 'CTR (todos)', 'ctr_all_percent'],
    cpc: ['CPC', 'CPC (custo por clique no link)', 'cpc_all'],
    cpm: ['CPM', 'CPM (custo por 1.000 impressões)', 'cpm'],
    frequency: ['Frequência', 'Frequencia', 'frequency'],
    followers: ['Seguidores', 'Followers'],
    sales: ['Vendas', 'Venda', 'Receita', 'Faturamento', 'Valor vendido', 'Valor de vendas', 'REALIZADO'],
    workedLeads: ['Leads trabalhados', 'Leads Trabalhados', 'Leads', 'LEADS_TRABALHADOS'],
    campaign: ['Campanha', 'Nome da campanha', 'campaign'],
    resultType: ['Tipo de resultado', 'result_type'],
    gender: ['Gênero', 'Genero', 'gender'],
    age: ['Idade', 'Faixa etária', 'Faixa etaria', 'age'],
    participation: ['Participação (%)', 'Participacao (%)', 'Participação', 'Participacao'],
    operationalRoi: ['ROI operacional', 'ROI Operacional', 'roiOperacional']
  };

  function normalize(value) {
    return String(value ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  }

  function hasValue(value) {
    if (value === null || value === undefined) return false;
    const text = String(value).trim();
    return text !== '' && text !== '–' && text !== '-' && normalize(text) !== 'nao informado';
  }

  function toNumber(value) {
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;
    if (!hasValue(value) || value instanceof Date) return null;

    let text = String(value).trim();
    const negative = /^\(.*\)$/.test(text);
    text = text
      .replace(/[R$%\s\u00a0]/g, '')
      .replace(/[()]/g, '')
      .replace(/[^0-9,.-]/g, '');

    if (!text) return null;
    const commas = (text.match(/,/g) || []).length;
    const dots = (text.match(/\./g) || []).length;
    const lastComma = text.lastIndexOf(',');
    const lastDot = text.lastIndexOf('.');

    if (commas && dots) {
      text = lastComma > lastDot
        ? text.replace(/\./g, '').replace(',', '.')
        : text.replace(/,/g, '');
    } else if (commas) {
      const decimals = text.length - lastComma - 1;
      text = commas > 1 || decimals === 3 ? text.replace(/,/g, '') : text.replace(',', '.');
    } else if (dots) {
      const decimals = text.length - lastDot - 1;
      text = dots > 1 || decimals === 3 ? text.replace(/\./g, '') : text;
    }

    const parsed = Number(text);
    return Number.isFinite(parsed) ? (negative ? -parsed : parsed) : null;
  }

  function monthKey(value) {
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
      return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}`;
    }

    if (typeof value === 'number' && value > 20000 && value < 80000) {
      const date = new Date(Date.UTC(1899, 11, 30) + Math.round(value) * 86400000);
      return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
    }

    const raw = String(value ?? '').trim();
    let match = raw.match(/(20\d{2})[-/.](0?[1-9]|1[0-2])/);
    if (match) return `${match[1]}-${String(Number(match[2])).padStart(2, '0')}`;

    match = raw.match(/(?:^|\D)(0?[1-9]|1[0-2])[-/.](20\d{2})(?:\D|$)/);
    if (match) return `${match[2]}-${String(Number(match[1])).padStart(2, '0')}`;

    match = raw.match(/(?:^|\D)\d{1,2}[-/.](0?[1-9]|1[0-2])[-/.](20\d{2})(?:\D|$)/);
    if (match) return `${match[2]}-${String(Number(match[1])).padStart(2, '0')}`;

    const clean = normalize(raw);
    const year = clean.match(/20\d{2}/)?.[0];
    const monthToken = Object.keys(monthLookup).find(token => new RegExp(`(^| )${token}( |$)`).test(clean));
    if (year && monthToken) return `${year}-${String(monthLookup[monthToken]).padStart(2, '0')}`;
    return '';
  }

  function monthLabel(key) {
    const match = String(key).match(/(20\d{2})-(0[1-9]|1[0-2])/);
    return match ? `${monthNames[Number(match[2]) - 1]}/${match[1]}` : String(key || '');
  }

  function rowIndex(row) {
    return Object.fromEntries(Object.entries(row).map(([key, value]) => [normalize(key), value]));
  }

  function pick(index, names) {
    for (const name of names) {
      const key = normalize(name);
      if (Object.prototype.hasOwnProperty.call(index, key) && hasValue(index[key])) return index[key];
    }
    return null;
  }

  function metric(index, name) {
    return toNumber(pick(index, aliases[name]));
  }

  function enrichMonth(month) {
    const investment = toNumber(month.investimento) ?? 0;
    const sales = toNumber(month.vendas);
    const roi = sales !== null && investment > 0 ? ((sales - investment) / investment) * 100 : null;
    const roas = sales !== null && investment > 0 ? sales / investment : null;
    return {
      ...month,
      investimento: investment,
      vendas: sales,
      roi,
      roas
    };
  }

  function parseMonthlyRows(rows) {
    const months = new Map();
    for (const row of rows) {
      const index = rowIndex(row);
      const key = monthKey(pick(index, aliases.month));
      if (!key) continue;

      const investment = metric(index, 'investment');
      const impressions = metric(index, 'impressions');
      const reach = metric(index, 'reach');
      const clicks = metric(index, 'clicks');
      const conversations = metric(index, 'conversations');
      const cpa = metric(index, 'cpa');
      const ctr = metric(index, 'ctr');
      const cpc = metric(index, 'cpc');
      const cpm = metric(index, 'cpm');
      const frequency = metric(index, 'frequency');
      const followers = metric(index, 'followers');
      const sales = metric(index, 'sales');
      const workedLeads = metric(index, 'workedLeads');
      const operationalRoi = metric(index, 'operationalRoi');

      if ([investment, impressions, reach, clicks, conversations, followers, sales, workedLeads].every(v => v === null)) continue;
      months.set(key, enrichMonth({
        mes: monthLabel(key), chave: key,
        investimento: investment ?? 0,
        impressoes: impressions ?? 0,
        alcance: reach ?? 0,
        cliques: clicks ?? 0,
        conversas: conversations ?? 0,
        cpa: cpa ?? ((conversations ?? 0) > 0 ? (investment ?? 0) / conversations : 0),
        ctr: ctr ?? ((impressions ?? 0) > 0 ? ((clicks ?? 0) / impressions) * 100 : 0),
        cpc: cpc ?? ((clicks ?? 0) > 0 ? (investment ?? 0) / clicks : 0),
        cpm: cpm ?? ((impressions ?? 0) > 0 ? ((investment ?? 0) / impressions) * 1000 : 0),
        frequencia: frequency ?? ((reach ?? 0) > 0 ? (impressions ?? 0) / reach : 0),
        roiOperacional: operationalRoi ?? ((investment ?? 0) > 0 ? (conversations ?? 0) / investment : 0),
        seguidores: followers,
        vendas: sales,
        leadsTrabalhados: workedLeads
      }));
    }
    return [...months.values()].sort((a, b) => a.chave.localeCompare(b.chave));
  }

  function parseCampaignRows(rows) {
    return rows.map(row => {
      const index = rowIndex(row);
      const key = monthKey(pick(index, aliases.month));
      const name = pick(index, aliases.campaign);
      if (!key || !name) return null;
      const investment = metric(index, 'investment') ?? 0;
      const impressions = metric(index, 'impressions') ?? 0;
      const reach = metric(index, 'reach') ?? 0;
      const clicks = metric(index, 'clicks') ?? 0;
      const conversations = metric(index, 'conversations') ?? 0;
      return {
        mes: key, nome: String(name), investimento: investment, impressoes: impressions,
        alcance: reach, cliques: Math.round(clicks), conversas: conversations,
        cpa: metric(index, 'cpa') ?? (conversations ? investment / conversations : 0),
        ctr: metric(index, 'ctr') ?? (impressions ? (clicks / impressions) * 100 : 0),
        cpc: metric(index, 'cpc') ?? (clicks ? investment / clicks : 0),
        cpm: metric(index, 'cpm') ?? (impressions ? (investment / impressions) * 1000 : 0),
        iec: toNumber(pick(index, ['IEC'])) ?? 0
      };
    }).filter(Boolean);
  }

  function parseAgeRows(rows) {
    return rows.map(row => {
      const index = rowIndex(row);
      const key = monthKey(pick(index, aliases.month));
      const age = pick(index, aliases.age);
      if (!key || !age) return null;
      return { mes: key, faixa: String(age), cpa: metric(index, 'cpa') ?? 0, conversas: metric(index, 'conversations') ?? 0 };
    }).filter(Boolean);
  }

  function parseGenderRows(rows) {
    return rows.map(row => {
      const index = rowIndex(row);
      const key = monthKey(pick(index, aliases.month));
      const gender = pick(index, aliases.gender);
      if (!key || !gender) return null;
      return { mes: key, nome: String(gender), participacao: metric(index, 'participation') ?? 0, cpa: metric(index, 'cpa') ?? 0 };
    }).filter(Boolean);
  }

  function parseDetailedRows(rows) {
    const groups = new Map();
    const ageGroups = new Map();
    const genderGroups = new Map();

    function getGroup(map, key) {
      if (!map.has(key)) map.set(key, { spend: 0, impressions: 0, reach: 0, clicks: 0, conversations: 0 });
      return map.get(key);
    }

    for (const row of rows) {
      const index = rowIndex(row);
      const key = monthKey(pick(index, aliases.month));
      if (!key) continue;

      const spend = metric(index, 'investment') ?? 0;
      const impressions = metric(index, 'impressions') ?? 0;
      const reach = metric(index, 'reach') ?? 0;
      const resultType = normalize(pick(index, aliases.resultType));
      const results = toNumber(pick(index, ['Resultados', 'results'])) ?? 0;
      const directClicks = toNumber(pick(index, ['Cliques', 'Cliques no link', 'Cliques (todos)', 'link_clicks', 'clicks']));
      const cpc = metric(index, 'cpc');
      const clicks = directClicks !== null
        ? directClicks
        : resultType.includes('clique')
          ? results
          : cpc && cpc !== 43 ? spend / cpc : 0;
      const conversations = resultType.includes('convers') || resultType.includes('messaging') ? results : 0;
      const campaignName = String(pick(index, aliases.campaign) || 'Sem campanha');

      const month = getGroup(groups, key);
      month.spend += spend;
      month.impressions += impressions;
      month.reach += reach;
      month.clicks += clicks;
      month.conversations += conversations;
      if (!month.campaigns) month.campaigns = new Map();
      const campaign = getGroup(month.campaigns, campaignName);
      campaign.spend += spend;
      campaign.impressions += impressions;
      campaign.reach += reach;
      campaign.clicks += clicks;
      campaign.conversations += conversations;

      const age = String(pick(index, aliases.age) || '').trim();
      if (age) {
        const ageGroup = getGroup(ageGroups, `${key}|${age}`);
        ageGroup.spend += spend;
        ageGroup.conversations += conversations;
      }

      const gender = String(pick(index, aliases.gender) || '').trim();
      if (gender) {
        const genderGroup = getGroup(genderGroups, `${key}|${gender}`);
        genderGroup.spend += spend;
        genderGroup.conversations += conversations;
      }
    }

    const meses = [...groups.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => enrichMonth({
      mes: monthLabel(key), chave: key, investimento: value.spend,
      impressoes: value.impressions, alcance: value.reach, cliques: Math.round(value.clicks),
      conversas: value.conversations,
      cpa: value.conversations ? value.spend / value.conversations : 0,
      ctr: value.impressions ? (value.clicks / value.impressions) * 100 : 0,
      cpc: value.clicks ? value.spend / value.clicks : 0,
      cpm: value.impressions ? (value.spend / value.impressions) * 1000 : 0,
      frequencia: value.reach ? value.impressions / value.reach : 0,
      roiOperacional: value.spend ? value.conversations / value.spend : 0,
      seguidores: null, vendas: null, leadsTrabalhados: null
    }));

    const campanhas = [];
    for (const [key, month] of groups.entries()) {
      for (const [name, value] of month.campaigns.entries()) {
        campanhas.push({
          mes: key, nome: name, investimento: value.spend, impressoes: value.impressions,
          alcance: value.reach, cliques: Math.round(value.clicks), conversas: value.conversations,
          cpa: value.conversations ? value.spend / value.conversations : 0,
          ctr: value.impressions ? (value.clicks / value.impressions) * 100 : 0,
          cpc: value.clicks ? value.spend / value.clicks : 0,
          cpm: value.impressions ? (value.spend / value.impressions) * 1000 : 0,
          iec: Math.round((value.conversations * 5) + (value.clicks ? 20 : 0))
        });
      }
    }

    const idade = [...ageGroups.entries()].map(([compound, value]) => {
      const [mes, faixa] = compound.split('|');
      return { mes, faixa, cpa: value.conversations ? value.spend / value.conversations : 0, conversas: value.conversations };
    });

    const genderSpendTotals = {};
    for (const [compound, value] of genderGroups.entries()) {
      const [mes] = compound.split('|');
      genderSpendTotals[mes] = (genderSpendTotals[mes] || 0) + value.spend;
    }
    const genero = [...genderGroups.entries()].map(([compound, value]) => {
      const [mes, nome] = compound.split('|');
      return {
        mes, nome,
        participacao: genderSpendTotals[mes] ? (value.spend / genderSpendTotals[mes]) * 100 : 0,
        cpa: value.conversations ? value.spend / value.conversations : 0
      };
    });

    return { meses, campanhas, idade, genero };
  }

  function sheetName(workbook, names) {
    const wanted = names.map(normalize);
    return workbook.SheetNames.find(name => wanted.includes(normalize(name))) || null;
  }

  function rowsFromSheet(workbook, xlsx, name) {
    if (!name || !workbook.Sheets[name]) return [];
    const sheet = workbook.Sheets[name];
    const grid = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: true });
    const headerRow = grid.findIndex(row => {
      const cells = row.map(normalize);
      const hasMonth = aliases.month.some(alias => cells.includes(normalize(alias)));
      const hasMetric = ['investment', 'impressions', 'sales', 'conversations', 'cpa', 'participation', 'followers', 'workedLeads'].some(group => aliases[group].some(alias => cells.includes(normalize(alias))));
      return hasMonth && hasMetric;
    });
    if (headerRow < 0) return [];
    return xlsx.utils.sheet_to_json(sheet, { range: headerRow, defval: '', raw: true });
  }

  function candidateSheet(workbook, xlsx, type) {
    for (const name of workbook.SheetNames) {
      const rows = rowsFromSheet(workbook, xlsx, name);
      if (!rows.length) continue;
      const headers = Object.keys(rows[0]).map(normalize);
      const hasSales = aliases.sales.some(alias => headers.includes(normalize(alias)));
      const hasInvestment = aliases.investment.some(alias => headers.includes(normalize(alias)));
      const hasImpressions = aliases.impressions.some(alias => headers.includes(normalize(alias)));
      if (type === 'summary' && hasSales && hasInvestment) return name;
      if (type === 'detail' && hasInvestment && hasImpressions) return name;
    }
    return null;
  }

  function parseMetaWorkbook(workbook, xlsx) {
    const sources = [];
    const summaryName = sheetName(workbook, ['Resumo Mensal', 'Resumo', 'Dados Mensais']) || candidateSheet(workbook, xlsx, 'summary');
    const campaignsName = sheetName(workbook, ['Campanhas', 'Campaigns']);
    const ageName = sheetName(workbook, ['Idade', 'Faixa Etária', 'Age']);
    const genderName = sheetName(workbook, ['Gênero', 'Genero', 'Gender']);
    const detailName = sheetName(workbook, ['Creative Reporting', 'Relatório', 'Relatorio', 'Meta Ads', 'Fonte Meta Ads']) || candidateSheet(workbook, xlsx, 'detail');

    let meses = summaryName ? parseMonthlyRows(rowsFromSheet(workbook, xlsx, summaryName)) : [];
    let campanhas = campaignsName ? parseCampaignRows(rowsFromSheet(workbook, xlsx, campaignsName)) : [];
    let idade = ageName ? parseAgeRows(rowsFromSheet(workbook, xlsx, ageName)) : [];
    let genero = genderName ? parseGenderRows(rowsFromSheet(workbook, xlsx, genderName)) : [];

    if (summaryName && meses.length) sources.push(summaryName);
    if (campaignsName && campanhas.length) sources.push(campaignsName);
    if (ageName && idade.length) sources.push(ageName);
    if (genderName && genero.length) sources.push(genderName);

    if ((!meses.length || !campanhas.length) && detailName) {
      const detailed = parseDetailedRows(rowsFromSheet(workbook, xlsx, detailName));
      if (!meses.length) meses = detailed.meses;
      if (!campanhas.length) campanhas = detailed.campanhas;
      if (!idade.length) idade = detailed.idade;
      if (!genero.length) genero = detailed.genero;
      if (detailed.meses.length) sources.push(detailName);
    }

    return { meses, campanhas, idade, genero, sourceSheets: [...new Set(sources)] };
  }

  function mergeDefined(base, incoming) {
    const result = { ...base };
    for (const [key, value] of Object.entries(incoming)) {
      if (hasValue(value) || typeof value === 'number') result[key] = value;
    }
    return result;
  }

  function replaceByMonths(existing, incoming) {
    if (!incoming.length) return existing || [];
    const months = new Set(incoming.map(item => item.mes));
    return [...(existing || []).filter(item => !months.has(item.mes)), ...incoming];
  }

  function mergeMetaData(base, incoming) {
    const monthMap = new Map((base.meses || []).map(month => [month.chave, enrichMonth(month)]));
    for (const month of incoming.meses || []) {
      const current = monthMap.get(month.chave) || {};
      monthMap.set(month.chave, enrichMonth(mergeDefined(current, month)));
    }
    const meses = [...monthMap.values()].sort((a, b) => a.chave.localeCompare(b.chave));
    return {
      ...base,
      periodo: meses.length ? `${meses[0].mes} a ${meses[meses.length - 1].mes}` : base.periodo,
      meses,
      campanhas: replaceByMonths(base.campanhas || [], incoming.campanhas || []),
      idade: replaceByMonths(base.idade || [], incoming.idade || []),
      genero: replaceByMonths(base.genero || [], incoming.genero || [])
    };
  }

  function normalizeMetaData(meta) {
    return { ...meta, meses: (meta.meses || []).map(enrichMonth).sort((a, b) => a.chave.localeCompare(b.chave)) };
  }

  return {
    enrichMonth,
    hasValue,
    mergeMetaData,
    monthKey,
    monthLabel,
    normalizeMetaData,
    parseDetailedRows,
    parseMetaWorkbook,
    parseMonthlyRows,
    toNumber
  };
});
