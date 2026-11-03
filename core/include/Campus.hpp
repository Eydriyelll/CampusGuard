// The engine: ties the data structures + algorithms together. One text command in -> JSON out.
//
// MODEL (built from the posted Emergency Evacuation Plans, Rizal Building, rev. May 8 2024):
//   * 5 floors with the REAL room numbers (R200-R214, R301-R314, CR, Faculty, CLIR, R400-R412, labs,
//     Research Center, Auditorium, R501-R503). The ground-floor plan has no room labels -> placeholders.
//   * Floors 1-4: long east-west corridor (bays), West/East Stairs, Core Stairs, and a diagonal NE wing + NE Stairs.
//   * Floor 5: loop corridor around the Auditorium, West/Core/NE stairs (NO east stairs), R501-R503 on the east side.
//   * Only the ground floor touches the outside: Exit West, Exit East, Exit NE Wing.
//   * Evacuation center / assembly point = the MCL Track Oval, ~270-300 m from the ground-floor exits.
//   * Legend items are node tags: Fire Alarm Call Point, Extinguisher, Hose, Safe Refuge, Fire Exit.
//   * Distances are APPROXIMATE (estimated from the plan drawings) - tune the constants to the real building.
#pragma once
#include <algorithm>
#include <cctype>
#include <cstdlib>
#include <sstream>
#include <string>
#include <unordered_map>
#include <unordered_set>
#include <vector>
#include "Algorithms.hpp"
#include "Graph.hpp"
#include "Tree.hpp"
#include "ds.hpp"

struct Person { std::string id, name; int node; bool in = false; };
struct Sos { int ticket; std::string user; int node; std::string kind; };
struct HazardAct { int a, b; bool before; };            // b == -1 -> node hazard, otherwise edge a-b
struct Ranked {
    int idx, meters;
    bool operator<(const Ranked& other) const {
        return meters == other.meters ? idx < other.idx : meters < other.meters;
    }
};
struct RouteInfo { std::vector<int> path; int meters = 0, toExit = 0; std::string exit; };

class Campus {
    // ---- tunable distances (meters) -------------------------------------------------------------
    static constexpr int FLOORS = 5;
    static constexpr int SEG_CJ_CS = 8, SEG_CS_NW = 18, SEG_NW_NS = 14;                    // core + NE wing
    static constexpr int ROOM_DOOR = 4;                                                   // corridor -> room door
    static constexpr int STAIR_FLOOR = 12;                                                // one floor of stairs
    static constexpr int DOOR = 6;                                                        // stairwell -> exit door
    static constexpr int OUT_E = 100, OUT_N = 120, OUT_W = 130;                           // exit -> Campus Road
    static constexpr int ROAD_TO_GATE = 120, GATE_TO_OVAL = 50;                           // road -> Oval gate -> Oval
    // totals from the ground-floor exits to the Oval:  East 270 m, NE 290 m, West 300 m
    // ---------------------------------------------------------------------------------------------

    Graph g; TreeNode root{"Campus"}; TreeNode* floorNode[FLOORS + 1] = {};
    DoublyLinkedList<Person> people; Queue<Sos> sosQ; Stack<HazardAct> hist;
    CircularList<std::string> recent;
    std::vector<std::pair<std::string, int>> byId;   // sorted index for binary search
    AvlIndex dynamicById;
    BinarySearchTree<std::string> nameTree;
    std::unordered_map<std::string, int> nameLookup;
    Trie locationTrie;
    size_t baseNodeCount = 0;
    bool fireSimulation = false;
    int fireSimulationNode = -1;
    std::vector<std::pair<int, bool>> previousBlocked;
    std::vector<std::pair<int, bool>> previousCrowded;
    int ticket = 0, handled = 0, hazardEvents = 0;

    static std::string esc(const std::string& s) {
        std::string o; for (char c : s) { if (c == '"' || c == '\\') o += '\\'; if (c != '\n' && c != '\r') o += c; } return o;
    }
    static std::string Q(const std::string& s) { return "\"" + esc(s) + "\""; }
    static std::string err(const std::string& m) { return "{\"ok\":false,\"msg\":" + Q(m) + "}"; }
    static std::string unus(std::string s) { for (char& c : s) if (c == '_') c = ' '; return s; }   // NAME_WITH_SPACES
    static std::string lower(std::string s) {
        for (char& c : s) c = static_cast<char>(std::tolower(static_cast<unsigned char>(c)));
        return s;
    }
    static bool toInt(const std::string& s, int& out) {
        char* end = nullptr; long v = std::strtol(s.c_str(), &end, 10);
        if (s.empty() || *end) return false;
        out = (int)v; return true;
    }

    void rebuildIndex() {                                  // MERGE SORT feeds BINARY SEARCH
        byId.clear();
        dynamicById.clear();
        nameTree.root.reset();
        nameLookup.clear();
        locationTrie.clear();
        for (size_t i = 0; i < g.nodes.size(); ++i) {
            const MapNode& node = g.nodes[i];
            if (!node.active) continue;

            if (i < baseNodeCount) byId.push_back({node.id, static_cast<int>(i)});
            else dynamicById.insert(node.id, static_cast<int>(i));

            const std::string name = lower(node.name);
            nameTree.insert(name);
            nameLookup.emplace(name, static_cast<int>(i));
            locationTrie.insert(lower(node.id), static_cast<int>(i));
            locationTrie.insert(name, static_cast<int>(i));
        }
        mergeSort(byId, [](const std::pair<std::string, int>& a, const std::pair<std::string, int>& b) { return a.first < b.first; });
    }
    int idx(const std::string& id) const {
        int p = binarySearch(byId, id, [](const std::pair<std::string, int>& x) { return x.first; });
        return p < 0 ? dynamicById.find(id) : byId[p].second;
    }

    RouteInfo plan(int from, Kind k, bool shortestDistance = false) const {
        return planIf(from, [&](int i) {
            return g.nodes[i].kind == k && (k != Kind::Exit || !g.nodes[i].crowded);
        }, shortestDistance);
    }
    template <class F> RouteInfo planIf(int from, F goal, bool shortestDistance = false) const {
        RouteInfo r;
        r.path = shortestDistance ? g.dijkstra(from, goal) : g.bfs(from, goal);
        bool pastExit = false;
        for (size_t i = 0; i < r.path.size(); ++i) {
            if (i) { int m = g.meters(r.path[i - 1], r.path[i]); r.meters += m; if (!pastExit) r.toExit += m; }
            if (!pastExit && g.nodes[r.path[i]].kind == Kind::Exit) { pastExit = true; r.exit = g.nodes[r.path[i]].id; }
        }
        return r;
    }
    std::string pathJson(const RouteInfo& r) const {
        if (r.path.empty()) return err("No safe route - you are cut off. Press SOS and stay put.");
        std::string ids, nm, sep;
        for (int v : r.path) { ids += sep + Q(g.nodes[v].id); nm += sep + Q(g.nodes[v].name); sep = ","; }
        return "{\"ok\":true,\"path\":[" + ids + "],\"names\":[" + nm + "],\"meters\":" + std::to_string(r.meters) +
               ",\"steps\":" + std::to_string(r.path.size() - 1) + ",\"exit\":" + Q(r.exit) +
               ",\"toExit\":" + std::to_string(r.toExit) + ",\"toOval\":" + std::to_string(r.meters - r.toExit) + "}";
    }
    std::string nearest(int from, Kind k, bool shortestDistance = false) const {
        return pathJson(plan(from, k, shortestDistance));
    }

    std::string mapJson() const {
        std::string s = "{\"nodes\":[", e = "],\"edges\":[", sep;
        for (size_t i = 0; i < g.nodes.size(); ++i) { auto& n = g.nodes[i];
            if (!n.active) { s += sep + "null"; sep = ","; continue; }       // keeps array index == node index
            s += sep + "{\"id\":" + Q(n.id) + ",\"name\":" + Q(n.name) + ",\"k\":" + std::to_string((int)n.kind) + ",\"f\":" + std::to_string(n.floor) +
                 ",\"x\":" + std::to_string((int)n.x) + ",\"y\":" + std::to_string((int)n.y) +
                 ",\"b\":" + (n.blocked ? "1" : "0") + ",\"q\":" + (n.crowded ? "1" : "0") +
                 ",\"t\":" + std::to_string(n.tags) + "}"; sep = ","; }
        sep = "";
        for (size_t a = 0; a < g.adj.size(); ++a) for (auto& ed : g.adj[a]) if ((int)a < ed.to) {
            e += sep + "[" + std::to_string(a) + "," + std::to_string(ed.to) + "," + std::to_string(ed.meters) + "," + (ed.blocked ? "1" : "0") + "]"; sep = ","; }
        return s + e + "]}";
    }
    std::string list(const std::vector<int>& v) const {
        std::string s = "[", sep; for (int i : v) { s += sep + Q(g.nodes[i].id); sep = ","; } return s + "]";
    }

    // ------------------------------------------------------------------ building the campus
    struct RoomDef { const char* id; const char* name; int bay; bool north; };
    struct Extra { int floor; const char* id; const char* name; const char* link; int m; double dx, dy; };

    void buildRizal() {
        // Rooms along the main corridor, west -> east. "bay" = which corridor segment the door opens onto.
        static const std::vector<RoomDef> R[FLOORS + 1] = {
            {},
            { {"R1S1","Ground Rm S1",1,false},{"R1S2","Ground Rm S2",2,false},{"R1S3","Ground Rm S3",3,false},{"R1S4","Ground Rm S4",4,false},
              {"R1S5","Ground Rm S5",5,false},{"R1S6","Ground Rm S6",6,false},{"R1S7","Ground Rm S7",7,false},{"R1S8","Ground Rm S8",8,false},
              {"R1N1","Ground Rm N1",1,true},{"R1N2","Ground Rm N2",2,true},{"R1N3","Ground Rm N3",3,true},{"R1N4","Ground Rm N4",4,true},{"R1N5","Ground Rm N5",7,true} },
            { {"R200","Room 200",1,false},{"R202","Room 202",2,false},{"R204","Room 204",3,false},{"R206","Room 206",4,false},
              {"R208","Room 208",5,false},{"R210","Room 210",6,false},{"R212","Room 212",7,false},{"R214","Room 214",8,false},
              {"R201","Room 201",1,true},{"R203","Room 203",2,true},{"R205","Room 205",3,true},{"R207","Room 207",4,true},{"R209","Room 209",7,true} },
            { {"R300","Room 300",1,false},{"R302","Room 302",2,false},{"R304","Room 304",3,false},{"R306","Room 306",4,false},
              {"R308","Room 308",5,false},{"R310","Room 310",6,false},{"R312","Room 312",7,false},{"R314","Room 314",8,false},
              {"R301","Room 301",1,true},{"R303","Room 303",2,true},{"R305","Room 305",3,true},{"R307","Room 307",4,true},
              {"CR3","Comfort Room (3F)",5,true},{"FAC3","Faculty Room",7,true} },
            { {"R400","Room 400",1,false},{"R402","Room 402",2,false},{"R404","Room 404",3,false},{"R406","Room 406",4,false},
              {"R408","Room 408",5,false},{"R410","Room 410",6,false},{"R412","Room 412",7,false},
              {"R401","Room 401",1,true},{"R403","Room 403",2,true},{"R405A","Room 405A",3,true},{"R405B","Room 405B",4,true},{"RC4","Research Center",7,true} },
            {} };
        static const int BAYS[FLOORS + 1] = {0, 8, 8, 8, 7, 0};
        static const int J = 6;                                        // the core/stem joins the corridor at bay 6
        static const Extra X[] = { {3,"CLIR3","CLIR","NW",8,12,8}, {4,"LAB4E","Lab (east)","NW",8,12,10}, {4,"LAB4N","Lab (NE wing)","NS",6,-6,14} };
        const int STAIRS = TAG_FACP | TAG_FE | TAG_HOSE | TAG_FIREEXIT;
        int WS[FLOORS + 1] = {}, ES[FLOORS + 1] = {}, CS[FLOORS + 1] = {},
            NW[FLOORS + 1] = {}, NS[FLOORS + 1] = {};

        for (int f = 1; f <= FLOORS; ++f) {
            const std::string F = "F" + std::to_string(f), L = F + " ";
            auto N = [&](const std::string& id, const std::string& nm, Kind k, double x, double y, int tags) {
                int i = g.addNode(id, nm, k, f, x, y); g.nodes[i].tags = tags; return i; };
            if (f < FLOORS) {
                const int n = BAYS[f], step = (n == 8) ? 7 : 8; const double gap = 64.0 / (n - 1);
                std::vector<int> bay(n + 1);
                for (int k = 1; k <= n; ++k)
                    bay[k] = (k == J) ? N(F + "CJ", L + "Central Junction", Kind::Hall, 16 + (k - 1) * gap, 60, 0)
                                      : N(F + "C" + std::to_string(k), L + "Corridor " + std::to_string(k), Kind::Hall, 16 + (k - 1) * gap, 60, 0);
                WS[f] = N(F + "WS", L + "West Stairs", Kind::Hall, 6, 60, STAIRS);
                ES[f] = N(F + "ES", L + "East Stairs", Kind::Hall, 92, 60, STAIRS);
                const double jx = 16 + (J - 1) * gap;
                CS[f] = N(F + "CS", L + "Core Stairs", Kind::Hall, jx, 38, STAIRS | (f == 1 ? TAG_REFUGE : 0));
                NW[f] = N(F + "NW", f == 1 ? L + "NE Wing Lobby" : L + "NE Wing Hall", Kind::Hall, jx + 12, 24, TAG_FE);
                NS[f] = N(F + "NS", L + "NE Stairs", Kind::Hall, jx + 24, 10, TAG_FACP | TAG_FE | TAG_FIREEXIT);
                g.addEdge(WS[f], bay[1], 6); for (int k = 1; k < n; ++k) g.addEdge(bay[k], bay[k + 1], step);
                g.addEdge(bay[n], ES[f], step); g.addEdge(bay[J], CS[f], SEG_CJ_CS);
                g.addEdge(CS[f], NW[f], SEG_CS_NW); g.addEdge(NW[f], NS[f], SEG_NW_NS);
                for (const RoomDef& rd : R[f]) {
                    int r = N(rd.id, rd.name, Kind::Room, 16 + (rd.bay - 1) * gap, rd.north ? 40 : 80, TAG_FE);
                    g.addEdge(r, bay[rd.bay], ROOM_DOOR);
                }
            } else {                                                   // 5th floor: loop corridor around the Auditorium
                WS[f] = N(F + "WS", L + "West Stairs", Kind::Hall, 8, 50, STAIRS);
                int nc = N(F + "NC", L + "North Corridor", Kind::Hall, 32, 30, 0), cj = N(F + "CJ", L + "Central Junction", Kind::Hall, 60, 32, 0),
                    sm = N(F + "SM", L + "East Corridor", Kind::Hall, 60, 50, 0), sj = N(F + "SJ", L + "South-East Corner", Kind::Hall, 60, 68, 0),
                    sc = N(F + "SC", L + "South Corridor", Kind::Hall, 32, 68, 0);
                CS[f] = N(F + "CS", L + "Core Stairs", Kind::Hall, 60, 18, STAIRS);
                NW[f] = N(F + "NW", L + "NE Wing Hall", Kind::Hall, 72, 12, TAG_FE);
                NS[f] = N(F + "NS", L + "NE Stairs", Kind::Hall, 84, 6, TAG_FACP | TAG_FE | TAG_FIREEXIT);
                g.addEdge(WS[f], nc, 22); g.addEdge(nc, cj, 20); g.addEdge(cj, sm, 15); g.addEdge(sm, sj, 15);
                g.addEdge(sj, sc, 20); g.addEdge(sc, WS[f], 22); g.addEdge(cj, CS[f], SEG_CJ_CS);
                g.addEdge(CS[f], NW[f], SEG_CS_NW); g.addEdge(NW[f], NS[f], SEG_NW_NS);
                int au = N("AUD5", "Auditorium", Kind::Room, 38, 49, TAG_FE); g.addEdge(au, nc, 6); g.addEdge(au, sc, 6);
                int r1 = N("R501", "Room 501", Kind::Room, 82, 30, TAG_FE), r2 = N("R502", "Room 502", Kind::Room, 82, 48, TAG_FE), r3 = N("R503", "Room 503", Kind::Room, 82, 66, TAG_FE);
                g.addEdge(r1, cj, ROOM_DOOR + 2); g.addEdge(r2, sm, ROOM_DOOR + 2); g.addEdge(r3, sj, ROOM_DOOR + 2);
            }
        }
        for (const Extra& x : X) {                                     // labs / CLIR in the NE wing
            int l = std::string(x.link) == "NW" ? NW[x.floor] : NS[x.floor];
            int r = g.addNode(x.id, x.name, Kind::Room, x.floor, g.nodes[l].x + x.dx, g.nodes[l].y + x.dy); g.nodes[r].tags = TAG_FE; g.addEdge(r, l, x.m);
        }
        for (int f = 1; f < FLOORS; ++f) {                             // stairwells connect floors (only where both floors have one)
            g.addEdge(WS[f], WS[f + 1], STAIR_FLOOR); g.addEdge(CS[f], CS[f + 1], STAIR_FLOOR);
            g.addEdge(NS[f], NS[f + 1], STAIR_FLOOR);
            if (ES[f] && ES[f + 1]) g.addEdge(ES[f], ES[f + 1], STAIR_FLOOR);
        }
        // ground-floor exits (fire-exit icons on the 1F plan) -> outdoors -> the Oval (assembly point)
        int exw = g.addNode("EXW", "Exit West", Kind::Exit, 1, 0, 60), exe = g.addNode("EXE", "Exit East", Kind::Exit, 1, 98, 60),
            exn = g.addNode("EXN", "Exit NE Wing", Kind::Exit, 1, 90, 0);
        g.nodes[exw].tags = g.nodes[exe].tags = g.nodes[exn].tags = TAG_FIREEXIT;
        g.addEdge(WS[1], exw, DOOR); g.addEdge(ES[1], exe, DOOR); g.addEdge(NS[1], exn, DOOR);
        int crd = g.addNode("CRD", "Campus Road", Kind::Hall, 0, 60, 45), ogt = g.addNode("OGT", "Oval Gate", Kind::Hall, 0, 80, 70),
            ovl = g.addNode("OVAL", "Assembly Point: MCL Track Oval", Kind::Center, 0, 92, 90);
        g.addEdge(exe, crd, OUT_E); g.addEdge(exn, crd, OUT_N); g.addEdge(exw, crd, OUT_W);
        g.addEdge(crd, ogt, ROAD_TO_GATE); g.addEdge(ogt, ovl, GATE_TO_OVAL);
    }
    void buildTree() {
        TreeNode* bld = root.add("Rizal Building");
        for (int f = 1; f <= FLOORS; ++f) floorNode[f] = bld->add("Floor " + std::to_string(f));
        for (auto& n : g.nodes) if (n.active && n.floor >= 1 && (n.kind == Kind::Room || n.kind == Kind::Exit)) floorNode[n.floor]->add(n.name);
        root.add("Grounds")->add("MCL Track Oval");
    }

public:
    Campus() { buildRizal(); baseNodeCount = g.nodes.size(); rebuildIndex(); buildTree(); }

    std::string exec(const std::string& line) {
        std::istringstream in(line); std::vector<std::string> t; std::string w; while (in >> w) t.push_back(w);
        if (t.empty()) return err("Empty command");
        auto T = [&](size_t i) { return i < t.size() ? t[i] : std::string(); };
        const std::string c = t[0], a = T(1), b = T(2), d = T(3), e = T(4), f5 = T(5);

        if (c == "map") return mapJson();
        if (c == "tree") return root.json();
        if (c == "search") {
            int i = idx(a);
            if (i < 0) {
                const std::string name = lower(unus(a));
                if (nameTree.contains(name)) {
                    auto match = nameLookup.find(name);
                    if (match != nameLookup.end()) i = match->second;
                }
            }
            if (i < 0) return err("Not found");
            auto& n = g.nodes[i];
            return "{\"ok\":true,\"id\":" + Q(n.id) + ",\"name\":" + Q(n.name) + ",\"kind\":" + std::to_string((int)n.kind) + ",\"floor\":" + std::to_string(n.floor) + "}"; }
        if (c == "suggest") {
            const std::string prefix = lower(unus(a));
            if (prefix.empty()) return err("Enter part of a room name or ID");
            std::string result = "[", separator;
            std::unordered_set<int> added;
            for (int i : locationTrie.prefix(prefix)) {
                if (!added.insert(i).second || !g.nodes[i].active) continue;
                const MapNode& node = g.nodes[i];
                result += separator + "{\"id\":" + Q(node.id) + ",\"name\":" + Q(node.name) + "}";
                separator = ",";
            }
            return result + "]";
        }
        if (c == "remember") {
            const int i = idx(a);
            if (i < 0) return err("Unknown location");
            recent.add(g.nodes[i].id);
            return "{\"ok\":true,\"msg\":\"Location saved\"}";
        }
        if (c == "recent") {
            std::string result = "[", separator;
            for (const std::string& id : recent.values()) {
                result += separator + Q(id);
                separator = ",";
            }
            return result + "]";
        }
        if (c == "nextrecent") {
            const std::string* id = recent.next();
            if (!id) return err("No recently selected locations");
            const int i = idx(*id);
            if (i < 0) return err("Recently selected location is no longer available");
            return "{\"ok\":true,\"id\":" + Q(*id) + ",\"name\":" + Q(g.nodes[i].name) + "}";
        }
        if (c == "route") {
            int i = idx(a); if (i < 0) return err("Unknown location");
            if (b == "to") {
                const int destination = idx(d);
                if (destination < 0) return err("Unknown destination");
                if (g.nodes[destination].crowded || g.nodes[destination].blocked) {
                    return err("That destination is blocked or crowded");
                }
                return pathJson(planIf(i, [&](int node) { return node == destination; }, true));
            }
            return nearest(i, b == "center" ? Kind::Center : Kind::Exit, d == "distance");
        }

        if (c == "find") {                                     // find <ID> alarm|extinguisher|hose|refuge|exit|center
            int i = idx(a); if (i < 0) return err("Unknown location");
            const bool shortestDistance = d == "distance";
            if (b == "exit") return pathJson(planIf(i, [&](int x) {
                return g.nodes[x].kind == Kind::Exit && !g.nodes[x].crowded;
            }, shortestDistance));
            if (b == "center") return nearest(i, Kind::Center, shortestDistance);
            int bit = b == "alarm" ? TAG_FACP : b == "extinguisher" ? TAG_FE : b == "hose" ? TAG_HOSE : b == "refuge" ? TAG_REFUGE : 0;
            if (!bit) return err("Usage: find ID alarm|extinguisher|hose|refuge|exit|center");
            return pathJson(planIf(i, [&](int x) { return (g.nodes[x].tags & bit) != 0; }, shortestDistance)); }
        if (c == "contacts")                                    // numbers + steps printed on every evacuation plan
            return "{\"ok\":true,\"contacts\":[{\"name\":\"MCL Security Office\",\"number\":\"local 4099\"},"
                   "{\"name\":\"Cabuyao PNP\",\"number\":\"(049) 502 6535 / 0927 952 2360\"},"
                   "{\"name\":\"Cabuyao Fire Station\",\"number\":\"(049) 544 5628 / 0932 741 1457\"}],"
                   "\"relay\":[\"What is your name?\",\"What happened?\",\"Where are you?\",\"Is anyone hurt?\"],"
                   "\"fire\":[\"Raise the alarm - use the closest Fire Alarm Call Point\",\"Call the fire service\","
                   "\"Leave the building through the nearest fire exit\",\"Do NOT stop to collect personal belongings\","
                   "\"Do NOT use the elevator\",\"Go straight to the assembly point: MCL Track Oval\"]}";
        if (c == "oval") {                                      // approx. distance from every floor to the Oval
            std::string s = "[", sep;
            for (int f = 1; f <= FLOORS; ++f) {
                int from = idx("F" + std::to_string(f) + "CJ"); if (from < 0) continue;
                RouteInfo r = plan(from, Kind::Center);
                s += sep + "{\"floor\":" + std::to_string(f);
                if (r.path.empty()) s += ",\"meters\":-1,\"cutoff\":true}";
                else s += ",\"meters\":" + std::to_string(r.meters) + ",\"approx\":" + std::to_string((r.meters + 5) / 10 * 10) +
                          ",\"exit\":" + Q(r.exit) + ",\"toExit\":" + std::to_string(r.toExit) + ",\"toOval\":" + std::to_string(r.meters - r.toExit) +
                          ",\"steps\":" + std::to_string(r.path.size() - 1) + "}";
                sep = ",";
            }
            return s + "]"; }

        if (c == "ranked") {                                   // every exit/center, shortest distance first
            int from = idx(a); if (from < 0) return err("Unknown location");
            MaxHeap<Ranked> ranked;
            for (size_t i = 0; i < g.nodes.size(); ++i)
                if (g.nodes[i].active && !g.nodes[i].blocked && !g.nodes[i].crowded &&
                    (g.nodes[i].kind == Kind::Exit || g.nodes[i].kind == Kind::Center)) {
                    auto p = g.dijkstra(from, [&](int x) { return x == static_cast<int>(i); }); if (p.empty()) continue;
                    int m = 0; for (size_t k = 1; k < p.size(); ++k) m += g.meters(p[k - 1], p[k]);
                    ranked.push({static_cast<int>(i), m}); }
            std::vector<Ranked> r;
            while (!ranked.empty()) r.push_back(ranked.pop());
            std::reverse(r.begin(), r.end());
            std::string s = "[", sep; for (auto& x : r) { s += sep + "{\"id\":" + Q(g.nodes[x.idx].id) + ",\"meters\":" + std::to_string(x.meters) + "}"; sep = ","; }
            return s + "]"; }

        if (c == "crowd") {
            const int i = idx(a);
            if (i < 0) return err("Unknown location");
            if (g.nodes[i].kind != Kind::Hall && g.nodes[i].kind != Kind::Exit) {
                return err("Crowding can only be reported at a hallway or exit");
            }
            g.nodes[i].crowded = !g.nodes[i].crowded;
            return exec("status");
        }
        if (c == "simulatefire") {
            if (fireSimulation) {
                for (const auto& state : previousBlocked) g.nodes[state.first].blocked = state.second;
                for (const auto& state : previousCrowded) g.nodes[state.first].crowded = state.second;
                fireSimulation = false;
                fireSimulationNode = -1;
                previousBlocked.clear();
                previousCrowded.clear();
                return exec("status");
            }

            const int fire = idx(a.empty() ? "F3CJ" : a);
            if (fire < 0 || g.nodes[fire].floor < 1 ||
                (g.nodes[fire].kind != Kind::Room && g.nodes[fire].kind != Kind::Hall)) {
                return err("Choose an indoor room or hallway for the fire simulation");
            }
            fireSimulation = true;
            fireSimulationNode = fire;
            previousBlocked.push_back({fire, g.nodes[fire].blocked});
            g.nodes[fire].blocked = true;

            const int floor = g.nodes[fire].floor;
            for (const std::string& stairId : {"F" + std::to_string(floor) + "WS",
                                               "F" + std::to_string(floor) + "ES"}) {
                const int stair = idx(stairId);
                if (stair < 0) continue;
                previousCrowded.push_back({stair, g.nodes[stair].crowded});
                g.nodes[stair].crowded = true;
            }
            ++hazardEvents;
            return exec("status");
        }

        if (c == "hazard") {                                   // hazard <node>  or  hazard <nodeA> <nodeB> (blocks the hallway between)
            int i = idx(a); if (i < 0) return err("Unknown location");
            if (b.empty()) { hist.push({i, -1, g.nodes[i].blocked}); g.nodes[i].blocked = !g.nodes[i].blocked; }
            else { int j = idx(b); if (j < 0) return err("Unknown location");
                   if (!g.hasEdge(i, j)) return err("Those two places are not directly connected");
                   bool was = g.edgeBlocked(i, j); hist.push({i, j, was}); g.setEdgeBlocked(i, j, !was); }
            ++hazardEvents; return exec("status"); }
        if (c == "undo") { if (hist.empty()) return err("Nothing to undo");
            HazardAct h = hist.pop(); if (h.b < 0) g.nodes[h.a].blocked = h.before; else g.setEdgeBlocked(h.a, h.b, h.before);
            return exec("status"); }

        if (c == "register") {                                 // register <userId> <name> <node>   (add or update)
            int i = idx(d); if (a.empty() || i < 0) return err("Usage: register USER NAME NODE");
            Person* p = people.find([&](const Person& x) { return x.id == a; });
            if (p) { p->name = unus(b); p->node = i; } else people.add({a, unus(b), i, false});
            return "{\"ok\":true,\"msg\":\"Registered\"}"; }
        if (c == "unregister") { if (!people.removeIf([&](const Person& x) { return x.id == a; })) return err("Unknown user");
            return "{\"ok\":true,\"msg\":\"Removed\"}"; }
        if (c == "sos") {                                       // sos <userId> <name> <node> <kind>
            int i = idx(d); if (i < 0) return err("Unknown location");
            Person* p = people.find([&](const Person& x) { return x.id == a; });
            if (p) p->node = i; else people.add({a, unus(b), i, false});
            sosQ.enqueue({++ticket, a, i, e.empty() ? "distress" : e});
            return "{\"ok\":true,\"ticket\":" + std::to_string(ticket) + ",\"queue\":" + std::to_string(sosQ.size()) + ",\"route\":" +
                   nearest(i, Kind::Center, f5 == "distance") + "}"; }
        if (c == "next") { if (sosQ.empty()) return err("Dispatch queue is empty"); Sos s = sosQ.dequeue(); ++handled;
            return "{\"ok\":true,\"ticket\":" + std::to_string(s.ticket) + ",\"user\":" + Q(s.user) + ",\"at\":" + Q(g.nodes[s.node].id) + ",\"kind\":" + Q(s.kind) + "}"; }
        if (c == "checkin") { Person* p = people.find([&](const Person& x) { return x.id == a; });
            if (!p) return err("Unknown user - send an SOS or register first");
            p->in = true; return "{\"ok\":true,\"msg\":\"Checked in - you are accounted for\"}"; }

        if (c == "addroom") {                                  // addroom <ID> <NAME> <FLOOR> <LINK_ID> <METERS>
            int fl = 0, m = 0;
            if (a.empty() || !toInt(d, fl) || fl < 1 || fl > FLOORS || !toInt(f5, m) || m <= 0) return err("Usage: addroom ID NAME FLOOR LINK_ID METERS");
            if (idx(a) >= 0) return err("ID already exists");
            int l = idx(e); if (l < 0) return err("Unknown link location");
            int n = g.addNode(a, unus(b), Kind::Room, fl, g.nodes[l].x + 6, g.nodes[l].y + 8); g.addEdge(n, l, m);
            rebuildIndex(); floorNode[fl]->add(unus(b));
            return "{\"ok\":true,\"msg\":\"Room added\"}"; }
        if (c == "delroom") { int i = idx(a); if (i < 0) return err("Unknown location");
            if (g.nodes[i].kind != Kind::Room) return err("Only rooms can be deleted");
            root.removeDeep(g.nodes[i].name); g.removeNode(i); rebuildIndex();
            return "{\"ok\":true,\"msg\":\"Room deleted\"}"; }

        if (c == "status") {
            std::vector<int> bl; for (size_t i = 0; i < g.nodes.size(); ++i) if (g.nodes[i].active && g.nodes[i].blocked) bl.push_back((int)i);
            std::vector<int> crowded;
            for (size_t i = 0; i < g.nodes.size(); ++i) {
                if (g.nodes[i].active && g.nodes[i].crowded) crowded.push_back(static_cast<int>(i));
            }
            std::string un, sep, be, sep2;
            people.forEach([&](Person& p) { if (!p.in) { un += sep + Q(p.name); sep = ","; } });
            for (size_t x = 0; x < g.adj.size(); ++x) for (auto& ed : g.adj[x]) if ((int)x < ed.to && ed.blocked) {
                be += sep2 + "[" + Q(g.nodes[x].id) + "," + Q(g.nodes[ed.to].id) + "]"; sep2 = ","; }
            return "{\"ok\":true,\"queue\":" + std::to_string(sosQ.size()) +
                   ",\"unaccounted\":[" + un + "],\"cutoff\":" + list(g.cutOff()) +
                   ",\"blocked\":" + list(bl) + ",\"crowded\":" + list(crowded) +
                   ",\"blockedEdges\":[" + be + "],\"emergency\":" +
                   (fireSimulation ? "true" : "false") + ",\"fireAt\":" +
                   (fireSimulationNode < 0 ? "null" : Q(g.nodes[fireSimulationNode].id)) + "}"; }
        if (c == "report") { int in = 0; people.forEach([&](Person& p) { if (p.in) ++in; });
            return "{\"ok\":true,\"sosTotal\":" + std::to_string(ticket) + ",\"handled\":" + std::to_string(handled) + ",\"pending\":" + std::to_string(sosQ.size()) +
                ",\"people\":" + std::to_string(people.size()) + ",\"checkedIn\":" + std::to_string(in) + ",\"unaccounted\":" + std::to_string(people.size() - in) +
                ",\"hazardEvents\":" + std::to_string(hazardEvents) + "}"; }
        return err("Unknown command");
    }
};
