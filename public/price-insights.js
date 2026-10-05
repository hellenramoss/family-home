(() => {
  const normalize = value => (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');

  const parsePrice = value => {
    if (value == null || value === '') return null;
    const cleaned = String(value).replace(/\s/g, '').replace('R$', '').replace(',', '.');
    const number = Number(cleaned);
    return Number.isFinite(number) ? number : null;
  };

  const money = value => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const date = value => new Date(value).toLocaleDateString('pt-BR');

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
      entries.push({ ...record, numericPrice: price });
      groups.set(key, entries);
    });

    return [...groups.values()].map(entries => {
      entries.sort((a, b) => new Date(b.purchasedAt).getTime() - new Date(a.purchasedAt).getTime());
      const latest = entries[0];
      const previous = entries[1];
      const prices = entries.map(entry => entry.numericPrice);
      const average = prices.reduce((sum, value) => sum + value, 0) / prices.length;
      const minimum = Math.min(...prices);
      const change = previous ? latest.numericPrice - previous.numericPrice : null;
      const percent = previous && previous.numericPrice !== 0 ? (change / previous.numericPrice) * 100 : null;
      return { name: latest.itemName, latest, previous, average, minimum, change, percent, count: entries.length };
    }).sort((a, b) => new Date(b.latest.purchasedAt).getTime() - new Date(a.latest.purchasedAt).getTime());
  };

  const closePanel = () => {
    document.querySelector('.priceInsightsOverlay')?.remove();
    document.body.classList.remove('priceInsightsActive');
  };

  const openPanel = () => {
    closePanel();
    const groups = buildGroups();
    const overlay = document.createElement('div');
    overlay.className = 'priceInsightsOverlay';
    overlay.innerHTML = `
      <section class="priceInsightsSheet" role="dialog" aria-modal="true" aria-label="Análise de preços">
        <div class="priceInsightsHead">
          <button type="button" class="priceInsightsClose" aria-label="Fechar">×</button>
          <h2>Análise de preços</h2>
          <span></span>
        </div>
        <div class="priceInsightsIntro">
          <strong>Quanto você vem pagando</strong>
          <small>Comparamos os preços registrados nas suas compras anteriores.</small>
        </div>
        <div class="priceInsightsList"></div>
      </section>`;

    const list = overlay.querySelector('.priceInsightsList');
    if (!groups.length) {
      list.innerHTML = '<div class="priceInsightsEmpty">Ainda não há compras com preço registrado.</div>';
    } else {
      groups.forEach(group => {
        const row = document.createElement('div');
        row.className = 'priceInsightRow';
        let comparison = '<span class="priceLearning">1 preço registrado</span>';
        if (group.previous) {
          const direction = group.change > 0.005 ? 'up' : group.change < -0.005 ? 'down' : 'same';
          const sign = group.change > 0 ? '+' : '';
          const pct = group.percent == null ? '' : ` (${group.percent > 0 ? '+' : ''}${group.percent.toFixed(1).replace('.', ',')}%)`;
          const label = direction === 'same' ? 'igual à compra anterior' : `${sign}${money(group.change)}${pct} vs. anterior`;
          comparison = `<span class="priceTrend ${direction}">${label}</span>`;
        }
        row.innerHTML = `
          <div class="priceInsightTop">
            <div><strong>${escapeHtml(group.name)}</strong><small>última compra ${date(group.latest.purchasedAt)}</small></div>
            <b>${money(group.latest.numericPrice)}</b>
          </div>
          <div class="priceInsightStats">
            ${comparison}
            ${group.count > 1 ? `<small>menor ${money(group.minimum)} · média ${money(group.average)} · ${group.count} preços</small>` : '<small>Registre outra compra com preço para comparar.</small>'}
          </div>`;
        list.appendChild(row);
      });
    }

    overlay.addEventListener('click', event => { if (event.target === overlay) closePanel(); });
    overlay.querySelector('.priceInsightsClose').addEventListener('click', closePanel);
    document.body.appendChild(overlay);
    document.body.classList.add('priceInsightsActive');
  };

  const escapeHtml = value => String(value).replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));

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
