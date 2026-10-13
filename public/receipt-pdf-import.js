(() => {
  const STORAGE_KEY = 'family-home-lists';
  const dateKey = 'purchaseHistory';
  const pdfScript = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js';
  const worker = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';
  const aliases = {
    'CLOSE UP':'Pasta de dente','TOA SELEC BABY':'Lenços umedecidos','P AL BOMPACK':'Papel alumínio',
    'FILM BOMPACK':'Papel filme','P H MAX':'Papel higiênico','TOALHA YURI':'Papel toalha',
    'GEL INSPI':'Gel para vaso sanitário','AG ASSAI C/G':'Água com gás',
    'QJ MUSS':'Mussarela','MUSS DO VALLE':'Mussarela','L TIROL ZERO LACT':'Leite zero lactose',
    'BOMBOM LACTA':'Bombom Lacta','MIST B D B':'Mistura para bolo Dona Benta chocolate com avelã',
    'ALM P/C SP SC':'Sachê Special Dog para cães','CASAePERF':'Desinfetante casa',
    'CEBOLA NAC':'Cebola','BRO C':'Brócolis','BROC NINJA':'Brócolis','PEI PERU':'Peito de peru',
    'BANANA PRATA':'Banana','TOMATE ITALIANO':'Tomate','REPOLHO VERDE':'Repolho',
    'MELANCIA BABY':'Melancia','KIWI SUNGOLD':'Kiwi','LIMAO THAITI':'Limão',
    'MORANGO FRES':'Morango','MACA SACOLA':'Maçã','OVO BCO':'Ovos',
    'D TRIEX':'Desinfetante casa','L PISO UAU':'Limpa laminado','AMAC AROM':'Amaciante de roupas',
    'DET CANDURA':'Detergente líquido','ALV S CAND':'Água sanitária',
    'BAC SEARA':'Bacon','QJ MUSS AURORA':'Mussarela',
    'LI TOSC':'Linguiça toscana','COXINHA ASA':'Coxinha de frango',
    'FRISKIES 85G FGO':'Sachê Friskies frango ao molho',
    'FRISKIES 85G CARNE':'Sachê Friskies carne ao molho',
    'FRISKIES 85G SALMAO':'Sachê Friskies salmão ao molho',
    'FRISKIES 850G':'Ração para gatos','WHISKAS':'Sachê Whiskas',
    'NEC':'Suco','NECT LIFE 900ML MARA':'Suco de maracujá',
    'SUCO ALIANCA':'Suco de uva','SUCO LIFE 900ML LAR':'Suco de laranja',
    'PANCO ROSQ':'Rosquinha Panco','FAROF YOKI':'Farofa','AMEND JAPO':'Amendoim japonês',
    'BAT LAYS':'Batata chips Lay\'s','BAT BEM BR':'Batata congelada',
    'ESPUM EXPA':'Espuma expansiva','FANTA LARANJA':'Refrigerante Fanta laranja',
    'COCA COLA TRI ZR':'Refrigerante zero','REF GUARANITA Z':'Refrigerante zero'
  };
  const categoryRules = [
    ['produce',/banana|maçã|maca|morango|limão|limao|kiwi|tomate|cebola|abobr|repolho|brócol|brocol|melancia|maracuj|fruta|uva/i],
    ['pets',/friskies|whiskas|sachê|ração|racao|special dog|alim p\/g/i],
    ['cleaning',/pasta de dente|close up|papel|lenço|toalha|deterg|desinf|cif|limp|amaciante|gel para vaso|sanit|espuma expansiva|filme|guardanapo/i],
    ['meat',/frango|carne|fígado|figado|peru|bacon|lingui|coxinha|sadia|seara/i],
    ['dairy',/leite|mussarela|queijo|ricota|ovo|iogurte/i],
    ['drinks',/água|agua|suco|refrigerante|coca|fanta|red bull|energético|energetico|cerveja|vinho|jurupinga|pepsi/i],
    ['snacks',/bolo|biscoito|bolinho|chocolate|bombom|salgadinho|fofura|rosquinha|batata chips|amendoim/i],
    ['bakery',/wrap|massa de pão|pao|pão/i],
    ['frozen',/congelada|congelado/i],
    ['ingredients',/farofa|orégano|oregano|tempero/i]
  ];
  const clean = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
  const currency = n => n.toFixed(2).replace('.',',');
  const number = s => Number(String(s).replace(',','.'));
  const escapeHtml = v => String(v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function normalizeItem(raw, existing) {
    const original = raw.trim().replace(/\s+/g,' ');
    const prefix = Object.keys(aliases).sort((a,b) => b.length-a.length).find(k => original.toUpperCase().startsWith(k));
    if(prefix) return aliases[prefix];
    if(!/\b(?:[A-Z]{2,}|\d+G|\d+ML)\b/.test(original)) return original;
    const guess = original.toLowerCase().replace(/\b\d+(?:[,.]\d+)?\s*(?:g|kg|ml|l|un)\b/gi,'').replace(/\b(?:trad|classi|ft|un|pc|bd|lav)\b/gi,'').trim();
    const known = existing.find(x => clean(x.name) === clean(guess));
    return known ? known.name : original;
  }
  function category(name, existing) {
    const found = existing.find(x => clean(x.name) === clean(name));
    if(found?.category) return found.category;
    return categoryRules.find(([,pattern]) => pattern.test(name))?.[0] || 'other';
  }
  async function pdfLibrary() {
    if(window.pdfjsLib) return window.pdfjsLib;
    await new Promise((resolve,reject) => {
      const s=document.createElement('script');s.src=pdfScript;s.onload=resolve;s.onerror=reject;document.head.append(s);
    });
    if(!window.pdfjsLib) throw Error('Não foi possível carregar o leitor de PDF.');
    window.pdfjsLib.GlobalWorkerOptions.workerSrc=worker;
    return window.pdfjsLib;
  }
  async function extract(file) {
    const pdfjs = await pdfLibrary();
    const pdf = await pdfjs.getDocument({data:new Uint8Array(await file.arrayBuffer())}).promise;
    const pages = [];
    for(let p=1;p<=pdf.numPages;p++){
      const page=await pdf.getPage(p);
      const content=await page.getTextContent();
      const parts=content.items.filter(x => x.str?.trim()).map(x=>({
        text:x.str.trim(),x:x.transform[4],y:Math.round(x.transform[5]*10)/10
      }));
      parts.sort((a,b)=>b.y-a.y||a.x-b.x);
      pages.push(parts);
    }
    const flat=pages.flat().map(x=>x.text).join(' ');
    const dateMatch=flat.match(/Emiss[aã]o:\s*(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}:\d{2}:\d{2})/i);
    const keyMatch=flat.replace(/\D/g,'').match(/3526\d{40}/);
    const docMatch=flat.match(/N[uú]mero:\s*(\d+)\s+S[eé]rie:\s*(\d+)/i);
    const totalMatch=flat.match(/Valor total R\$:\s*([\d.,]+)/i);
    const paidMatch=flat.match(/Valor a pagar R\$:\s*([\d.,]+)/i);
    if(!dateMatch||!docMatch) throw Error('Não encontrei a data ou número da NFC-e. Use o PDF da consulta da Secretaria da Fazenda.');
    const entries=[];
    for(const parts of pages) {
      const desc=parts.filter(x=>x.x<410 && /\(C[oó]digo:\s*\d+\s*\)/i.test(x.text));
      // Alguns PDFs separam o código em um span, por isso a leitura usa as linhas inteiras.
      const ys=[...new Set(parts.filter(x=>x.x<415 && /C[oó]digo:/i.test(x.text)).map(x=>x.y))];
      for(const y of ys){
        const line=parts.filter(x=>Math.abs(x.y-y)<2.0 && x.x<420).sort((a,b)=>a.x-b.x).map(x=>x.text).join(' ');
        const match=line.match(/(.+?)\s*\(C[oó]digo:\s*(\d+)\s*\)/i);
        if(!match) continue;
        const qtyParts=parts.filter(x=>x.y<y-3 && x.y>y-17 && x.x<420).sort((a,b)=>a.x-b.x);
        const qtyLine=qtyParts.map(x=>x.text).join(' ');
        const detail=qtyLine.match(/Qtde\.?\s*:\s*([\d.,]+)\s*UN:\s*(\w+)\s*Vl\.?\s*Unit\.?\s*:\s*([\d.,]+)/i);
        const prices=parts.filter(x=>x.x>418 && x.y<y && x.y>y-17 && /^\d+[.,]\d{2}$/.test(x.text));
        if(!detail||!prices.length) continue;
        const total=number(prices.sort((a,b)=>b.y-a.y)[0].text);
        entries.push({original:match[1].trim(),code:match[2],quantity:number(detail[1]),unit:detail[2].toLowerCase(),unitPrice:number(detail[3]),total});
      }
    }
    if(!entries.length) throw Error('Não consegui identificar os produtos. PDFs digitalizados como imagem ainda não são aceitos.');
    const gross=entries.reduce((a,x)=>a+Math.round(x.total*100),0)/100;
    if(totalMatch && Math.abs(gross-number(totalMatch[1]))>0.02)
      throw Error('A soma dos produtos não corresponde ao total fiscal. Nenhum registro foi salvo.');
    const purchasedAt=`${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]}T${dateMatch[4]}-03:00`;
    const receiptKey=keyMatch?.[0] || `${docMatch[1]}-${docMatch[2]}-${dateMatch[1]}${dateMatch[2]}${dateMatch[3]}`;
    return {entries,purchasedAt,receiptKey,gross,paid:paidMatch?number(paidMatch[1]):null,store:flat.includes('SENDAS DISTRIBUIDORA')?'Assaí':'Supermercado'};
  }
  function existingMarket(){
    try {return JSON.parse(localStorage.getItem(STORAGE_KEY)||'[]').find(l=>l.id==='market'||/MERCADO|COMPRAS/i.test(l.name));}
    catch{return null;}
  }
  function open() {
    const input=document.createElement('input');input.type='file';input.accept='application/pdf,.pdf';
    input.onchange=async()=>{
      if(!input.files?.[0]) return;
      const overlay=document.createElement('div');overlay.className='receiptOverlay';
      overlay.innerHTML='<section class="receiptSheet"><h2>Importar nota fiscal</h2><p>Lendo PDF…</p></section>';
      document.body.append(overlay);
      const sheet=overlay.firstElementChild;
      const close=()=>overlay.remove();
      try {
        const receipt=await extract(input.files[0]);
        const market=existingMarket();
        if(!market) throw Error('Abra a Lista de Compras e aguarde a sincronização antes de importar.');
        const history=market.purchaseHistory||[];
        if(history.some(x=>x.receiptKey===receipt.receiptKey||x.source===`NFC-e ${receipt.receiptKey}`))
          throw Error('Essa nota fiscal já está no histórico.');
        const grouped=new Map();
        receipt.entries.forEach((r,i)=>{
          const name=normalizeItem(r.original,market.items||[]);
          const key=`${clean(name)}|${r.unit}|${r.unitPrice}`;
          if(!grouped.has(key)) grouped.set(key,{name,unit:r.unit,unitPrice:r.unitPrice,quantity:0,total:0,category:category(name,market.items||[]),lines:[]});
          const group=grouped.get(key);
          group.quantity+=r.quantity;group.total+=Math.round(r.total*100);
          group.lines.push({originalName:r.original,productCode:r.code,quantity:String(r.quantity).replace('.',','),lineTotal:currency(r.total),line:i+1});
        });
        const groups=[...grouped.values()];
        sheet.innerHTML=`<header><h2>Conferir nota fiscal</h2><button type="button" class="receiptClose">×</button></header>
         <p>${escapeHtml(receipt.store)} · ${new Date(receipt.purchasedAt).toLocaleDateString('pt-BR')} · ${receipt.entries.length} linhas</p>
         <p><strong>Total: R$ ${currency(receipt.gross)}</strong> · Pago: R$ ${receipt.paid===null?'não informado':currency(receipt.paid)}</p>
         <p>Confira os nomes antes de salvar. Os produtos serão adicionados apenas ao histórico.</p>
         <div class="receiptRows"></div><footer><button type="button" class="receiptCancel">Cancelar</button><button type="button" class="receiptSave">Salvar no histórico</button></footer><small class="receiptStatus"></small>`;
        sheet.querySelector('.receiptClose').onclick=close;sheet.querySelector('.receiptCancel').onclick=close;
        const list=sheet.querySelector('.receiptRows');
        groups.forEach((g,i)=>{
          const row=document.createElement('label');row.className='receiptRow';
          row.innerHTML=`<input aria-label="Nome do produto" value="${escapeHtml(g.name)}" data-index="${i}"><small>${escapeHtml(g.lines[0].originalName)} · ${String(Number(g.quantity.toFixed(3))).replace('.',',')} ${g.unit}</small><b>R$ ${currency(g.total/100)}</b>`;
          list.append(row);
        });
        sheet.querySelector('.receiptSave').onclick=()=>{
          try{
            const entries=groups.map((g,i)=>{
              const name=list.querySelector(`[data-index="${i}"]`).value.trim();
              if(!name) throw Error('Todos os produtos precisam ter nome.');
              return {id:crypto.randomUUID(),itemName:name,category:category(name,market.items||[]),
                quantity:String(Number(g.quantity.toFixed(3))).replace('.',','),unit:g.unit,price:currency(g.total/100),
                unitPrice:currency(g.unitPrice),purchasedAt:receipt.purchasedAt,receiptKey:receipt.receiptKey,
                source:`NFC-e ${receipt.receiptKey}`,receiptLines:g.lines};
            });
            window.dispatchEvent(new CustomEvent('family-home-receipt-import',{detail:{receiptKey:receipt.receiptKey,entries}}));
            close();
          }catch(error){sheet.querySelector('.receiptStatus').textContent=error.message;}
        };
      } catch(error){
        sheet.innerHTML=`<h2>Não foi possível importar</h2><p>${escapeHtml(error.message)}</p><button class="receiptCancel">Fechar</button>`;
        sheet.querySelector('button').onclick=close;
      }
    };
    input.click();
  }
  window.familyHomeOpenReceiptPdf=open;
})();