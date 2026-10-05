(() => {
  const normalize = value => (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');

  const parseNumber = value => {
    if (value == null || value === '') return null;
    const number = Number(String(value).trim().replace(',', '.'));
    return Number.isFinite(number) ? number : null;
  };
  const parsePrice = value => {
    if (value == null || value === '') return null;
    const cleaned = String(value).replace(/\s/g, '').replace('R$', '').replace(',', '.');
    const number = Number(cleaned);
    return Number.isFinite(number) ? number : null;
  };
  const money = value => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const date = value => new Date(value).toLocaleDateString('pt-BR');
  const escapeHtml = value => String(value).replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));

  const unitPrice = record => {
    const price = parsePrice(record.price);
    const quantity = parseNumber(record.quantity);
    if (price == null || quantity == null || quantity <= 0 || !record.unit) return null;
    const unit = String(record.unit).toLocaleLowerCase('pt-BR');
    if (unit === 'kg') return { value: price / quantity, basis: 'kg', label: '/kg' };
    if (unit === 'g') return { value: price / (quantity / 1000), basis: 'kg', label: '/kg' };
    if (unit === 'l') return { value: price / quantity, basis: 'l', label: '/L' };
    if (unit === 'ml') return { value: price / (quantity / 1000), basis: 'l', label: '/L' };
    if (unit === 'un') return { value: price / quantity, basis: 'un', label: '/un' };
    if (unit === 'pct') return { value: price / quantity, basis: 'pct', label: '/pct' };
    return null;
  };

  const getMarket = () => {
    try {
      const lists = JSON.parse(localStorage.getItem('family-home-lists') || '[]');
      return lists.find(list => list.id === 'market' || String(list.name || '').toUpperCase().includes('MERCADO'));
    } catch {
      return null;
    }
  };

  const buildGroups = () => {
    const market = getMarket();
    const groups = new Map();
    (market?.purchaseHistory || []).forEach(record => {
      const price = parsePrice(record.price);
      if (price == null) return;
      const key = normalize(record.itemName);
      if (!key) return;
      const entries = groups.get(key) || [];
      entries.push({ ...record, numericPrice: price, unitPrice: unitPrice(record) });
      groups.set(key, entries);
    });

    return [...groups.values()].map(entries => {
      entries.sort((a, b) => new Date(b.purchasedAt).getTime() - new Date(a.purchasedAt).getTime());
      const latest = entries[0];
      const comparable = latest.unitPrice
        ? entries.filter(entry => entry.unitPrice?.basis === latest.unitPrice.basis).map(entry => ({ ...entry, comparablePrice: entry.unitPrice.value }))
        : entries.filter(entry => !entry.unitPrice).map(entry => ({ ...entry, comparablePrice: entry.numericPrice }));
      const latestComparable = comparable[0];
      const previous = comparable[1];
      const prices = comparable.map(entry => entry.comparablePrice);
      const average = prices.reduce((sum, value) => sum + value, 0) / prices.length;
      const minimum = Math.min(...prices);
      const change = previous ? latestComparable.comparablePrice - previous.comparablePrice : null;
      const percent = previous && previous.comparablePrice !== 0 ? (change / previous.comparablePrice) * 100 : null;
      return { name: latest.itemName, latest, previous, average, minimum, change, percent, count: comparable.length, entries, basisLabel: latest.unitPrice?.label || '' };
    }).sort((a, b) => new Date(b.latest.purchasedAt).getTime() - new Date(a.latest.purchasedAt).getTime());
  };

  const closePanel = () => {
    document.querySelector('.priceInsightsOverlay')?.remove();
    document.body.classList.remove('priceInsightsActive');
  };

  const comparisonHtml = group => {
    if (!group.previous) return '<span class="priceLearning">1 preço comparável</span>';
    const direction = group.change > 0.005 ? 'up' : group.change < -0.005 ? 'down' : 'same';
    const sign = group.change > 0 ? '+' : '';
    const pct = group.percent == null ? '' : ` (${group.percent > 0 ? '+' : ''}${group.percent.toFixed(1).replace('.', ',')}%)`;
    const label = direction === 'same' ? 'igual à compra anterior' : `${sign}${money(group.change)}${group.basisLabel}${pct} vs. anterior`;
    return `<span class="priceTrend ${direction}">${label}</span>`;
  };

  const renderList = (overlay, groups) => {
    const sheet = overlay.querySelector('.priceInsightsSheet');
    sheet.innerHTML = `
      <div class="priceInsightsHead"><button type="button" class="priceInsightsClose" aria-label="Fechar">×</button><h2>Análise de preços</h2><span></span></div>
      <div class="priceInsightsIntro"><strong>Quanto você vem pagando</strong><small>Comparamos preços equivalentes e calculamos valor por kg, litro ou unidade quando houver quantidade.</small></div>
      <div class="priceInsightsList"></div>`;
    sheet.querySelector('.priceInsightsClose').addEventListener('click', closePanel);
    const list = sheet.querySelector('.priceInsightsList');
    if (!groups.length) {
      list.innerHTML = '<div class="priceInsightsEmpty">Ainda não há compras com preço registrado.</div>';
      return;
    }
    groups.forEach(group => {
      const row = document.createElement('button');
      row.type = 'button';
      row.className = 'priceInsightRow priceInsightButton';
      const unitLine = group.latest.unitPrice ? `<small class="priceUnitValue">${money(group.latest.unitPrice.value)}${group.latest.unitPrice.label}</small>` : '';
      row.innerHTML = `
        <div class="priceInsightTop"><div><strong>${escapeHtml(group.name)}</strong><small>última compra ${date(group.latest.purchasedAt)}</small></div><div class="priceCurrent"><b>${money(group.latest.numericPrice)}</b>${unitLine}</div></div>
        <div class="priceInsightStats">${comparisonHtml(group)}${group.count > 1 ? `<small>menor ${money(group.minimum)}${group.basisLabel} · média ${money(group.average)}${group.basisLabel} · ${group.count} preços comparáveis</small>` : '<small>Registre outra compra equivalente para comparar.</small>'}</div>
        <span class="priceRowChevron">›</span>`;
      row.addEventListener('click', () => renderDetail(overlay, groups, group));
      list.appendChild(row);
    });
  };

  const renderDetail = (overlay, groups, group) => {
    const sheet = overlay.querySelector('.priceInsightsSheet');
    sheet.innerHTML = `
      <div class="priceInsightsHead"><button type="button" class="priceInsightsBack" aria-label="Voltar">‹</button><h2>${escapeHtml(group.name)}</h2><button type="button" class="priceInsightsClose" aria-label="Fechar">×</button></div>
      <div class="priceDetailSummary">
        <div><small>Último</small><strong>${money(group.latest.numericPrice)}</strong>${group.latest.unitPrice ? `<span>${money(group.latest.unitPrice.value)}${group.latest.unitPrice.label}</span>` : ''}</div>
        <div><small>Menor comparável</small><strong>${money(group.minimum)}${group.basisLabel}</strong></div>
        <div><small>Média comparável</small><strong>${money(group.average)}${group.basisLabel}</strong></div>
      </div>
      <div class="priceDetailTitle"><strong>Histórico de preços</strong><small>${group.entries.length} ${group.entries.length === 1 ? 'compra registrada' : 'compras registradas'}</small></div>
      <div class="priceTimeline"></div>`;
    sheet.querySelector('.priceInsightsBack').addEventListener('click', () => renderList(overlay, groups));
    sheet.querySelector('.priceInsightsClose').addEventListener('click', closePanel);
    const timeline = sheet.querySelector('.priceTimeline');
    group.entries.forEach(entry => {
      const item = document.createElement('div');
      item.className = 'priceTimelineRow';
      const qty = entry.quantity ? `${escapeHtml(entry.quantity)} ${escapeHtml(entry.unit || '')}` : 'quantidade não informada';
      const unit = entry.unitPrice ? `<small>${money(entry.unitPrice.value)}${entry.unitPrice.label}</small>` : '';
      item.innerHTML = `<div><strong>${date(entry.purchasedAt)}</strong><small>${qty}</small></div><div><b>${money(entry.numericPrice)}</b>${unit}</div>`;
      timeline.appendChild(item);
    });
  };

  const openPanel = () => {
    closePanel();
    const groups = buildGroups();
    const overlay = document.createElement('div');
    overlay.className = 'priceInsightsOverlay';
    overlay.innerHTML = '<section class="priceInsightsSheet" role="dialog" aria-modal="true" aria-label="Análise de preços"></section>';
    overlay.addEventListener('click', event => { if (event.target === overlay) closePanel(); });
    document.body.appendChild(overlay);
    document.body.classList.add('priceInsightsActive');
    renderList(overlay, groups);
  };

  const enhanceHistory = () => {
    document.querySelectorAll('.historySheet').forEach(sheet => {
      if (sheet.querySelector('[data-price-insights]')) return;
      const head = sheet.querySelector('.nativeSheetHead');
      if (!head) return;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'priceInsightsEntry';
      button.setAttribute('data-price-insights', 'true');
      button.innerHTML = '<span>↗</span><div><strong>Análise de preços</strong><small>Veja último preço, média e variação</small></div><b>›</b>';
      button.addEventListener('click', openPanel);
      head.insertAdjacentElement('afterend', button);
    });
  };

  const observer = new MutationObserver(enhanceHistory);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  enhanceHistory();
})();