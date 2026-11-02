// تحليل نص الطلب العربي (صوت أو كتابة) إلى مسودة طلبيات
(function (g) {
  const norm = s => String(s || '')
    .replace(/[\u064B-\u0652\u0640]/g, '')            // تشكيل وتطويل
    .replace(/[أإآٱ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').replace(/ؤ/g, 'و').replace(/ئ/g, 'ي')
    .replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d))
    .replace(/٫/g, '.').replace(/(\d),(\d)/g, '$1.$2')
    .replace(/[(),،:؛.!?؟\-–\n]/g, m => (m === '.' ? '.' : ' '))
    .replace(/(\d)\s*\.\s*(?!\d)/g, '$1 ')
    .replace(/(\d)([^\d\s.])/g, '$1 $2').replace(/([^\d\s.])(\d)/g, '$1 $2')
    .replace(/\s+/g, ' ').trim().toLowerCase();
  const strip = w => w.replace(/^(وال|بال|لل|ال|و|ب|ل)(?=..)/, '').replace(/^ال(?=..)/, '');
  const ONES = { 'واحد': 1, 'واحده': 1, 'وحده': 1, 'اثنين': 2, 'اثنان': 2, 'اتنين': 2, 'ثنين': 2, 'ثلاث': 3, 'ثلاثه': 3, 'تلات': 3, 'تلاته': 3, 'اربع': 4, 'اربعه': 4, 'خمس': 5, 'خمسه': 5, 'ست': 6, 'سته': 6, 'سبع': 7, 'سبعه': 7, 'ثمان': 8, 'ثماني': 8, 'ثمانيه': 8, 'ثمنيه': 8, 'تمانيه': 8, 'تمنيه': 8, 'تسع': 9, 'تسعه': 9, 'عشر': 10, 'عشره': 10,
    'حداش': 11, 'احدعش': 11, 'احدعشر': 11, 'اطناش': 12, 'اثنعش': 12, 'اثنعشر': 12, 'اتناش': 12, 'ثلطعش': 13, 'تلتاش': 13, 'ثلاثطعش': 13, 'اربعطعش': 14, 'اربعتاش': 14, 'خمسطعش': 15, 'خمستاش': 15, 'ستطعش': 16, 'سطاش': 16, 'سبعطعش': 17, 'سبعتاش': 17, 'ثمنطعش': 18, 'تمنتاش': 18, 'تسعطعش': 19, 'تسعتاش': 19,
    'عشرين': 20, 'ثلاثين': 30, 'تلاتين': 30, 'اربعين': 40, 'خمسين': 50, 'ستين': 60, 'سبعين': 70, 'ثمانين': 80, 'تمانين': 80, 'تسعين': 90, 'ميه': 100, 'مئه': 100, 'مية': 100, 'ميتين': 200, 'مئتين': 200, 'ثلاثميه': 300, 'ثلثميه': 300, 'تلاتميه': 300, 'تلتميه': 300, 'اربعميه': 400, 'اربعمئه': 400, 'خمسميه': 500, 'خمسمئه': 500, 'ستميه': 600, 'ستمئه': 600, 'سبعميه': 700, 'ثمانميه': 800, 'ثمنميه': 800, 'تمنميه': 800, 'تسعميه': 900, 'الف': 1000, 'الفين': 2000, 'نص': 0.5, 'نصف': 0.5, 'ربع': 0.25 };
  const KILO_W = /^(كيلو|كيلوات|كيلوهات|كغ|كجم|كيلوغرام|كيلوجرام)$/;
  const UNIT_W = /^(كيلو|كيلوات|كيلوهات|كغ|كجم|كيلوغرام|كيلوجرام|كيلو جرام|صينيه|صواني|صحن|صحون|حبه|حبات|علبه|علب|طبق|اطباق|جرام|غرام)$/;
  function wordNum(w) { if (/^\d+(\.\d+)?$/.test(w)) return Number(w); const s = w.replace(/^و(?=..)/, ''); return ONES[w] ?? ONES[s] ?? null; }
  // يرجع [{i (index), v}] أرقام، مع دمج "خمسه وعشرين" و "عشره ونص"
  function numbers(tokens) {
    const out = [];
    for (let i = 0; i < tokens.length; i++) {
      let v = wordNum(tokens[i]); if (v == null) continue;
      let j = i;
      while (j + 1 < tokens.length) {
        const nx = tokens[j + 1]; const nv = wordNum(nx);
        if (v < 10 && /^(ميه|مئه|مية)$/.test(nx)) { v *= 100; j++; continue; }       // "ثلاث ميه" = 300
        if (v < 10 && /^(الاف|الف|آلاف)$/.test(nx)) { v *= 1000; j++; continue; }
        if (nv != null && /^و/.test(nx) && !/^\d/.test(nx)) { v += nv; j++; continue; }
        if (nx === 'و' && j + 2 < tokens.length && wordNum(tokens[j + 2]) != null) { v += wordNum(tokens[j + 2]); j += 2; continue; }
        break;
      }
      out.push({ i, end: j, v }); i = j;
    }
    return out;
  }
  function findMentions(tokens, entities, keyFn) {
    // entities: [{id, keys:[normalized token arrays]}]; returns [{id, i, end}]
    const res = [];
    entities.forEach(e => e.keys.forEach(k => {
      for (let i = 0; i + k.length <= tokens.length; i++) {
        let ok = true; for (let j = 0; j < k.length; j++) if (strip(tokens[i + j]) !== strip(k[j])) { ok = false; break; }
        if (ok) res.push({ id: e.id, i, end: i + k.length - 1, len: k.length });
      }
    }));
    // longest wins, no overlaps
    res.sort((a, b) => b.len - a.len || a.i - b.i);
    const used = new Set(), out = [];
    res.forEach(m => { for (let x = m.i; x <= m.end; x++) if (used.has(x)) return; for (let x = m.i; x <= m.end; x++) used.add(x); out.push(m); });
    return out.sort((a, b) => a.i - b.i);
  }
  const GENERIC = new Set(['مطعم', 'مطاعم', 'كافتيريا', 'كافيه', 'مطبخ', 'محل', 'محلات', 'تجريبي', 'بيت']);
  function restaurantKeys(name) {
    const t = norm(name.replace(/\(.*?\)/g, '')).split(' ').filter(Boolean);
    const core = t.filter(w => !GENERIC.has(strip(w)) && !GENERIC.has(w));
    const keys = [t];
    if (core.length && core.length < t.length) keys.push(core);
    if (t.includes('بيت') && core.length) keys.push(['بيت', ...core]);
    return keys.filter(k => k.length);
  }
  const PRODUCT_ALIASES = { 'ورق عنب': [['ورق', 'عنب'], ['ورق', 'العنب'], ['يبرق'], ['دوالي'], ['ورق']], 'ملفوف': [['ملفوف'], ['ملفوفه'], ['محشي', 'ملفوف'], ['كرنب']], 'كوسا': [['كوسا'], ['كوسه'], ['كوسي']] };
  function productKeys(name) {
    const n = norm(name); const keys = [n.split(' ')];
    Object.entries(PRODUCT_ALIASES).forEach(([k, al]) => { if (n.replace(/^ال/, '').includes(k) || n.includes(k)) keys.push(...al); });
    return keys;
  }
  function parse(text, products, restaurants, today) {
    const tokens = norm(text).split(' ').filter(Boolean);
    let date = null;
    tokens.forEach((t, i) => {
      if (/^(بكره|بكرا|بكرة|غدا|الغد|بكير)$/.test(t)) date = 1;
      else if (/^(اليوم|هلق|هلا)$/.test(t)) date = 0;
      else if (t === 'بعد' && /^(بكره|بكرا|غدا)$/.test(tokens[i + 1] || '')) date = 2;
    });
    const rM = findMentions(tokens, restaurants.map(r => ({ id: r.id, keys: restaurantKeys(r.name) })));
    const pM = findMentions(tokens, products.map(p => ({ id: p.id, keys: productKeys(p.name) })));
    const nums = numbers(tokens).filter(n => !rM.some(m => n.i >= m.i && n.i <= m.end));
    // segments by restaurant mention
    const segs = rM.length ? rM.map((m, k) => ({ restaurant_id: m.id, from: k === 0 ? 0 : m.i, to: k + 1 < rM.length ? rM[k + 1].i - 1 : tokens.length - 1 })) : [{ restaurant_id: null, from: 0, to: tokens.length - 1 }];
    const usedNum = new Set();
    const drafts = segs.map(seg => {
      const items = {}, units = {};
      const ps = pM.filter(p => p.i >= seg.from && p.i <= seg.to);
      ps.forEach((p, k) => {
        const prevEnd = k > 0 ? ps[k - 1].end : seg.from - 1, nextStart = k + 1 < ps.length ? ps[k + 1].i : seg.to + 1;
        const cands = nums.filter(n => !usedNum.has(n.i));
        // before: closest number between prev product and this one (e.g. "20 كيلو ورق عنب")
        const before = cands.filter(n => n.end < p.i && n.i > prevEnd && p.i - n.end <= 3).pop();
        const after = cands.find(n => n.i > p.end && n.i < nextStart && n.i - p.end <= 3);
        // prefer "before" when the number directly precedes (optionally with a unit word) the product
        let pick = null;
        if (before && (p.i - before.end === 1 || (p.i - before.end === 2 && UNIT_W.test(tokens[before.end + 1])))) pick = before;
        else pick = after || before;
        if (pick) {
          usedNum.add(pick.i); items[p.id] = (items[p.id] || 0) + pick.v;
          // وحدة منطوقة بجانب الرقم (الافتراضي: حبة)
          const near = [tokens[pick.end + 1], pick === before ? null : tokens[pick.i - 1]].filter(Boolean);
          if (near.some(w => KILO_W.test(w))) units[p.id] = 'كغ';
        } else items[p.id] = items[p.id] || 0;
      });
      return { restaurant_id: seg.restaurant_id, items, units, matched: ps.length > 0 };
    }).filter(d => d.restaurant_id || d.matched);
    return { date_offset: date, drafts, tokens };
  }
  g.OrderParser = { parse, norm };
  if (typeof module !== 'undefined') module.exports = g.OrderParser;
})(typeof window !== 'undefined' ? window : globalThis);
