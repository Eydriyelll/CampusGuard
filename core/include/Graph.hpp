// A graph of rooms and hallways. BFS and Dijkstra plan routes; DFS finds cut-off rooms.
#pragma once

#include <algorithm>
#include <limits>
#include <string>
#include <vector>
#include "ds.hpp"

enum class Kind { Room = 0, Hall = 1, Exit = 2, Center = 3 };

constexpr int TAG_FACP = 1;
constexpr int TAG_FE = 2;
constexpr int TAG_HOSE = 4;
constexpr int TAG_REFUGE = 8;
constexpr int TAG_FIREEXIT = 16;

struct MapNode {
    std::string id;
    std::string name;
    Kind kind;
    int floor;
    double x;
    double y;
    bool blocked = false;
    bool crowded = false;
    bool active = true;
    int tags = 0;
};

struct Edge {
    int to;
    int meters;
    bool blocked = false;
};

class Graph {
public:
    std::vector<MapNode> nodes;
    std::vector<std::vector<Edge>> adj;

    int addNode(
        const std::string& id,
        const std::string& name,
        Kind kind,
        int floor,
        double x,
        double y
    ) {
        nodes.push_back({id, name, kind, floor, x, y, false, false, true});
        adj.emplace_back();
        return static_cast<int>(nodes.size()) - 1;
    }

    void addEdge(int first, int second, int meters) {
        adj[first].push_back({second, meters, false});
        adj[second].push_back({first, meters, false});
    }

    // Keep node indexes stable when a room is removed.
    void removeNode(int index) {
        for (const Edge& edge : adj[index]) {
            auto& neighborEdges = adj[edge.to];
            neighborEdges.erase(
                std::remove_if(
                    neighborEdges.begin(),
                    neighborEdges.end(),
                    [&](const Edge& neighbor) { return neighbor.to == index; }
                ),
                neighborEdges.end()
            );
        }
        adj[index].clear();
        nodes[index].active = false;
    }

    int meters(int first, int second) const {
        for (const Edge& edge : adj[first]) {
            if (edge.to == second) return edge.meters;
        }
        return 0;
    }

    bool hasEdge(int first, int second) const {
        for (const Edge& edge : adj[first]) {
            if (edge.to == second) return true;
        }
        return false;
    }

    bool edgeBlocked(int first, int second) const {
        for (const Edge& edge : adj[first]) {
            if (edge.to == second) return edge.blocked;
        }
        return false;
    }

    bool setEdgeBlocked(int first, int second, bool blocked) {
        bool found = false;
        for (Edge& edge : adj[first]) {
            if (edge.to == second) {
                edge.blocked = blocked;
                found = true;
            }
        }
        for (Edge& edge : adj[second]) {
            if (edge.to == first) edge.blocked = blocked;
        }
        return found;
    }

    // Search by number of connections; among equal-length routes, prefer fewer meters.
    template <class Goal>
    std::vector<int> bfs(int start, Goal isGoal) const {
        std::vector<int> parent(nodes.size(), -2);
        std::vector<int> level(nodes.size(), 0);
        std::vector<int> distance(nodes.size(), 0);
        Queue<int> frontier;
        int best = -1;

        parent[start] = -1;
        frontier.enqueue(start);

        while (!frontier.empty()) {
            const int current = frontier.dequeue();
            if (best != -1 && level[current] > level[best]) break;

            if (isGoal(current)) {
                if (best == -1 || distance[current] < distance[best]) best = current;
                continue;
            }

            for (const Edge& edge : adj[current]) {
                const int next = edge.to;
                if (edge.blocked || nodes[next].blocked || nodes[next].crowded || !nodes[next].active) continue;

                const int nextLevel = level[current] + 1;
                const int nextDistance = distance[current] + edge.meters;
                if (parent[next] == -2) {
                    parent[next] = current;
                    level[next] = nextLevel;
                    distance[next] = nextDistance;
                    frontier.enqueue(next);
                } else if (level[next] == nextLevel && nextDistance < distance[next]) {
                    parent[next] = current;
                    distance[next] = nextDistance;
                }
            }
        }

        if (best == -1) return {};

        std::vector<int> path;
        for (int current = best; current != -1; current = parent[current]) {
            path.push_back(current);
        }
        std::reverse(path.begin(), path.end());
        return path;
    }

    template <class Goal>
    std::vector<int> dijkstra(int start, Goal isGoal) const {
        struct Candidate {
            int meters;
            int node;

            bool operator<(const Candidate& other) const {
                if (meters != other.meters) return meters > other.meters;
                return node > other.node;
            }
        };

        if (start < 0 || static_cast<size_t>(start) >= nodes.size() ||
            !nodes[start].active) return {};

        const int infinity = std::numeric_limits<int>::max();
        std::vector<int> distance(nodes.size(), infinity);
        std::vector<int> parent(nodes.size(), -2);
        MaxHeap<Candidate> pending;
        distance[start] = 0;
        parent[start] = -1;
        pending.push({0, start});

        while (!pending.empty()) {
            const Candidate current = pending.pop();
            if (current.meters != distance[current.node]) continue;
            if (isGoal(current.node)) {
                std::vector<int> path;
                for (int index = current.node; index != -1; index = parent[index]) {
                    path.push_back(index);
                }
                std::reverse(path.begin(), path.end());
                return path;
            }

            for (const Edge& edge : adj[current.node]) {
                const int next = edge.to;
                if (edge.blocked || edge.meters < 0 || nodes[next].blocked ||
                    nodes[next].crowded || !nodes[next].active) continue;
                if (current.meters > infinity - edge.meters) continue;

                const int nextDistance = current.meters + edge.meters;
                if (nextDistance >= distance[next]) continue;
                distance[next] = nextDistance;
                parent[next] = current.node;
                pending.push({nextDistance, next});
            }
        }
        return {};
    }

    // Start at each open exit; rooms not reached by DFS are cut off.
    std::vector<int> cutOff() const {
        std::vector<char> visited(nodes.size(), 0);
        Stack<int> pending;

        for (size_t i = 0; i < nodes.size(); ++i) {
            const MapNode& node = nodes[i];
            if (node.active && node.kind == Kind::Exit && !node.blocked && !node.crowded) {
                visited[i] = 1;
                pending.push(static_cast<int>(i));
            }
        }

        while (!pending.empty()) {
            const int current = pending.pop();
            for (const Edge& edge : adj[current]) {
                const int next = edge.to;
                if (visited[next] || edge.blocked || nodes[next].blocked ||
                    nodes[next].crowded) continue;
                visited[next] = 1;
                pending.push(next);
            }
        }

        std::vector<int> cutOffRooms;
        for (size_t i = 0; i < nodes.size(); ++i) {
            const MapNode& node = nodes[i];
            const bool indoor = node.kind == Kind::Room || node.kind == Kind::Hall;
            if (node.active && node.floor >= 1 && !visited[i] && !node.blocked && indoor) {
                cutOffRooms.push_back(static_cast<int>(i));
            }
        }
        return cutOffRooms;
    }
};
