// CampusGuard UI (phone app + Windows window). Engine: C++ via cg_exec (desktop) or engine.js (phone, offline).
(function () {
  const $ = id => document.getElementById(id);
  const KIND = ['room', 'hall', 'exit', 'center'];
  let MAP = null, ST = { blocked: [], blockedEdges: [], cutoff: [], unaccounted: [], queue: 0 }, floor = 1, sel = null, route = null, edgeFrom = null, lastKind = null, JS = null, layers = 1 | 4 | 8;
  const idIdx = {};
  const TITLE = { exit: 'Nearest fire exit', center: 'Route to the Oval (assembly point)', alarm: 'Nearest Fire Alarm Call Point', extinguisher: 'Nearest fire extinguisher', hose: 'Nearest fire hose', refuge: 'Nearest Safe Refuge' };
  async function cg(cmd) {
    try {
      if (typeof window.cg_exec === 'function') { const r = await window.cg_exec(cmd); return typeof r === 'string' ? JSON.parse(r) : r; }   // C++ engine inside the desktop window
      if (typeof window.CampusEngine === 'function') { if (!JS) JS = new window.CampusEngine(); return JSON.parse(JS.exec(cmd)); }             // offline JS engine (phone)
    } catch (e) { return { ok: false, msg: String(e) }; }
    return { ok: false, msg: 'Engine not available' };
  }
  let tt;
  function toast(m) { const t = $('toast'); t.textContent = m; t.classList.add('show'); clearTimeout(tt); tt = setTimeout(() => t.classList.remove('show'), 2800); }
  const node = id => MAP.nodes[idIdx[id]];
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  function drawFloorPlan(inView) {
    if (floor === 0) {
      return `<text class="map-caption" x="50" y="12" text-anchor="middle">CAMPUS ROUTE TO THE TRACK OVAL</text>
        <path class="corridor-fill" d="M4 57 L60 45 L80 70 L92 90"/>
        <path class="corridor-center" d="M4 57 L60 45 L80 70 L92 90"/>
        <ellipse class="oval-mark" cx="91" cy="89" rx="9" ry="6"/>
        <ellipse class="oval-inner" cx="91" cy="89" rx="5.5" ry="3"/>
        <text class="room-label" x="91" y="89.8">MCL OVAL</text>`;
    }

    if (floor === 5) {
      return `<rect class="building-outline" x="3" y="3" width="94" height="92" rx="3"/>
        <text class="map-caption" x="50" y="9" text-anchor="middle">5F · LOOP CORRIDOR</text>
        <path class="corridor-fill" d="M8 50 L32 30 L60 32 L60 50 L60 68 L32 68 L8 50 M60 32 L60 22 L72 12 L84 6"/>
        <path class="corridor-center" d="M8 50 L32 30 L60 32 L60 50 L60 68 L32 68 L8 50 M60 32 L60 22 L72 12 L84 6"/>
        <rect class="auditorium" x="18" y="37" width="30" height="25" rx="1"/>
        <text class="auditorium-label" x="33" y="50">AUDITORIUM</text>
        ${[...inView].map(i => {
          const n = MAP.nodes[i];
          if (!n || n.k !== 0 || !/^R50[123]$/.test(n.id)) return '';
          return `<rect class="room-tile" data-i="${i}" x="${n.x - 5}" y="${n.y - 7}" width="10" height="14" rx="1"/>`;
        }).join('')}`;
    }

    const rooms = [...inView].map(i => {
      const n = MAP.nodes[i];
      if (!n || n.k !== 0) return '';
      return `<rect class="room-tile" data-i="${i}" x="${n.x - 4.2}" y="${n.y - 8}" width="8.4" height="16" rx=".8"/>`;
    }).join('');

    return `<rect class="building-outline" x="3" y="4" width="94" height="91" rx="3"/>
      <text class="map-caption" x="50" y="10" text-anchor="middle">${floor}F · MAIN HALL AND NORTH-EAST WING</text>
      <path class="corridor-fill" d="M6 60 H94 M62 60 L62 38 L74 24 L86 10"/>
      <path class="corridor-center" d="M6 60 H94 M62 60 L62 38 L74 24 L86 10"/>
      ${rooms}`;
  }

  function render() {
    const inView = new Set();
    MAP.nodes.forEach((n, i) => { if (n && (floor === 0 ? (n.f === 0 || n.k === 2) : n.f === floor)) inView.add(i); });
    const blocked = new Set(ST.blocked), cut = new Set(ST.cutoff), onRoute = new Set(route && route.ok ? route.path : []);
    let s = drawFloorPlan(inView);
    MAP.edges.forEach(([a, b, , bl]) => {
      if (!inView.has(a) || !inView.has(b)) return;
      const A = MAP.nodes[a], B = MAP.nodes[b];
      s += `<line class="edge${bl ? ' bl' : ''}" x1="${A.x}" y1="${A.y}" x2="${B.x}" y2="${B.y}"/>`;
    });
    if (route && route.ok) for (let k = 0; k + 1 < route.path.length; k++) {
      const a = idIdx[route.path[k]], b = idIdx[route.path[k + 1]];
      if (inView.has(a) && inView.has(b)) {
        const A = MAP.nodes[a], B = MAP.nodes[b]; s += `<line class="route" x1="${A.x}" y1="${A.y}" x2="${B.x}" y2="${B.y}"/>`;
        const dx = B.x - A.x, dy = B.y - A.y, L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L, mx = (A.x + B.x) / 2, my = (A.y + B.y) / 2;
        s += `<polygon class="arrow" points="${mx + ux * 1.8},${my + uy * 1.8} ${mx - ux * 1.1 - uy * 1.3},${my - uy * 1.1 + ux * 1.3} ${mx - ux * 1.1 + uy * 1.3},${my - uy * 1.1 - ux * 1.3}"/>`;
      }
    }
    inView.forEach(i => {
      const n = MAP.nodes[i];
      const cls = ['n', KIND[n.k], blocked.has(n.id) ? 'blk' : '', cut.has(n.id) ? 'cut' : '', onRoute.has(n.id) ? 'onr' : '', sel === i ? 'sel' : ''].join(' ');
      if (n.t & 16) s += `<circle class="fxr" cx="${n.x}" cy="${n.y}" r="3.5"/>`;
      const bd = [[1, '#d42f2f', '!', 'rect'], [2, '#b3261e', 'E', 'dot'], [4, '#8a4b2a', 'H', 'rect'], [8, '#1f6feb', '\u267F', 'rect']].filter(x => (n.t & x[0]) && (layers & x[0]));
      bd.forEach((x, k) => { const bx = n.x + (k - (bd.length - 1) / 2) * 5.2, by = n.y - 8;
        s += x[3] === 'dot' ? `<circle class="bg" cx="${bx}" cy="${by}" r="2.5" fill="${x[1]}"/>` : `<rect class="bg" x="${bx - 2.4}" y="${by - 2.4}" width="4.8" height="4.8" rx=".9" fill="${x[1]}"/>`;
        s += `<text class="bgt" x="${bx}" y="${by + 1.2}">${x[2]}</text>`; });
      const labelY = n.k === 0 ? n.y + 5 : (n.k === 2 ? (n.y > 50 ? n.y - 4.5 : n.y + 4.5) : n.y + 4.5);
      s += `<g data-i="${i}"><circle class="${cls}" cx="${n.x}" cy="${n.y}" r="2.5"><title>${esc(n.name)}</title></circle><text class="nl" x="${n.x}" y="${labelY}">${esc(n.id)}</text></g>`;
    });
    $('map').innerHTML = s;
    document.querySelectorAll('#floors button').forEach(b => b.classList.toggle('on', +b.dataset.f === floor));
  }
  function buildFloorTabs() {
    $('floors').innerHTML = [1, 2, 3, 4, 5].map(f => `<button data-f="${f}">${f}F</button>`).join('') + `<button data-f="0">Outside</button>`;
    $('floors').onclick = e => { const b = e.target.closest('button'); if (b) { floor = +b.dataset.f; render(); } };
  }
  function updateSel() {
    const has = sel !== null, n = has ? MAP.nodes[sel] : null;
    $('selInfo').innerHTML = has ? `<b>${esc(n.name)}</b> <span class="muted">(${esc(n.id)}, ${n.f === 0 ? 'outdoors' : 'floor ' + n.f})</span>` : 'Nothing selected';
    $('sosLoc').textContent = has ? 'Your location: ' + n.name + ' (' + n.id + ')' : 'Pick your location on the map first.';
    ['bExit', 'bOval', 'bHaz', 'bEdge', 'bSos', 'fAlarm', 'fExt', 'fHose', 'fRef'].forEach(id => $(id).disabled = !has);
  }
  async function pick(i) {
    if (edgeFrom !== null) {
      const a = MAP.nodes[edgeFrom].id, b = MAP.nodes[i].id; edgeFrom = null; $('hint').textContent = '';
      const r = await cg(`hazard ${a} ${b}`); toast(r.ok === false ? r.msg : `Hallway ${a}-${b} toggled`);
      return refreshAll();
    }
    sel = i; updateSel(); render();
  }
  function showRoute(r) {
    route = r && r.ok ? r : null;
    if (!route) { $('routeCard').innerHTML = `<div class="card"><b>No route.</b> ${esc((r && r.msg) || '')}</div>`; render(); return; }
    const steps = route.path.map((id, k) => { const n = node(id); return `<li>${esc(route.names[k])}<span class="fl">${n.f === 0 ? 'outside' : 'F' + n.f}</span></li>`; }).join('');
    const detail = (lastKind === 'exit' || lastKind === 'center') ? `${route.steps} steps &bull; to exit ${route.toExit} m (${esc(route.exit)})` + (route.toOval ? ` &bull; exit &rarr; Oval ${route.toOval} m` : '') : `${route.steps} steps`;
    $('routeCard').innerHTML = `<div class="card"><div class="muted">${esc(TITLE[lastKind] || 'Route')}</div><div class="big">${route.meters} m</div><div class="muted">${detail}</div><ol class="steps">${steps}</ol></div>`;
    const start = node(route.path[0]); if (start && start.f !== floor && start.f > 0) floor = start.f;
    render();
  }
  async function go(kind) { lastKind = kind; showRoute(await cg(`find ${MAP.nodes[sel].id} ${kind}`)); }

  async function loadMap() { MAP = await cg('map'); Object.keys(idIdx).forEach(k => delete idIdx[k]); MAP.nodes.forEach((n, i) => { if (n) idIdx[n.id] = i; }); }
  async function loadStatus() {
    ST = await cg('status'); const nb = ST.blocked.length + ST.blockedEdges.length;
    let h = `<span class="chip ${nb ? 'bad' : 'ok'}">Blocked: ${nb}</span><span class="chip ${ST.cutoff.length ? 'warn' : 'ok'}">Cut off: ${ST.cutoff.length}</span>` +
            `<span class="chip">SOS queue: ${ST.queue}</span><span class="chip ${ST.unaccounted.length ? 'warn' : 'ok'}">Unaccounted: ${ST.unaccounted.length}</span>`;
    if (ST.blocked.length) h += `<div class="muted">Blocked places: ${ST.blocked.map(esc).join(', ')}</div>`;
    if (ST.blockedEdges.length) h += `<div class="muted">Blocked hallways: ${ST.blockedEdges.map(e => esc(e[0] + '-' + e[1])).join(', ')}</div>`;
    if (ST.cutoff.length) h += `<div class="muted">Cut off from every exit: ${ST.cutoff.map(esc).join(', ')}</div>`;
    if (ST.unaccounted.length) h += `<div class="muted">Not yet checked in: ${ST.unaccounted.map(esc).join(', ')}</div>`;
    $('chips').innerHTML = h;
  }
  async function loadOval() {
    const rows = await cg('oval');
    $('ovalTable').innerHTML = '<table><tr><th>Floor</th><th>Via</th><th>To exit</th><th>Exit &rarr; Oval</th><th>Total</th></tr>' +
      rows.map(r => r.meters < 0 ? `<tr><td>${r.floor}F</td><td colspan="4">Cut off</td></tr>` :
        `<tr><td>${r.floor}F</td><td>${esc(r.exit)}</td><td>${r.toExit} m</td><td>${r.toOval} m</td><td><b>~${r.approx} m</b></td></tr>`).join('') + '</table>';
  }
  async function loadTree() {
    const t = await cg('tree'), ul = n => `<li>${esc(n.n)}${n.c.length ? '<ul>' + n.c.map(ul).join('') + '</ul>' : ''}</li>`;
    $('tree').innerHTML = '<ul class="tree">' + ul(t) + '</ul>';
  }
  async function loadContacts() {
    const r = await cg('contacts'), tel = n => n.split(' / ').map(p => /\d{7,}/.test(p.replace(/\D/g, '')) && !/local/i.test(p) ? `<a href="tel:${p.replace(/[^\d+]/g, '')}">${esc(p)}</a>` : esc(p)).join(' / ');
    $('contacts').innerHTML = '<div class="card">' + r.contacts.map(c => `<div class="contact"><span>${esc(c.name)}</span><span>${tel(c.number)}</span></div>`).join('') + '</div>' +
      '<div class="card"><b>Tell the responder</b><ul class="tips">' + r.relay.map(x => `<li>${esc(x)}</li>`).join('') + '</ul></div>' +
      '<div class="card"><b>In the event of a fire</b><ul class="tips">' + r.fire.map(x => `<li>${esc(x)}</li>`).join('') + '</ul></div>';
  }
  async function refreshAll() {
    await loadMap(); await loadStatus(); await loadOval();
    if (sel !== null && !MAP.nodes[sel]) sel = null;
    if (sel !== null && route && lastKind) await go(lastKind);
    updateSel(); render();
  }

  function wire() {
    $('map').onclick = e => { const g = e.target.closest('[data-i]'); if (g) pick(+g.dataset.i); };
    document.querySelectorAll('.tabs button').forEach(b => b.onclick = () => {
      document.querySelectorAll('.tabs button').forEach(x => x.classList.toggle('on', x === b));
      ['route', 'sos', 'status'].forEach(t => $('p-' + t).hidden = (t !== b.dataset.tab));
      if (b.dataset.tab === 'status') { loadStatus(); loadTree(); }
    });
    $('bExit').onclick = () => go('exit');
    $('bOval').onclick = () => go('center');
    $('fAlarm').onclick = () => go('alarm'); $('fExt').onclick = () => go('extinguisher'); $('fHose').onclick = () => go('hose'); $('fRef').onclick = () => go('refuge');
    document.querySelectorAll('[data-layer]').forEach(cb => cb.onchange = () => { const v = +cb.dataset.layer; layers = cb.checked ? (layers | v) : (layers & ~v); render(); });
    $('bHaz').onclick = async () => { const id = MAP.nodes[sel].id, r = await cg('hazard ' + id); if (r.ok === false) return toast(r.msg);
      toast(r.blocked.includes(id) ? 'Place blocked' : 'Place reopened'); refreshAll(); };
    $('bEdge').onclick = () => { edgeFrom = sel; $('hint').textContent = 'Now tap the connected place to block/unblock the hallway between them.'; };
    $('bUndo').onclick = async () => { const r = await cg('undo'); toast(r.ok === false ? r.msg : 'Last hazard undone'); refreshAll(); };
    $('bSos').onclick = async () => {
      const u = $('uid').value.trim() || 'U1', nm = ($('uname').value.trim() || 'Student').replace(/\s+/g, '_');
      const r = await cg(`sos ${u} ${nm} ${MAP.nodes[sel].id} ${$('ukind').value}`);
      if (r.ok === false) return toast(r.msg);
      lastKind = 'center'; toast(`SOS #${r.ticket} sent (queue ${r.queue})`);
      $('sosOut').innerHTML = `<div class="card"><b>SOS #${r.ticket} is in the dispatch queue.</b><div class="muted">Follow the green route to the Oval, then tap “I am here”.</div></div>`;
      showRoute(r.route); loadStatus().then(render);
    };
    $('bNext').onclick = async () => { const r = await cg('next'); if (r.ok === false) return toast(r.msg);
      $('sosOut').innerHTML = `<div class="card"><b>Dispatching ticket #${r.ticket}</b><div>${esc(r.user)} at ${esc(r.at)} &mdash; ${esc(r.kind)}</div></div>`; loadStatus(); };
    $('bCheck').onclick = async () => {
      const u = $('uid').value.trim() || 'U1', nm = ($('uname').value.trim() || 'Student').replace(/\s+/g, '_');
      let r = await cg('checkin ' + u);
      if (r.ok === false) { await cg(`register ${u} ${nm} OVAL`); r = await cg('checkin ' + u); }
      toast(r.ok === false ? r.msg : 'Checked in - you are accounted for'); loadStatus();
    };
    $('bReport').onclick = async () => {
      const r = await cg('report'), cell = (k, v) => `<div>${k}<b>${v}</b></div>`;
      $('reportOut').innerHTML = '<div class="grid">' + cell('SOS total', r.sosTotal) + cell('Handled', r.handled) + cell('Pending', r.pending) + cell('People', r.people) +
        cell('Checked in', r.checkedIn) + cell('Unaccounted', r.unaccounted) + cell('Hazard events', r.hazardEvents) + '</div>';
    };
  }
  async function init() {
    for (let i = 0; i < 50 && !(typeof window.cg_exec === 'function' || typeof window.CampusEngine === 'function'); i++) await new Promise(r => setTimeout(r, 100));
    buildFloorTabs(); wire(); await refreshAll(); loadContacts();
    if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) navigator.serviceWorker.register('sw.js').catch(() => {});   // offline support
  }
  init();
})();
