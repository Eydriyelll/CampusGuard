// CampusGuard engine - JavaScript mirror of core/include/Campus.hpp (+ Graph/Tree/Algorithms).
// Used by the phone app (works fully offline). The desktop apps use the C++ engine directly.
// exec("route R4E center") -> JSON string, same commands and same JSON as the C++ engine.
(function (root) {
  'use strict';
  const FLOORS = 5, SEG_CJ_CS = 8, SEG_CS_NW = 18, SEG_NW_NS = 14, ROOM_DOOR = 4;
  const STAIR_FLOOR = 12, DOOR = 6, OUT_E = 100, OUT_N = 120, OUT_W = 130, ROAD_TO_GATE = 120, GATE_TO_OVAL = 50;
  const ROOM = 0, HALL = 1, EXIT = 2, CENTER = 3;
  const TAG_FACP = 1, TAG_FE = 2, TAG_HOSE = 4, TAG_REFUGE = 8, TAG_FIREEXIT = 16;   // legend items (see Graph.hpp)

  class Graph {
    constructor() { this.nodes = []; this.adj = []; }
    addNode(id, name, kind, floor, x, y) { this.nodes.push({ id, name, kind, floor, x, y, blocked: false, active: true, tags: 0 }); this.adj.push([]); return this.nodes.length - 1; }
    addEdge(a, b, m) { this.adj[a].push({ to: b, meters: m, blocked: false }); this.adj[b].push({ to: a, meters: m, blocked: false }); }
    removeNode(i) { for (const e of this.adj[i]) this.adj[e.to] = this.adj[e.to].filter(x => x.to !== i); this.adj[i] = []; this.nodes[i].active = false; }
    meters(a, b) { for (const e of this.adj[a]) if (e.to === b) return e.meters; return 0; }
    hasEdge(a, b) { return this.adj[a].some(e => e.to === b); }
    edgeBlocked(a, b) { for (const e of this.adj[a]) if (e.to === b) return e.blocked; return false; }
    setEdgeBlocked(a, b, f) { let ok = false; for (const e of this.adj[a]) if (e.to === b) { e.blocked = f; ok = true; } for (const e of this.adj[b]) if (e.to === a) e.blocked = f; return ok; }
    // BFS: fewest connections; ties broken by meters. Blocked nodes AND edges skipped.
    bfs(s, goal) {
      const n = this.nodes.length, par = new Array(n).fill(-2), lvl = new Array(n).fill(0), dist = new Array(n).fill(0);
      const q = [s]; let h = 0, best = -1; par[s] = -1;
      while (h < q.length) {
        const u = q[h++];
        if (best !== -1 && lvl[u] > lvl[best]) break;
        if (goal(u)) { if (best === -1 || dist[u] < dist[best]) best = u; continue; }
        for (const e of this.adj[u]) {
          if (e.blocked || this.nodes[e.to].blocked || !this.nodes[e.to].active) continue;
          if (par[e.to] === -2) { par[e.to] = u; lvl[e.to] = lvl[u] + 1; dist[e.to] = dist[u] + e.meters; q.push(e.to); }
          else if (lvl[e.to] === lvl[u] + 1 && dist[u] + e.meters < dist[e.to]) { par[e.to] = u; dist[e.to] = dist[u] + e.meters; }
        }
      }
      if (best === -1) return [];
      const p = []; for (let v = best; v !== -1; v = par[v]) p.push(v); return p.reverse();
    }
    // DFS from every open exit; indoor rooms/halls never reached are CUT OFF.
    cutOff() {
      const seen = new Array(this.nodes.length).fill(false), st = [];
      this.nodes.forEach((n, i) => { if (n.active && n.kind === EXIT && !n.blocked) { seen[i] = true; st.push(i); } });
      while (st.length) { const u = st.pop(); for (const e of this.adj[u]) if (!seen[e.to] && !e.blocked && !this.nodes[e.to].blocked) { seen[e.to] = true; st.push(e.to); } }
      const out = [];
      this.nodes.forEach((n, i) => { if (n.active && n.floor >= 1 && !seen[i] && !n.blocked && (n.kind === ROOM || n.kind === HALL)) out.push(i); });
      return out;
    }
  }

  class TreeNode {
    constructor(l) { this.n = l; this.c = []; }
    add(l) { const k = new TreeNode(l); this.c.push(k); return k; }
    removeDeep(l) {
      const i = this.c.findIndex(k => k.n === l); if (i >= 0) { this.c.splice(i, 1); return true; }
      return this.c.some(k => k.removeDeep(l));
    }
  }

  class Campus {
    constructor() {
      this.g = new Graph(); this.root = new TreeNode('Campus'); this.floorNode = [];
      this.people = []; this.sosQ = []; this.hist = []; this.byId = new Map();
      this.ticket = 0; this.handled = 0; this.hazardEvents = 0;
      this.buildRizal(); this.rebuildIndex(); this.buildTree();
    }
    buildRizal() {
      const g = this.g, rd = (id, name, bay, north) => ({ id, name, bay, north });
      const R = [[],
        [...[1,2,3,4,5,6,7,8].map(k => rd('R1S' + k, 'Ground Rm S' + k, k, false)), ...[1,2,3,4].map(k => rd('R1N' + k, 'Ground Rm N' + k, k, true)), rd('R1N5', 'Ground Rm N5', 7, true)],
        [...[200,202,204,206,208,210,212,214].map((n, i) => rd('R' + n, 'Room ' + n, i + 1, false)), ...[201,203,205,207].map((n, i) => rd('R' + n, 'Room ' + n, i + 1, true)), rd('R209', 'Room 209', 7, true)],
        [...[300,302,304,306,308,310,312,314].map((n, i) => rd('R' + n, 'Room ' + n, i + 1, false)), ...[301,303,305,307].map((n, i) => rd('R' + n, 'Room ' + n, i + 1, true)), rd('CR3', 'Comfort Room (3F)', 5, true), rd('FAC3', 'Faculty Room', 7, true)],
        [...[400,402,404,406,408,410,412].map((n, i) => rd('R' + n, 'Room ' + n, i + 1, false)), rd('R401', 'Room 401', 1, true), rd('R403', 'Room 403', 2, true), rd('R405A', 'Room 405A', 3, true), rd('R405B', 'Room 405B', 4, true), rd('RC4', 'Research Center', 7, true)],
        []];
      const BAYS = [0, 8, 8, 8, 7, 0], J = 6, STAIRS = TAG_FACP | TAG_FE | TAG_HOSE | TAG_FIREEXIT;
      const X = [{ floor: 3, id: 'CLIR3', name: 'CLIR', link: 'NW', m: 8, dx: 12, dy: 8 }, { floor: 4, id: 'LAB4E', name: 'Lab (east)', link: 'NW', m: 8, dx: 12, dy: 10 }, { floor: 4, id: 'LAB4N', name: 'Lab (NE wing)', link: 'NS', m: 6, dx: -6, dy: 14 }];
      const WS = [], ES = [], CS = [], NW = [], NS = [];
      for (let f = 1; f <= FLOORS; f++) {
        const F = 'F' + f, L = F + ' ';
        const N = (id, nm, k, x, y, tags) => { const i = g.addNode(id, nm, k, f, x, y); g.nodes[i].tags = tags; return i; };
        if (f < FLOORS) {
          const n = BAYS[f], step = n === 8 ? 7 : 8, gap = 64.0 / (n - 1), bay = [0];
          for (let k = 1; k <= n; k++) bay[k] = k === J ? N(F + 'CJ', L + 'Central Junction', HALL, 16 + (k - 1) * gap, 60, 0) : N(F + 'C' + k, L + 'Corridor ' + k, HALL, 16 + (k - 1) * gap, 60, 0);
          WS[f] = N(F + 'WS', L + 'West Stairs', HALL, 6, 60, STAIRS); ES[f] = N(F + 'ES', L + 'East Stairs', HALL, 92, 60, STAIRS);
          const jx = 16 + (J - 1) * gap;
          CS[f] = N(F + 'CS', L + 'Core Stairs', HALL, jx, 38, STAIRS | (f === 1 ? TAG_REFUGE : 0));
          NW[f] = N(F + 'NW', f === 1 ? L + 'NE Wing Lobby' : L + 'NE Wing Hall', HALL, jx + 12, 24, TAG_FE);
          NS[f] = N(F + 'NS', L + 'NE Stairs', HALL, jx + 24, 10, TAG_FACP | TAG_FE | TAG_FIREEXIT);
          g.addEdge(WS[f], bay[1], 6); for (let k = 1; k < n; k++) g.addEdge(bay[k], bay[k + 1], step);
          g.addEdge(bay[n], ES[f], step); g.addEdge(bay[J], CS[f], SEG_CJ_CS); g.addEdge(CS[f], NW[f], SEG_CS_NW); g.addEdge(NW[f], NS[f], SEG_NW_NS);
          for (const d of R[f]) { const r = N(d.id, d.name, ROOM, 16 + (d.bay - 1) * gap, d.north ? 40 : 80, TAG_FE); g.addEdge(r, bay[d.bay], ROOM_DOOR); }
        } else {
          WS[f] = N(F + 'WS', L + 'West Stairs', HALL, 8, 50, STAIRS);
          const nc = N(F + 'NC', L + 'North Corridor', HALL, 32, 30, 0), cj = N(F + 'CJ', L + 'Central Junction', HALL, 60, 32, 0), sm = N(F + 'SM', L + 'East Corridor', HALL, 60, 50, 0),
                sj = N(F + 'SJ', L + 'South-East Corner', HALL, 60, 68, 0), sc = N(F + 'SC', L + 'South Corridor', HALL, 32, 68, 0);
          CS[f] = N(F + 'CS', L + 'Core Stairs', HALL, 60, 18, STAIRS); NW[f] = N(F + 'NW', L + 'NE Wing Hall', HALL, 72, 12, TAG_FE);
          NS[f] = N(F + 'NS', L + 'NE Stairs', HALL, 84, 6, TAG_FACP | TAG_FE | TAG_FIREEXIT);
          g.addEdge(WS[f], nc, 22); g.addEdge(nc, cj, 20); g.addEdge(cj, sm, 15); g.addEdge(sm, sj, 15); g.addEdge(sj, sc, 20); g.addEdge(sc, WS[f], 22);
          g.addEdge(cj, CS[f], SEG_CJ_CS); g.addEdge(CS[f], NW[f], SEG_CS_NW); g.addEdge(NW[f], NS[f], SEG_NW_NS);
          const au = N('AUD5', 'Auditorium', ROOM, 38, 49, TAG_FE); g.addEdge(au, nc, 6); g.addEdge(au, sc, 6);
          const r1 = N('R501', 'Room 501', ROOM, 82, 30, TAG_FE), r2 = N('R502', 'Room 502', ROOM, 82, 48, TAG_FE), r3 = N('R503', 'Room 503', ROOM, 82, 66, TAG_FE);
          g.addEdge(r1, cj, ROOM_DOOR + 2); g.addEdge(r2, sm, ROOM_DOOR + 2); g.addEdge(r3, sj, ROOM_DOOR + 2);
        }
      }
      for (const x of X) { const l = x.link === 'NW' ? NW[x.floor] : NS[x.floor]; const r = g.addNode(x.id, x.name, ROOM, x.floor, g.nodes[l].x + x.dx, g.nodes[l].y + x.dy); g.nodes[r].tags = TAG_FE; g.addEdge(r, l, x.m); }
      for (let f = 1; f < FLOORS; f++) {
        g.addEdge(WS[f], WS[f + 1], STAIR_FLOOR); g.addEdge(CS[f], CS[f + 1], STAIR_FLOOR); g.addEdge(NS[f], NS[f + 1], STAIR_FLOOR);
        if (ES[f] && ES[f + 1]) g.addEdge(ES[f], ES[f + 1], STAIR_FLOOR);
      }
      const exw = g.addNode('EXW', 'Exit West', EXIT, 1, 0, 60), exe = g.addNode('EXE', 'Exit East', EXIT, 1, 98, 60), exn = g.addNode('EXN', 'Exit NE Wing', EXIT, 1, 90, 0);
      g.nodes[exw].tags = g.nodes[exe].tags = g.nodes[exn].tags = TAG_FIREEXIT;
      g.addEdge(WS[1], exw, DOOR); g.addEdge(ES[1], exe, DOOR); g.addEdge(NS[1], exn, DOOR);
      const crd = g.addNode('CRD', 'Campus Road', HALL, 0, 60, 45), ogt = g.addNode('OGT', 'Oval Gate', HALL, 0, 80, 70), ovl = g.addNode('OVAL', 'Assembly Point: MCL Track Oval', CENTER, 0, 92, 90);
      g.addEdge(exe, crd, OUT_E); g.addEdge(exn, crd, OUT_N); g.addEdge(exw, crd, OUT_W); g.addEdge(crd, ogt, ROAD_TO_GATE); g.addEdge(ogt, ovl, GATE_TO_OVAL);
    }
    buildTree() {
      const bld = this.root.add('Rizal Building');
      for (let f = 1; f <= FLOORS; f++) this.floorNode[f] = bld.add('Floor ' + f);
      for (const n of this.g.nodes) if (n.active && n.floor >= 1 && (n.kind === ROOM || n.kind === EXIT)) this.floorNode[n.floor].add(n.name);
      this.root.add('Grounds').add('MCL Track Oval');
    }
    rebuildIndex() { this.byId.clear(); this.g.nodes.forEach((n, i) => { if (n.active) this.byId.set(n.id, i); }); }
    idx(id) { return this.byId.has(id) ? this.byId.get(id) : -1; }
    err(m) { return { ok: false, msg: m }; }
    plan(from, kind) { return this.planIf(from, i => this.g.nodes[i].kind === kind); }
    planIf(from, goal) {
      const g = this.g, r = { path: g.bfs(from, goal), meters: 0, toExit: 0, exit: '' };
      let past = false;
      r.path.forEach((v, i) => {
        if (i) { const m = g.meters(r.path[i - 1], v); r.meters += m; if (!past) r.toExit += m; }
        if (!past && g.nodes[v].kind === EXIT) { past = true; r.exit = g.nodes[v].id; }
      });
      return r;
    }
    pathObj(r) {
      if (!r.path.length) return this.err('No safe route - you are cut off. Press SOS and stay put.');
      const g = this.g;
      return { ok: true, path: r.path.map(v => g.nodes[v].id), names: r.path.map(v => g.nodes[v].name), meters: r.meters, steps: r.path.length - 1, exit: r.exit, toExit: r.toExit, toOval: r.meters - r.toExit };
    }
    nearest(from, kind) { return this.pathObj(this.plan(from, kind)); }
    mapObj() {
      const g = this.g, nodes = g.nodes.map(n => n.active ? { id: n.id, name: n.name, k: n.kind, f: n.floor, x: Math.trunc(n.x), y: Math.trunc(n.y), b: n.blocked ? 1 : 0, t: n.tags } : null), edges = [];
      g.adj.forEach((l, a) => l.forEach(e => { if (a < e.to) edges.push([a, e.to, e.meters, e.blocked ? 1 : 0]); }));
      return { nodes, edges };
    }
    static toInt(s) { return /^[+-]?\d+$/.test(s) ? parseInt(s, 10) : null; }
    static unus(s) { return s.replace(/_/g, ' '); }

    execObj(line) {
      const g = this.g, t = line.trim().split(/\s+/).filter(Boolean);
      if (!t.length) return this.err('Empty command');
      const T = i => (i < t.length ? t[i] : ''), c = t[0], a = T(1), b = T(2), d = T(3), e = T(4), f5 = T(5), ids = v => v.map(i => g.nodes[i].id);

      if (c === 'map') return this.mapObj();
      if (c === 'tree') return this.root;
      if (c === 'search') { const i = this.idx(a); if (i < 0) return this.err('Not found'); const n = g.nodes[i]; return { ok: true, id: n.id, name: n.name, kind: n.kind, floor: n.floor }; }
      if (c === 'route') { const i = this.idx(a); if (i < 0) return this.err('Unknown location'); return this.nearest(i, b === 'center' ? CENTER : EXIT); }
      if (c === 'find') {
        const i = this.idx(a); if (i < 0) return this.err('Unknown location');
        if (b === 'exit') return this.nearest(i, EXIT); if (b === 'center') return this.nearest(i, CENTER);
        const bit = b === 'alarm' ? TAG_FACP : b === 'extinguisher' ? TAG_FE : b === 'hose' ? TAG_HOSE : b === 'refuge' ? TAG_REFUGE : 0;
        if (!bit) return this.err('Usage: find ID alarm|extinguisher|hose|refuge|exit|center');
        return this.pathObj(this.planIf(i, x => (g.nodes[x].tags & bit) !== 0));
      }
      if (c === 'contacts') return { ok: true, contacts: [{ name: 'MCL Security Office', number: 'local 4099' }, { name: 'Cabuyao PNP', number: '(049) 502 6535 / 0927 952 2360' },
        { name: 'Cabuyao Fire Station', number: '(049) 544 5628 / 0932 741 1457' }], relay: ['What is your name?', 'What happened?', 'Where are you?', 'Is anyone hurt?'],
        fire: ['Raise the alarm - use the closest Fire Alarm Call Point', 'Call the fire service', 'Leave the building through the nearest fire exit', 'Do NOT stop to collect personal belongings', 'Do NOT use the elevator', 'Go straight to the assembly point: MCL Track Oval'] };
      if (c === 'oval') {
        const out = [];
        for (let f = 1; f <= FLOORS; f++) {
          const from = this.idx('F' + f + 'CJ'); if (from < 0) continue; const r = this.plan(from, CENTER);
          if (!r.path.length) out.push({ floor: f, meters: -1, cutoff: true });
          else out.push({ floor: f, meters: r.meters, approx: Math.floor((r.meters + 5) / 10) * 10, exit: r.exit, toExit: r.toExit, toOval: r.meters - r.toExit, steps: r.path.length - 1 });
        }
        return out;
      }
      if (c === 'ranked') {
        const from = this.idx(a); if (from < 0) return this.err('Unknown location'); const r = [];
        g.nodes.forEach((n, i) => {
          if (n.active && (n.kind === EXIT || n.kind === CENTER)) {
            const p = g.bfs(from, x => x === i); if (!p.length) return;
            let m = 0; for (let k = 1; k < p.length; k++) m += g.meters(p[k - 1], p[k]); r.push({ id: n.id, meters: m });
          }
        });
        return r.sort((x, y) => x.meters - y.meters);        // stable, like merge sort
      }
      if (c === 'hazard') {
        const i = this.idx(a); if (i < 0) return this.err('Unknown location');
        if (b === '') { this.hist.push({ a: i, b: -1, before: g.nodes[i].blocked }); g.nodes[i].blocked = !g.nodes[i].blocked; }
        else {
          const j = this.idx(b); if (j < 0) return this.err('Unknown location');
          if (!g.hasEdge(i, j)) return this.err('Those two places are not directly connected');
          const was = g.edgeBlocked(i, j); this.hist.push({ a: i, b: j, before: was }); g.setEdgeBlocked(i, j, !was);
        }
        this.hazardEvents++; return this.execObj('status');
      }
      if (c === 'undo') {
        if (!this.hist.length) return this.err('Nothing to undo');
        const h = this.hist.pop(); if (h.b < 0) g.nodes[h.a].blocked = h.before; else g.setEdgeBlocked(h.a, h.b, h.before);
        return this.execObj('status');
      }
      if (c === 'register') {
        const i = this.idx(d); if (a === '' || i < 0) return this.err('Usage: register USER NAME NODE');
        const p = this.people.find(x => x.id === a); if (p) { p.name = Campus.unus(b); p.node = i; } else this.people.push({ id: a, name: Campus.unus(b), node: i, in: false });
        return { ok: true, msg: 'Registered' };
      }
      if (c === 'unregister') { const k = this.people.findIndex(x => x.id === a); if (k < 0) return this.err('Unknown user'); this.people.splice(k, 1); return { ok: true, msg: 'Removed' }; }
      if (c === 'sos') {
        const i = this.idx(d); if (i < 0) return this.err('Unknown location');
        const p = this.people.find(x => x.id === a); if (p) p.node = i; else this.people.push({ id: a, name: Campus.unus(b), node: i, in: false });
        this.sosQ.push({ ticket: ++this.ticket, user: a, node: i, kind: e === '' ? 'distress' : e });
        return { ok: true, ticket: this.ticket, queue: this.sosQ.length, route: this.nearest(i, CENTER) };
      }
      if (c === 'next') {
        if (!this.sosQ.length) return this.err('Dispatch queue is empty'); const s = this.sosQ.shift(); this.handled++;
        return { ok: true, ticket: s.ticket, user: s.user, at: g.nodes[s.node].id, kind: s.kind };
      }
      if (c === 'checkin') { const p = this.people.find(x => x.id === a); if (!p) return this.err('Unknown user - send an SOS or register first'); p.in = true; return { ok: true, msg: 'Checked in - you are accounted for' }; }
      if (c === 'addroom') {
        const fl = Campus.toInt(d), m = Campus.toInt(f5);
        if (a === '' || fl === null || fl < 1 || fl > FLOORS || m === null || m <= 0) return this.err('Usage: addroom ID NAME FLOOR LINK_ID METERS');
        if (this.idx(a) >= 0) return this.err('ID already exists'); const l = this.idx(e); if (l < 0) return this.err('Unknown link location');
        const n = g.addNode(a, Campus.unus(b), ROOM, fl, g.nodes[l].x + 6, g.nodes[l].y + 8); g.addEdge(n, l, m);
        this.rebuildIndex(); this.floorNode[fl].add(Campus.unus(b)); return { ok: true, msg: 'Room added' };
      }
      if (c === 'delroom') {
        const i = this.idx(a); if (i < 0) return this.err('Unknown location'); if (g.nodes[i].kind !== ROOM) return this.err('Only rooms can be deleted');
        this.root.removeDeep(g.nodes[i].name); g.removeNode(i); this.rebuildIndex(); return { ok: true, msg: 'Room deleted' };
      }
      if (c === 'status') {
        const bl = [], be = []; g.nodes.forEach((n, i) => { if (n.active && n.blocked) bl.push(i); });
        g.adj.forEach((l, x) => l.forEach(ed => { if (x < ed.to && ed.blocked) be.push([g.nodes[x].id, g.nodes[ed.to].id]); }));
        return { ok: true, queue: this.sosQ.length, unaccounted: this.people.filter(p => !p.in).map(p => p.name), cutoff: ids(g.cutOff()), blocked: ids(bl), blockedEdges: be };
      }
      if (c === 'report') {
        const inn = this.people.filter(p => p.in).length;
        return { ok: true, sosTotal: this.ticket, handled: this.handled, pending: this.sosQ.length, people: this.people.length, checkedIn: inn, unaccounted: this.people.length - inn, hazardEvents: this.hazardEvents };
      }
      return this.err('Unknown command');
    }
    exec(line) { return JSON.stringify(this.execObj(line)); }
  }
  root.CampusEngine = Campus;
  if (typeof module !== 'undefined' && module.exports) module.exports = Campus;
})(typeof window !== 'undefined' ? window : globalThis);
