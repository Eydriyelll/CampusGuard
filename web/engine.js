// CampusGuard engine - JavaScript mirror of core/include/Campus.hpp (+ Graph/Tree/Algorithms).
// Used by the phone app (works fully offline). The desktop apps use the C++ engine directly.
// exec("route R4E center") -> JSON string, same commands and same JSON as the C++ engine.
(function (root) {
  'use strict';
  const FLOORS = 5, SEG_CJ_CS = 8, SEG_CS_NW = 18, SEG_NW_NS = 14, ROOM_DOOR = 4;
  const STAIR_FLOOR = 12, DOOR = 6, OUT_E = 100, OUT_N = 120, OUT_W = 130, ROAD_TO_GATE = 120, GATE_TO_OVAL = 50;
  const ROOM = 0, HALL = 1, EXIT = 2, CENTER = 3;
  const TAG_FACP = 1, TAG_FE = 2, TAG_HOSE = 4, TAG_REFUGE = 8, TAG_FIREEXIT = 16;   // legend items (see Graph.hpp)

  class BinaryTreeNode {
    constructor(value) { this.value = value; this.left = null; this.right = null; }
  }
  class BinaryTree {
    constructor() { this.root = null; }
  }
  class BinarySearchTree extends BinaryTree {
    insert(value) {
      const add = node => {
        if (!node) return new BinaryTreeNode(value);
        if (value < node.value) node.left = add(node.left);
        else if (node.value < value) node.right = add(node.right);
        return node;
      };
      this.root = add(this.root);
    }
    contains(value) {
      let node = this.root;
      while (node) {
        if (value === node.value) return true;
        node = value < node.value ? node.left : node.right;
      }
      return false;
    }
  }
  class AvlIndex {
    constructor() { this.root = null; }
    height(node) { return node ? node.height : 0; }
    update(node) { node.height = 1 + Math.max(this.height(node.left), this.height(node.right)); }
    rotateRight(top) {
      const next = top.left; top.left = next.right; this.update(top); next.right = top; this.update(next); return next;
    }
    rotateLeft(top) {
      const next = top.right; top.right = next.left; this.update(top); next.left = top; this.update(next); return next;
    }
    insert(key, value) {
      const add = node => {
        if (!node) return { key, value, height: 1, left: null, right: null };
        if (key < node.key) node.left = add(node.left);
        else if (node.key < key) node.right = add(node.right);
        else { node.value = value; return node; }
        this.update(node);
        const balance = this.height(node.left) - this.height(node.right);
        if (balance > 1) {
          if (key > node.left.key) node.left = this.rotateLeft(node.left);
          return this.rotateRight(node);
        }
        if (balance < -1) {
          if (key < node.right.key) node.right = this.rotateRight(node.right);
          return this.rotateLeft(node);
        }
        return node;
      };
      this.root = add(this.root);
    }
    find(key) {
      let node = this.root;
      while (node) {
        if (key === node.key) return node.value;
        node = key < node.key ? node.left : node.right;
      }
      return -1;
    }
  }
  class Trie {
    constructor() { this.root = { children: new Map(), matches: [] }; }
    insert(word, index) {
      let node = this.root;
      for (const letter of word) {
        if (!node.children.has(letter)) node.children.set(letter, { children: new Map(), matches: [] });
        node = node.children.get(letter);
        if (node.matches[node.matches.length - 1] !== index) node.matches.push(index);
      }
    }
    prefix(word, limit = 12) {
      let node = this.root;
      for (const letter of word) {
        node = node.children.get(letter);
        if (!node) return [];
      }
      return node.matches.slice(0, limit);
    }
  }
  class CircularList {
    constructor(limit = 8) { this.limit = limit; this.size = 0; this.head = null; this.tail = null; this.current = null; }
    add(value) {
      if (!this.limit) return;
      if (this.size === this.limit) {
        const oldest = this.head;
        if (this.size === 1) this.head = this.tail = this.current = null;
        else {
          this.head = oldest.next; this.tail.next = this.head;
          if (this.current === oldest) this.current = this.head;
        }
        this.size--;
      }
      const item = { value, next: null };
      if (!this.head) this.head = this.tail = this.current = item, item.next = item;
      else { item.next = this.head; this.tail.next = item; this.tail = this.current = item; }
      this.size++;
    }
    next() {
      if (!this.head) return null;
      this.current = this.current ? this.current.next : this.head;
      return this.current.value;
    }
    values() {
      const result = [];
      if (!this.head) return result;
      let node = this.head;
      do { result.push(node.value); node = node.next; } while (node !== this.head);
      return result;
    }
  }
  class MaxHeap {
    constructor(less = (a, b) => a < b) { this.values = []; this.less = less; }
    get size() { return this.values.length; }
    push(value) {
      this.values.push(value);
      let child = this.values.length - 1;
      while (child > 0) {
        const parent = Math.floor((child - 1) / 2);
        if (!this.less(this.values[parent], this.values[child])) break;
        [this.values[parent], this.values[child]] = [this.values[child], this.values[parent]];
        child = parent;
      }
    }
    pop() {
      const largest = this.values[0], last = this.values.pop();
      if (this.values.length) {
        this.values[0] = last;
        let parent = 0;
        while (parent * 2 + 1 < this.values.length) {
          let child = parent * 2 + 1;
          if (child + 1 < this.values.length && this.less(this.values[child], this.values[child + 1])) child++;
          if (!this.less(this.values[parent], this.values[child])) break;
          [this.values[parent], this.values[child]] = [this.values[child], this.values[parent]];
          parent = child;
        }
      }
      return largest;
    }
  }

  class Graph {
    constructor() { this.nodes = []; this.adj = []; }
    addNode(id, name, kind, floor, x, y) { this.nodes.push({ id, name, kind, floor, x, y, blocked: false, crowded: false, active: true, tags: 0 }); this.adj.push([]); return this.nodes.length - 1; }
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
          if (e.blocked || this.nodes[e.to].blocked || this.nodes[e.to].crowded || !this.nodes[e.to].active) continue;
          if (par[e.to] === -2) { par[e.to] = u; lvl[e.to] = lvl[u] + 1; dist[e.to] = dist[u] + e.meters; q.push(e.to); }
          else if (lvl[e.to] === lvl[u] + 1 && dist[u] + e.meters < dist[e.to]) { par[e.to] = u; dist[e.to] = dist[u] + e.meters; }
        }
      }
      if (best === -1) return [];
      const p = []; for (let v = best; v !== -1; v = par[v]) p.push(v); return p.reverse();
    }
    dijkstra(start, goal) {
      if (start < 0 || !this.nodes[start] || !this.nodes[start].active) return [];
      const distance = new Array(this.nodes.length).fill(Infinity), parent = new Array(this.nodes.length).fill(-2);
      const pending = new MaxHeap((a, b) => a.meters > b.meters || (a.meters === b.meters && a.node > b.node));
      distance[start] = 0; parent[start] = -1; pending.push({ meters: 0, node: start });
      while (pending.size) {
        const current = pending.pop();
        if (current.meters !== distance[current.node]) continue;
        if (goal(current.node)) {
          const path = [];
          for (let i = current.node; i !== -1; i = parent[i]) path.push(i);
          return path.reverse();
        }
        for (const edge of this.adj[current.node]) {
          const next = edge.to;
          if (edge.blocked || edge.meters < 0 || this.nodes[next].blocked || this.nodes[next].crowded || !this.nodes[next].active) continue;
          const nextDistance = current.meters + edge.meters;
          if (nextDistance >= distance[next]) continue;
          distance[next] = nextDistance; parent[next] = current.node;
          pending.push({ meters: nextDistance, node: next });
        }
      }
      return [];
    }
    // DFS from every open exit; indoor rooms/halls never reached are CUT OFF.
    cutOff() {
      const seen = new Array(this.nodes.length).fill(false), st = [];
      this.nodes.forEach((n, i) => { if (n.active && n.kind === EXIT && !n.blocked && !n.crowded) { seen[i] = true; st.push(i); } });
      while (st.length) { const u = st.pop(); for (const e of this.adj[u]) if (!seen[e.to] && !e.blocked && !this.nodes[e.to].blocked && !this.nodes[e.to].crowded) { seen[e.to] = true; st.push(e.to); } }
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
      this.people = []; this.sosQ = []; this.hist = []; this.byId = [];
      this.dynamicById = new AvlIndex(); this.nameTree = new BinarySearchTree(); this.nameLookup = new Map();
      this.locationTrie = new Trie(); this.recent = new CircularList();
      this.fireSimulation = false; this.fireSimulationNode = -1; this.previousBlocked = []; this.previousCrowded = [];
      this.ticket = 0; this.handled = 0; this.hazardEvents = 0;
      this.buildRizal(); this.baseNodeCount = this.g.nodes.length; this.rebuildIndex(); this.buildTree();
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
          g.addEdge(bay[n], ES[f], step); g.addEdge(bay[J], CS[f], SEG_CJ_CS);
          g.addEdge(CS[f], NW[f], SEG_CS_NW); g.addEdge(NW[f], NS[f], SEG_NW_NS);
          for (const d of R[f]) { const r = N(d.id, d.name, ROOM, 16 + (d.bay - 1) * gap, d.north ? 40 : 80, TAG_FE); g.addEdge(r, bay[d.bay], ROOM_DOOR); }
        } else {
          WS[f] = N(F + 'WS', L + 'West Stairs', HALL, 8, 50, STAIRS);
          const nc = N(F + 'NC', L + 'North Corridor', HALL, 32, 30, 0), cj = N(F + 'CJ', L + 'Central Junction', HALL, 60, 32, 0), sm = N(F + 'SM', L + 'East Corridor', HALL, 60, 50, 0),
                sj = N(F + 'SJ', L + 'South-East Corner', HALL, 60, 68, 0), sc = N(F + 'SC', L + 'South Corridor', HALL, 32, 68, 0);
          CS[f] = N(F + 'CS', L + 'Core Stairs', HALL, 60, 18, STAIRS);
          NW[f] = N(F + 'NW', L + 'NE Wing Hall', HALL, 72, 12, TAG_FE);
          NS[f] = N(F + 'NS', L + 'NE Stairs', HALL, 84, 6, TAG_FACP | TAG_FE | TAG_FIREEXIT);
          g.addEdge(WS[f], nc, 22); g.addEdge(nc, cj, 20); g.addEdge(cj, sm, 15); g.addEdge(sm, sj, 15); g.addEdge(sj, sc, 20); g.addEdge(sc, WS[f], 22);
          g.addEdge(cj, CS[f], SEG_CJ_CS);
          g.addEdge(CS[f], NW[f], SEG_CS_NW); g.addEdge(NW[f], NS[f], SEG_NW_NS);
          const au = N('AUD5', 'Auditorium', ROOM, 38, 49, TAG_FE); g.addEdge(au, nc, 6); g.addEdge(au, sc, 6);
          const r1 = N('R501', 'Room 501', ROOM, 82, 30, TAG_FE), r2 = N('R502', 'Room 502', ROOM, 82, 48, TAG_FE), r3 = N('R503', 'Room 503', ROOM, 82, 66, TAG_FE);
          g.addEdge(r1, cj, ROOM_DOOR + 2); g.addEdge(r2, sm, ROOM_DOOR + 2); g.addEdge(r3, sj, ROOM_DOOR + 2);
        }
      }
      for (const x of X) { const l = x.link === 'NW' ? NW[x.floor] : NS[x.floor]; const r = g.addNode(x.id, x.name, ROOM, x.floor, g.nodes[l].x + x.dx, g.nodes[l].y + x.dy); g.nodes[r].tags = TAG_FE; g.addEdge(r, l, x.m); }
      for (let f = 1; f < FLOORS; f++) {
        g.addEdge(WS[f], WS[f + 1], STAIR_FLOOR); g.addEdge(CS[f], CS[f + 1], STAIR_FLOOR);
        g.addEdge(NS[f], NS[f + 1], STAIR_FLOOR);
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
    rebuildIndex() {
      this.byId = []; this.dynamicById = new AvlIndex(); this.nameTree = new BinarySearchTree();
      this.nameLookup = new Map(); this.locationTrie = new Trie();
      this.g.nodes.forEach((n, i) => {
        if (!n.active) return;
        if (i < this.baseNodeCount) this.byId.push([n.id, i]); else this.dynamicById.insert(n.id, i);
        const name = n.name.toLowerCase();
        this.nameTree.insert(name);
        if (!this.nameLookup.has(name)) this.nameLookup.set(name, i);
        this.locationTrie.insert(n.id.toLowerCase(), i);
        this.locationTrie.insert(name, i);
      });
      this.byId.sort((a, b) => a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0);
    }
    idx(id) {
      let low = 0, high = this.byId.length - 1;
      while (low <= high) {
        const middle = Math.floor((low + high) / 2), key = this.byId[middle][0];
        if (key === id) return this.byId[middle][1];
        if (key < id) low = middle + 1; else high = middle - 1;
      }
      return this.dynamicById.find(id);
    }
    err(m) { return { ok: false, msg: m }; }
    plan(from, kind, shortestDistance = false) { return this.planIf(from, i => this.g.nodes[i].kind === kind && (kind !== EXIT || !this.g.nodes[i].crowded), shortestDistance); }
    planIf(from, goal, shortestDistance = false) {
      const g = this.g, r = { path: shortestDistance ? g.dijkstra(from, goal) : g.bfs(from, goal), meters: 0, toExit: 0, exit: '' };
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
    nearest(from, kind, shortestDistance = false) { return this.pathObj(this.plan(from, kind, shortestDistance)); }
    mapObj() {
      const g = this.g, nodes = g.nodes.map(n => n.active ? { id: n.id, name: n.name, k: n.kind, f: n.floor, x: Math.trunc(n.x), y: Math.trunc(n.y), b: n.blocked ? 1 : 0, q: n.crowded ? 1 : 0, t: n.tags } : null), edges = [];
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
      if (c === 'search') {
        let i = this.idx(a);
        const name = Campus.unus(a).toLowerCase();
        if (i < 0 && this.nameTree.contains(name)) i = this.nameLookup.has(name) ? this.nameLookup.get(name) : -1;
        if (i < 0) return this.err('Not found');
        const n = g.nodes[i]; return { ok: true, id: n.id, name: n.name, kind: n.kind, floor: n.floor };
      }
      if (c === 'suggest') {
        const prefix = Campus.unus(a).toLowerCase();
        if (!prefix) return this.err('Enter part of a room name or ID');
        const found = new Set();
        return this.locationTrie.prefix(prefix).filter(i => {
          if (found.has(i) || !g.nodes[i].active) return false;
          found.add(i); return true;
        }).map(i => ({ id: g.nodes[i].id, name: g.nodes[i].name }));
      }
      if (c === 'remember') {
        const i = this.idx(a); if (i < 0) return this.err('Unknown location');
        this.recent.add(g.nodes[i].id); return { ok: true, msg: 'Location saved' };
      }
      if (c === 'recent') return this.recent.values();
      if (c === 'nextrecent') {
        const id = this.recent.next(); if (!id) return this.err('No recently selected locations');
        const i = this.idx(id); if (i < 0) return this.err('Recently selected location is no longer available');
        return { ok: true, id, name: g.nodes[i].name };
      }
      if (c === 'route') {
        const i = this.idx(a); if (i < 0) return this.err('Unknown location');
        if (b === 'to') {
          const destination = this.idx(d); if (destination < 0) return this.err('Unknown destination');
          if (g.nodes[destination].crowded || g.nodes[destination].blocked) return this.err('That destination is blocked or crowded');
          return this.pathObj(this.planIf(i, x => x === destination, true));
        }
        return this.nearest(i, b === 'center' ? CENTER : EXIT, d === 'distance');
      }
      if (c === 'find') {
        const i = this.idx(a); if (i < 0) return this.err('Unknown location');
        const shortestDistance = d === 'distance';
        if (b === 'exit') return this.pathObj(this.planIf(i, x => g.nodes[x].kind === EXIT && !g.nodes[x].crowded, shortestDistance));
        if (b === 'center') return this.nearest(i, CENTER, shortestDistance);
        const bit = b === 'alarm' ? TAG_FACP : b === 'extinguisher' ? TAG_FE : b === 'hose' ? TAG_HOSE : b === 'refuge' ? TAG_REFUGE : 0;
        if (!bit) return this.err('Usage: find ID alarm|extinguisher|hose|refuge|exit|center');
        return this.pathObj(this.planIf(i, x => (g.nodes[x].tags & bit) !== 0, shortestDistance));
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
        const from = this.idx(a); if (from < 0) return this.err('Unknown location');
        const ranked = new MaxHeap((x, y) => x.meters < y.meters || (x.meters === y.meters && x.index < y.index));
        g.nodes.forEach((n, i) => {
          if (n.active && !n.blocked && !n.crowded && (n.kind === EXIT || n.kind === CENTER)) {
            const p = g.dijkstra(from, x => x === i); if (!p.length) return;
            let m = 0; for (let k = 1; k < p.length; k++) m += g.meters(p[k - 1], p[k]); ranked.push({ id: n.id, meters: m, index: i });
          }
        });
        const result = []; while (ranked.size) result.push(ranked.pop());
        return result.reverse().map(({ id, meters }) => ({ id, meters }));
      }
      if (c === 'crowd') {
        const i = this.idx(a); if (i < 0) return this.err('Unknown location');
        if (g.nodes[i].kind !== HALL && g.nodes[i].kind !== EXIT) return this.err('Crowding can only be reported at a hallway or exit');
        g.nodes[i].crowded = !g.nodes[i].crowded;
        return this.execObj('status');
      }
      if (c === 'simulatefire') {
        if (this.fireSimulation) {
          for (const [index, before] of this.previousBlocked) g.nodes[index].blocked = before;
          for (const [index, before] of this.previousCrowded) g.nodes[index].crowded = before;
          this.fireSimulation = false; this.fireSimulationNode = -1;
          this.previousBlocked = []; this.previousCrowded = [];
          return this.execObj('status');
        }
        const fire = this.idx(a || 'F3CJ');
        if (fire < 0 || g.nodes[fire].floor < 1 || (g.nodes[fire].kind !== ROOM && g.nodes[fire].kind !== HALL)) {
          return this.err('Choose an indoor room or hallway for the fire simulation');
        }
        this.fireSimulation = true; this.fireSimulationNode = fire;
        this.previousBlocked.push([fire, g.nodes[fire].blocked]); g.nodes[fire].blocked = true;
        const floor = g.nodes[fire].floor;
        for (const stairId of [`F${floor}WS`, `F${floor}ES`]) {
          const stair = this.idx(stairId);
          if (stair < 0) continue;
          this.previousCrowded.push([stair, g.nodes[stair].crowded]); g.nodes[stair].crowded = true;
        }
        this.hazardEvents++;
        return this.execObj('status');
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
        return { ok: true, ticket: this.ticket, queue: this.sosQ.length, route: this.nearest(i, CENTER, f5 === 'distance') };
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
        const bl = [], crowded = [], be = []; g.nodes.forEach((n, i) => { if (n.active && n.blocked) bl.push(i); if (n.active && n.crowded) crowded.push(i); });
        g.adj.forEach((l, x) => l.forEach(ed => { if (x < ed.to && ed.blocked) be.push([g.nodes[x].id, g.nodes[ed.to].id]); }));
        return { ok: true, queue: this.sosQ.length, unaccounted: this.people.filter(p => !p.in).map(p => p.name), cutoff: ids(g.cutOff()), blocked: ids(bl), crowded: ids(crowded), blockedEdges: be, emergency: this.fireSimulation, fireAt: this.fireSimulationNode < 0 ? null : g.nodes[this.fireSimulationNode].id };
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
