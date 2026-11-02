const app = $('#app');
let S = null, qty = {};
async function start() {
  const me = await api('/api/me');
  if (!me.restaurant_ordering) { app.innerHTML = '<div class="card center" style="font-size:21px">الطلب من صفحة المطعم غير مفعّل حالياً.<br>تواصل مع المعمل مباشرة 📞</div>'; return; }
  if (me.role !== 'restaurant') return loginView();
  $('#logout').style.display = ''; $('#logout').onclick = async () => { await api('/api/logout', {}); location.reload(); };
  load();
}
async function loginView() {
  const list = await api('/api/restaurants/public');
  app.innerHTML = `<div class="card"><h2>دخول المطعم</h2>
  <label>اسم المطعم</label><select id="rid"><option value="">— اختر —</option>${list.map(r => `<option value="${r.id}">${esc(r.name)}</option>`).join('')}</select>
  <label>الرقم السري (من المعمل)</label><input id="pin" type="password" inputmode="numeric" autocomplete="current-password">
  <div style="height:14px"></div><button class="btn block" id="go">دخول</button></div>`;
  $('#go').onclick = async () => { try { await api('/api/restaurant/login', { restaurant_id: $('#rid').value, pin: $('#pin').value }); location.reload(); } catch (e) { toast(e.message); } };
}
async function load() {
  S = await api('/api/r/state');
  $('#title').textContent = S.restaurant.name;
  qty = {}; (S.current ? S.current.items : []).forEach(i => qty[i.product_id] = i.qty);
  render();
}
function render() {
  const cur = S.current;
  const locked = cur && cur.status !== 'new';
  app.innerHTML = `
  <div class="card"><div class="mut">الطلب لتوصيل يوم</div><div style="font-size:24px;font-weight:800">${fmtDate(S.delivery_date)}</div>
   <div class="mut">آخر موعد للطلب الساعة ${esc(S.cutoff_time)} (بتوقيت السعودية) في اليوم السابق</div>
   ${cur ? `<div style="margin-top:8px">حالة الطلب: <span class="badge st-${cur.status}">${STATUS[cur.status]}</span></div>` : ''}</div>
  ${S.last && !locked ? `<button class="btn block sec" id="repeat">🔁 نفس الطلبية السابقة (${fmtDate(S.last.delivery_date)})</button><div style="height:12px"></div>` : ''}
  ${S.products.map(p => `<div class="card"><div style="font-size:22px;font-weight:800">${esc(p.name)}</div><div class="mut">${p.price ? sar(p.price) + ' / ' + esc(p.unit) : esc(p.unit)}</div>
     ${qtyBox(`data-p="${p.id}"`, qty[p.id], p.unit, locked)}</div>`).join('')}
  <div class="card"><label>ملاحظة (اختياري)</label><input id="note" value="${esc(cur ? cur.note : '')}" ${locked ? 'disabled' : ''}></div>
  ${locked ? `<div class="card center">الطلب قيد التحضير، للتعديل تواصل مع المعمل</div>` : `<button class="btn block" id="save">✅ ${cur ? 'حفظ التعديل' : 'إرسال الطلب'}</button>`}
  <h2>طلباتي الأخيرة</h2>
  ${S.recent.map(o => `<div class="card"><div class="row"><b>${fmtDate(o.delivery_date)}</b><span style="flex:0 0 auto" class="badge st-${o.status}">${STATUS[o.status]}</span></div>
     <div class="mut">${o.items.map(i => `${esc(i.name)}: ${num(i.qty)} ${esc(i.unit)}`).join(' • ')}</div></div>`).join('') || '<p class="mut">لا يوجد طلبات بعد</p>'}`;
  app.querySelectorAll('.qty button').forEach(b => b.onclick = () => { const p = b.dataset.p; qty[p] = Math.max(0, (Number(qty[p]) || 0) + Number(b.dataset.d)); $(`input[data-p="${p}"]`).value = qty[p]; });
  app.querySelectorAll('.qty input').forEach(i => i.oninput = () => qty[i.dataset.p] = Number(i.value.replace(/[,،\s]/g, '').replace(/[٠-٩]/g, x => '٠١٢٣٤٥٦٧٨٩'.indexOf(x))) || 0);
  const rep = $('#repeat'); if (rep) rep.onclick = () => { qty = {}; S.last.items.forEach(i => qty[i.product_id] = i.qty); app.querySelectorAll('.qty input').forEach(i => i.value = qty[i.dataset.p] || 0); toast('تم نسخ الطلبية السابقة، اضغط إرسال'); };
  const sv = $('#save'); if (sv) sv.onclick = async () => {
    const items = Object.entries(qty).map(([product_id, q]) => ({ product_id, qty: q })).filter(i => i.qty > 0);
    if (!items.length && !cur) return toast('اختر كمية لصنف واحد على الأقل');
    try { await api('/api/r/order', { delivery_date: S.delivery_date, items, note: $('#note').value }); toast('تم إرسال الطلب ✅'); load(); } catch (e) { toast(e.message); if (e.status === 401) location.reload(); }
  };
}
start().catch(e => app.innerHTML = `<div class="card">${esc(e.message)}</div>`);
