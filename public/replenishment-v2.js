(() => {
  const DAY = 86400000;
  const normalize = value => String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');

  const median = values => {
    const sorted = [...values].sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
  };

  const dayKey = value => {
    const date = new Date(value);
    return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
  };

  const marketHistory = () => {
    try {
      const lists = JSON.parse(localStorage.getItem('family-home-lists') || '[]');
      const market = lists.find(list => list.id === 'market' || String(list.name || '').toUpperCase().includes('MERCADO'));
      return market?.purchaseHistory || [];
    } catch {
      return [];
    }
  };

  const buildStats = () => {
    const grouped = new Map();
    marketHistory().forEach(record => {
      const key = normalize(record.itemName);
      if (!key) return;
      const records = grouped.get(key) || [];
      records.push(record);
      grouped.set(key, records);
    });

    const stats = new Map();
    grouped.forEach((records, key) => {
      const ordered = [...records].sort((a, b) => new Date(a.purchasedAt) - new Date(b.purchasedAt));
      const unique = ordered.filter((record, index) => index === 0 || dayKey(record.purchasedAt) !== dayKey(ordered[index - 1].purchasedAt));
      const last = unique[unique.length - 1];
      if (!last) return;
      if (unique.length < 2) {
        stats.set(key, { count: unique.length, last });
        return;
      }
      const gaps = unique.slice(1).map((record, index) => (new Date(record.purchasedAt) - new Date(unique[index].purchasedAt)) / DAY).filter(value => value > 0);
      if (!gaps.length) {
        stats.set(key, { count: unique.length, last });
        return;
      }
      const rawMedian = median(gaps);
      const interval = Math.max(1, Math.round(rawMedian));
      const deviations = gaps.map(value => Math.abs(value - rawMedian));
      const relativeVariation = rawMedian > 0 ? median(deviations) / rawMedian : 1;
      let confidence = 'low';
      if (unique.length >= 5 && relativeVariation <= 0.25) confidence = 'high';
      else if (unique.length >= 3 && relativeVariation <= 0.5) confidence = 'medium';
      const nextDate = new Date(new Date(last.purchasedAt).getTime() + interval * DAY);
      const daysUntil = Math.ceil((nextDate.getTime() - Date.now()) / DAY);
      stats.set(key, { count: unique.length, last, interval, daysUntil, confidence, gaps });
    });
    return stats;
  };

  const confidenceText = stat => {
    if (!stat.interval) return `aprendendo · ${stat.count}/2 compras`;
    if (stat.confidence === 'high') return 'previsão confiável';
    if (stat.confidence === 'medium') return 'confiança média';
    return stat.count <= 2 ? 'primeira estimativa' : 'padrão variável';
  };

  const statusText = stat => {
    if (!stat.interval) return 'aprendendo';
    if (stat.daysUntil <= 0) return 'hora de repor';
    const soon = Math.max(2, Math.round(stat.interval * 0.2));
    if (stat.daysUntil <= soon) return 'repor em breve';
    return `em ${stat.daysUntil} dias`;
  };

  const enhance = sheet => {
    if (!sheet || sheet.dataset.replenishmentV2 === '1') return;
    // Mark before touching the DOM so our own mutations cannot trigger another render pass.
    sheet.dataset.replenishmentV2 = '1';
    const stats = buildStats();
    sheet.querySelectorAll('.insightRow').forEach(row => {
      const name = row.querySelector('.insightMain strong')?.textContent || '';
      const stat = stats.get(normalize(name));
      if (!stat) return;
      const main = row.querySelector('.insightMain');
      const detail = main?.querySelector('small');
      if (detail && stat.interval) {
        const lastDate = new Date(stat.last.purchasedAt).toLocaleDateString('pt-BR');
        detail.textContent = `Costuma durar ~${stat.interval} dias · última compra ${lastDate}`;
      }
      if (main) {
        const confidence = document.createElement('span');
        confidence.className = `replenishmentConfidence ${stat.confidence || 'learning'}`;
        confidence.textContent = confidenceText(stat);
        main.appendChild(confidence);
      }
      const status = row.querySelector('.insightStatus');
      if (status) {
        status.textContent = statusText(stat);
        status.classList.toggle('due', Boolean(stat.interval && stat.daysUntil <= 0));
      }
    });
    const intro = sheet.querySelector('.insightsIntro small');
    if (intro) intro.textContent = 'Usamos o intervalo mediano entre compras para evitar que uma compra fora do padrão distorça a previsão.';
  };

  const enhanceCurrentSheet = () => enhance(document.querySelector('.insightsSheet'));
  const observer = new MutationObserver(mutations => {
    if (!mutations.some(mutation => [...mutation.addedNodes].some(node => node.nodeType === 1 && (node.matches?.('.insightsSheet') || node.querySelector?.('.insightsSheet'))))) return;
    requestAnimationFrame(enhanceCurrentSheet);
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
  enhanceCurrentSheet();
})();