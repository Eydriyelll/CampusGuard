// CampusGuard UI (phone app + Windows window). Engine: C++ via cg_exec (desktop) or engine.js (phone, offline).
(function () {
  const $ = id => document.getElementById(id);
  const KIND = ['room', 'hall', 'exit', 'center'];
  let MAP = null, ST = { blocked: [], blockedEdges: [], crowded: [], cutoff: [], unaccounted: [], queue: 0, emergency: false }, floor = 1, sel = null, route = null, edgeFrom = null, lastKind = null, JS = null, layers = 1 | 4 | 8, searchTimer = null, dismissedEmergency = false, swRegistration = null, compatibilitySimulation = null;
  const idIdx = {};
  const TITLE = { exit: 'Nearest available fire exit', center: 'Route to the Oval (assembly point)', alarm: 'Nearest Fire Alarm Call Point', extinguisher: 'Nearest fire extinguisher', hose: 'Nearest fire hose', refuge: 'Nearest Safe Refuge' };
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
  function activateTab(tab) {
    document.querySelectorAll('.tabs button').forEach(button => button.classList.toggle('on', button.dataset.tab === tab));
    ['route', 'sos', 'status'].forEach(name => $('p-' + name).hidden = name !== tab);
  }

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
    const blocked = new Set(ST.blocked), crowded = new Set(ST.crowded || []), cut = new Set(ST.cutoff), onRoute = new Set(route && route.ok ? route.path : []);
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
    if (route && route.ok) for (let k = 0; k + 1 < route.path.length; k++) {
      const currentIndex = idIdx[route.path[k]], nextIndex = idIdx[route.path[k + 1]];
      if (currentIndex === undefined || nextIndex === undefined) continue;
      const current = MAP.nodes[currentIndex], next = MAP.nodes[nextIndex];
      if (current.f !== floor || next.f === floor) continue;
      const direction = next.f > current.f ? '\u2191' : '\u2193';
      const x = current.x >= 75 ? current.x - 9 : current.x + 2;
      const y = current.y - 7;
      s += `<g class="route-transfer" aria-label="Continue to floor ${next.f}">
        <title>Continue to floor ${next.f}</title>
        <line class="route route-transfer-line" x1="${current.x}" y1="${current.y}" x2="${x + 3.5}" y2="${y + 2.25}"/>
        <rect class="route-transfer-badge" x="${x}" y="${y}" width="7" height="4.5" rx="1.2"/>
        <text class="route-transfer-label" x="${x + 3.5}" y="${y + 3.15}" text-anchor="middle">${direction} F${next.f}</text>
      </g>`;
    }
    inView.forEach(i => {
      const n = MAP.nodes[i];
      const cls = ['n', KIND[n.k], blocked.has(n.id) ? 'blk' : '', crowded.has(n.id) ? 'crowded' : '', cut.has(n.id) ? 'cut' : '', onRoute.has(n.id) ? 'onr' : '', sel === i ? 'sel' : ''].join(' ');
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
    ['bRoute', 'bRanked', 'bCrowd', 'bHaz', 'bEdge', 'bSos', 'fAlarm', 'fExt', 'fHose', 'fRef'].forEach(id => $(id).disabled = !has);
    $('bCrowd').disabled = !has || (n.k !== 1 && n.k !== 2);
  }
  async function pick(i, remember = true) {
    if (edgeFrom !== null) {
      const a = MAP.nodes[edgeFrom].id, b = MAP.nodes[i].id; edgeFrom = null; $('hint').textContent = '';
      const r = await cg(`hazard ${a} ${b}`); toast(r.ok === false ? r.msg : `Hallway ${a}-${b} toggled`);
      return refreshAll();
    }
    sel = i; updateSel(); render();
    if (remember) {
      await cg('remember ' + MAP.nodes[i].id);
      await loadRecent();
    }
  }
  function showRoute(r) {
    route = r && r.ok ? r : null;
    if (!route) { $('routeCard').innerHTML = `<div class="card"><b>No route.</b> ${esc((r && r.msg) || '')}</div>`; render(); return; }
    const steps = route.path.map((id, k) => { const n = node(id); return `<li>${esc(route.names[k])}<span class="fl">${n.f === 0 ? 'outside' : 'F' + n.f}</span></li>`; }).join('');
    const preference = $('routeMode').value === 'distance' ? 'shortest estimated distance' : 'fewest hallway connections';
    const detail = (lastKind === 'exit' || lastKind === 'center') ? `${route.steps} steps &bull; to exit ${route.toExit} m (${esc(route.exit)})` + (route.toOval ? ` &bull; exit &rarr; Oval ${route.toOval} m` : '') : `${route.steps} steps`;
    $('routeCard').innerHTML = `<div class="card"><div class="muted">${esc(TITLE[lastKind] || 'Route')} · ${preference}</div><div class="big">${route.meters} m</div><div class="muted">${detail}</div><ol class="steps">${steps}</ol></div>`;
    const start = node(route.path[0]); if (start && start.f !== floor && start.f > 0) floor = start.f;
    render();
  }
  async function go(kind) {
    lastKind = kind;
    const mode = $('routeMode').value === 'distance' ? 'distance' : 'connections';
    showRoute(await cg(`find ${MAP.nodes[sel].id} ${kind} ${mode}`));
  }
  async function showNearestExit(locationId) {
    if (locationId && idIdx[locationId] !== undefined) {
      sel = idIdx[locationId];
      updateSel();
    }
    if (sel === null) {
      const defaultIndex = idIdx.F3CJ;
      if (defaultIndex === undefined) return toast('Select your room or hallway on the map first.');
      sel = defaultIndex;
      updateSel();
    }
    activateTab('route');
    $('routeTarget').value = 'exit';
    $('routeMode').value = 'distance';
    floor = MAP.nodes[sel].f || floor;
    await go('exit');
    $('p-route').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  function simulationIsActive() {
    return ST.emergency || compatibilitySimulation !== null;
  }
  function showEmergencyPopup() {
    const dialog = $('emergencyDialog');
    const fireAt = compatibilitySimulation ? compatibilitySimulation.fireAt : ST.fireAt;
    $('emergencyDialogMessage').textContent = `Simulated fire at ${node(fireAt)?.name || fireAt || 'an indoor location'}. Choose the nearest available safe exit.`;
    if (!dialog.open) {
      if (typeof dialog.showModal === 'function') dialog.showModal();
      else dialog.setAttribute('open', '');
    }
  }
  function closeEmergencyPopup() {
    const dialog = $('emergencyDialog');
    if (typeof dialog.close === 'function' && dialog.open) dialog.close();
    else dialog.removeAttribute('open');
  }
  async function beginLegacySimulation(fireAt) {
    const state = await cg('status');
    if (!state || state.ok === false) return state || { ok: false, msg: 'Could not load hazard status.' };
    const fireIndex = idIdx[fireAt];
    if (fireIndex === undefined) return { ok: false, msg: `Unknown simulated fire location: ${fireAt}` };

    if (!Array.isArray(state.blocked)) return { ok: false, msg: 'The current engine did not provide a blocked-location list; the demo was not started.' };
    const changed = [];
    let lastStatus = state;
    const fireFloor = MAP.nodes[fireIndex].f;
    const targets = [fireAt, `F${fireFloor}WS`, `F${fireFloor}ES`];
    for (const id of targets) {
      if (idIdx[id] === undefined || state.blocked.includes(id)) continue;
      const result = await cg('hazard ' + id);
      if (!result || result.ok === false) {
        const rollbackErrors = [];
        for (const changedId of [...changed].reverse()) {
          const rollback = await cg('hazard ' + changedId);
          if (!rollback || rollback.ok === false) rollbackErrors.push(changedId);
        }
        if (rollbackErrors.length) {
          return { ok: false, msg: `${result?.msg || `Could not mark ${id} for the demo.`} Rollback also failed for: ${rollbackErrors.join(', ')}.` };
        }
        return result || { ok: false, msg: `Could not mark ${id} for the demo.` };
      }
      changed.push(id);
      lastStatus = result;
    }

    compatibilitySimulation = { fireAt, changed, crowded: changed.filter(id => id !== fireAt) };
    return lastStatus;
  }
  async function endLegacySimulation() {
    const state = await cg('status');
    if (!state || state.ok === false) return state || { ok: false, msg: 'Could not load hazard status.' };
    if (!Array.isArray(state.blocked)) return { ok: false, msg: 'The current engine did not provide a blocked-location list; the demo remains active.' };
    for (const id of [...compatibilitySimulation.changed].reverse()) {
      if (!state.blocked.includes(id)) continue;
      const result = await cg('hazard ' + id);
      if (!result || result.ok === false) return result || { ok: false, msg: `Could not restore ${id}.` };
    }
    compatibilitySimulation = null;
    return cg('status');
  }
  async function toggleFireSimulation(fireAt) {
    if (compatibilitySimulation) return endLegacySimulation();

    const command = simulationIsActive() ? 'simulatefire' : `simulatefire ${fireAt}`;
    const result = await cg(command);
    if (result && result.ok !== false) return result;
    if (!result || !/unknown command/i.test(result.msg || '')) return result;
    return simulationIsActive() ? result : beginLegacySimulation(fireAt);
  }
  async function resumeDemoAndRoute(locationId, fireAt) {
    if (fireAt && !simulationIsActive()) {
      const result = await toggleFireSimulation(fireAt);
      if (result.ok === false) return toast(result.msg);
      dismissedEmergency = false;
      await refreshAll();
      showEmergencyPopup();
    }
    await showNearestExit(locationId);
  }
  function syncEmergencyAlert() {
    const emergencyActive = simulationIsActive();
    const fireAt = compatibilitySimulation ? compatibilitySimulation.fireAt : ST.fireAt;
    $('emergencyAlert').hidden = !emergencyActive || dismissedEmergency;
    $('bSimulate').textContent = emergencyActive ? 'End simulation' : 'Simulate fire';
    if (!emergencyActive) closeEmergencyPopup();
    if (emergencyActive) {
      const fireNode = node(fireAt);
      const crowded = (ST.crowded || []).map(id => node(id)?.name).filter(Boolean);
      $('emergencyMessage').textContent = `Simulated fire at ${fireNode ? fireNode.name : fireAt}. ${crowded.length ? 'Crowded stairs are excluded from the route.' : ''}`;
    }
  }
  async function enableAlerts() {
    if (!('Notification' in window)) return toast('Browser notifications are unavailable; in-app demo alerts still work.');
    if (Notification.permission === 'granted') return toast('Emergency notifications are already enabled.');
    if (Notification.permission === 'denied') return toast('Notifications are blocked in browser settings; in-app alerts still work.');
    try {
      const permission = await Notification.requestPermission();
      toast(permission === 'granted' ? 'Emergency notifications enabled.' : 'Notification permission was not granted.');
    } catch (error) {
      toast(`Could not request notification permission: ${error.message || error}`);
    }
  }
  async function notifyEmergency(userLocationId, fireLocationId) {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    const options = {
      body: `Demo only. A simulated fire was reported at ${node(fireLocationId)?.name || fireLocationId}. Tap to find an exit from your selected location.`,
      tag: 'campusguard-demo-fire',
      data: { locationId: userLocationId, fireAt: fireLocationId }
    };
    try {
      if (swRegistration) {
        await swRegistration.showNotification('CampusGuard demo alert', options);
      } else {
        const notification = new Notification('CampusGuard demo alert', options);
        notification.onclick = () => {
          window.focus();
          resumeDemoAndRoute(userLocationId, fireLocationId);
          notification.close();
        };
      }
    } catch (error) {
      toast(`Could not show browser notification: ${error.message || error}`);
    }
  }
  function checkGps() {
    if (!navigator.geolocation) return toast('GPS is unavailable in this browser. Select your room or hallway on the map.');
    $('gpsStatus').textContent = 'Requesting a one-time GPS fix…';
    navigator.geolocation.getCurrentPosition(
      position => {
        $('gpsStatus').textContent = `GPS fix received (about ±${Math.round(position.coords.accuracy)} m). It cannot identify an indoor room; coordinates are not stored or shared. Select your room or hallway on the map.`;
      },
      error => {
        const reason = error.code === error.PERMISSION_DENIED ? 'Permission denied.' :
          error.code === error.POSITION_UNAVAILABLE ? 'Position unavailable.' : 'GPS request timed out.';
        $('gpsStatus').textContent = `${reason} Select your room or hallway on the map instead.`;
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
    );
  }

  async function loadMap() { MAP = await cg('map'); Object.keys(idIdx).forEach(k => delete idIdx[k]); MAP.nodes.forEach((n, i) => { if (n) idIdx[n.id] = i; }); }
  async function loadRecent() {
    const ids = await cg('recent');
    $('recentLocations').innerHTML = Array.isArray(ids) ? ids.filter(id => idIdx[id] !== undefined).map(id => {
      const n = node(id); return `<button class="btn" data-location="${esc(id)}">${esc(n.name)}</button>`;
    }).join('') : '';
  }
  async function loadSuggestions() {
    const query = $('locationSearch').value.trim().replace(/\s+/g, '_');
    if (!query) { $('locationSuggestions').innerHTML = ''; return; }
    const results = await cg('suggest ' + query);
    $('locationSuggestions').innerHTML = Array.isArray(results) ? results.map(item =>
      `<button class="btn" data-location="${esc(item.id)}">${esc(item.name)} <span class="muted">${esc(item.id)}</span></button>`
    ).join('') : '';
  }
  async function loadRanked() {
    if (sel === null) return;
    const results = await cg('ranked ' + MAP.nodes[sel].id);
    if (!Array.isArray(results)) { $('rankedRoutes').innerHTML = `<div class="card">${esc(results.msg || 'Could not compare routes.')}</div>`; return; }
    $('rankedRoutes').innerHTML = `<div class="card"><b>Routes by estimated walking distance</b><ul class="route-options">${
      results.map(item => `<li><span>${esc(node(item.id).name)}</span><b>${item.meters} m</b><button class="btn" data-destination="${esc(item.id)}">View route</button></li>`).join('')
    }</ul></div>`;
  }
  async function loadStatus() {
    const status = await cg('status');
    if (!status || status.ok === false) return toast(status?.msg || 'Could not load safety status.');
    ST = {
      ...status,
      blocked: status.blocked || [],
      blockedEdges: status.blockedEdges || [],
      crowded: status.crowded || [],
      cutoff: status.cutoff || [],
      unaccounted: status.unaccounted || [],
      emergency: status.emergency === true,
      fireAt: status.fireAt || null
    };
    if (compatibilitySimulation) {
      const fireFloor = MAP.nodes[idIdx[compatibilitySimulation.fireAt]].f;
      const simulatedCrowds = compatibilitySimulation.crowded;
      ST.emergency = true;
      ST.fireAt = compatibilitySimulation.fireAt;
      ST.crowded = [...new Set([...ST.crowded, ...simulatedCrowds])];
      ST.blocked = ST.blocked.filter(id => !simulatedCrowds.includes(id));
    }
    const nb = ST.blocked.length + ST.blockedEdges.length;
    let h = `<span class="chip ${nb ? 'bad' : 'ok'}">Blocked: ${nb}</span><span class="chip ${ST.cutoff.length ? 'warn' : 'ok'}">Cut off: ${ST.cutoff.length}</span>` +
            `<span class="chip ${(ST.crowded || []).length ? 'warn' : 'ok'}">Crowded: ${(ST.crowded || []).length}</span>` +
            `<span class="chip">SOS queue: ${ST.queue}</span><span class="chip ${ST.unaccounted.length ? 'warn' : 'ok'}">Unaccounted: ${ST.unaccounted.length}</span>`;
    if (ST.blocked.length) h += `<div class="muted">Blocked places: ${ST.blocked.map(esc).join(', ')}</div>`;
    if (ST.blockedEdges.length) h += `<div class="muted">Blocked hallways: ${ST.blockedEdges.map(e => esc(e[0] + '-' + e[1])).join(', ')}</div>`;
    if ((ST.crowded || []).length) h += `<div class="muted">Crowded routes: ${ST.crowded.map(esc).join(', ')}</div>`;
    if (ST.cutoff.length) h += `<div class="muted">Cut off from every exit: ${ST.cutoff.map(esc).join(', ')}</div>`;
    if (ST.unaccounted.length) h += `<div class="muted">Not yet checked in: ${ST.unaccounted.map(esc).join(', ')}</div>`;
    $('chips').innerHTML = h;
    syncEmergencyAlert();
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
    const previousRoute = route;
    await loadMap(); await loadStatus(); await loadOval();
    await loadRecent();
    if (sel !== null && !MAP.nodes[sel]) sel = null;
    if (sel !== null && route && lastKind) await go(lastKind);
    if (previousRoute?.ok && (lastKind === 'exit' || lastKind === 'center')) {
      if (route?.ok && previousRoute.exit && route.exit && previousRoute.exit !== route.exit) {
        toast(`Route updated: ${node(route.exit)?.name || route.exit} is now the safest available exit.`);
      } else if (!route) {
        toast('The previous route is no longer available. No safe route was found; stay put and request help.');
      }
    }
    updateSel(); render();
  }

  function wire() {
    $('map').onclick = e => { const g = e.target.closest('[data-i]'); if (g) pick(+g.dataset.i); };
    $('locationSearch').oninput = () => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(loadSuggestions, 140);
    };
    $('locationSearch').onkeydown = e => {
      if (e.key !== 'Enter') return;
      const first = $('locationSuggestions').querySelector('[data-location]');
      if (first) { e.preventDefault(); pick(idIdx[first.dataset.location]); }
    };
    $('locationSuggestions').onclick = e => {
      const button = e.target.closest('[data-location]');
      if (button) pick(idIdx[button.dataset.location]);
    };
    $('recentLocations').onclick = e => {
      const button = e.target.closest('[data-location]');
      if (button) pick(idIdx[button.dataset.location]);
    };
    $('rankedRoutes').onclick = async e => {
      const button = e.target.closest('[data-destination]');
      if (!button || sel === null) return;
      const result = await cg(`route ${MAP.nodes[sel].id} to ${button.dataset.destination}`);
      if (result.ok === false) return toast(result.msg);
      $('routeMode').value = 'distance';
      lastKind = node(button.dataset.destination).k === 3 ? 'center' : 'exit';
      showRoute(result);
    };
    $('bNextRecent').onclick = async () => {
      const result = await cg('nextrecent');
      if (result.ok === false) return toast(result.msg);
      const index = idIdx[result.id];
      if (index === undefined) return toast('That location is no longer available.');
      pick(index, false);
    };
    document.querySelectorAll('.tabs button').forEach(button => button.onclick = () => {
      activateTab(button.dataset.tab);
      if (button.dataset.tab === 'status') { loadStatus(); loadTree(); }
    });
    $('bRoute').onclick = () => go($('routeTarget').value);
    $('bRanked').onclick = loadRanked;
    $('routeMode').onchange = () => { if (sel !== null && lastKind) go(lastKind); };
    $('routeTarget').onchange = () => { if (sel !== null) go($('routeTarget').value); };
    $('bGps').onclick = checkGps;
    $('bEnableAlerts').onclick = enableAlerts;
    $('bNearestExit').onclick = () => showNearestExit();
    $('bDismissAlert').onclick = () => { dismissedEmergency = true; syncEmergencyAlert(); };
    $('bDialogNearestExit').onclick = async () => {
      closeEmergencyPopup();
      await showNearestExit();
    };
    $('bDialogDismiss').onclick = closeEmergencyPopup;
    $('bSimulate').onclick = async () => {
      const wasActive = simulationIsActive();
      const previousExit = route?.exit;
      if (!wasActive && sel === null) return toast('Choose your current room or hallway on the map first.');
      const fireAt = $('fireLocation').value;
      const userLocation = sel === null ? null : MAP.nodes[sel].id;
      const result = await toggleFireSimulation(fireAt);
      if (!result || result.ok === false) return toast(result?.msg || 'Could not change the fire simulation.');
      if (!wasActive) dismissedEmergency = false;
      await refreshAll();
      if (simulationIsActive() && !wasActive) {
        showEmergencyPopup();
        await notifyEmergency(userLocation, ST.fireAt);
      }
      if (previousExit && route?.exit && previousExit !== route.exit) {
        toast(`Route updated: ${node(route.exit)?.name || route.exit} is now the safest available exit.`);
      } else {
        toast(simulationIsActive() ? 'Demo fire alert is active.' : 'Fire simulation ended.');
      }
    };
    $('fAlarm').onclick = () => go('alarm'); $('fExt').onclick = () => go('extinguisher'); $('fHose').onclick = () => go('hose'); $('fRef').onclick = () => go('refuge');
    document.querySelectorAll('[data-layer]').forEach(cb => cb.onchange = () => { const v = +cb.dataset.layer; layers = cb.checked ? (layers | v) : (layers & ~v); render(); });
    $('bHaz').onclick = async () => { const id = MAP.nodes[sel].id, r = await cg('hazard ' + id); if (r.ok === false) return toast(r.msg);
      toast(r.blocked.includes(id) ? 'Place blocked' : 'Place reopened'); refreshAll(); };
    $('bCrowd').onclick = async () => {
      const id = MAP.nodes[sel].id, result = await cg('crowd ' + id);
      if (result.ok === false) return toast(result.msg);
      await refreshAll();
      toast(result.crowded.includes(id) ? 'Crowding reported; route finding will avoid this location.' : 'Crowding report cleared.');
    };
    $('bEdge').onclick = () => { edgeFrom = sel; $('hint').textContent = 'Now tap the connected place to block/unblock the hallway between them.'; };
    $('bUndo').onclick = async () => { const r = await cg('undo'); toast(r.ok === false ? r.msg : 'Last hazard undone'); refreshAll(); };
    $('bSos').onclick = async () => {
      const u = $('uid').value.trim() || 'U1', nm = ($('uname').value.trim() || 'Student').replace(/\s+/g, '_');
      const r = await cg(`sos ${u} ${nm} ${MAP.nodes[sel].id} ${$('ukind').value} ${$('routeMode').value}`);
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
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', event => {
        if (event.data?.type === 'nearest-exit') resumeDemoAndRoute(event.data.locationId, event.data.fireAt);
      });
    }
  }
  async function init() {
    for (let i = 0; i < 50 && !(typeof window.cg_exec === 'function' || typeof window.CampusEngine === 'function'); i++) await new Promise(r => setTimeout(r, 100));
    buildFloorTabs(); wire(); await refreshAll(); loadContacts();
    if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
      try {
        swRegistration = await navigator.serviceWorker.register('sw.js');
      } catch (error) {
        toast(`Background notifications unavailable: ${error.message || error}`);
      }
    }
    const params = new URLSearchParams(location.search);
    const nearestExit = params.get('nearestExit'), fireAt = params.get('fireAt');
    if (nearestExit) await resumeDemoAndRoute(nearestExit, fireAt);
  }
  init();
})();
