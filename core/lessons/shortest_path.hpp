// Learning example: Dijkstra finds the least-distance route with nonnegative edge weights.
#pragma once

#include <limits>
#include <functional>
#include <queue>
#include <utility>
#include <vector>

inline std::vector<int> dijkstraDistances(
    const std::vector<std::vector<std::pair<int, int>>>& graph,
    int start
) {
    const int infinity = std::numeric_limits<int>::max();
    std::vector<int> distance(graph.size(), infinity);
    using Next = std::pair<int, int>;
    std::priority_queue<Next, std::vector<Next>, std::greater<Next>> pending;

    distance[start] = 0;
    pending.push({0, start});

    while (!pending.empty()) {
        const int currentDistance = pending.top().first;
        const int current = pending.top().second;
        pending.pop();

        if (currentDistance != distance[current]) continue;

        for (const auto& edge : graph[current]) {
            const int next = edge.first;
            const int meters = edge.second;
            if (currentDistance > infinity - meters) continue;

            const int newDistance = currentDistance + meters;
            if (newDistance >= distance[next]) continue;
            distance[next] = newDistance;
            pending.push({newDistance, next});
        }
    }
    return distance;
}
