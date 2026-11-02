// Run the small lesson examples: ./build_native.sh --lessons
#include <cassert>
#include <vector>
#include "../include/Algorithms.hpp"
#include "../include/Graph.hpp"
#include "../include/Tree.hpp"
#include "linked_lists.hpp"
#include "shortest_path.hpp"
#include "trees.hpp"

int main() {
    LinkedList<int> singly;
    singly.add(1);
    singly.add(2);
    assert(singly.size() == 2);
    assert(singly.removeIf([](int value) { return value == 1; }));

    DoublyLinkedList<int> doubly;
    doubly.add(1);
    doubly.add(2);
    doubly.add(3);
    assert(doubly.removeIf([](int value) { return value == 2; }));
    assert(doubly.size() == 2);

    CircularList<int> circular;
    circular.add(1);
    circular.add(2);
    assert((circular.values() == std::vector<int>{1, 2}));

    Stack<int> undo;
    undo.push(1);
    undo.push(2);
    assert(undo.pop() == 2);

    Queue<int> dispatch;
    dispatch.enqueue(1);
    dispatch.enqueue(2);
    assert(dispatch.dequeue() == 1);

    TreeNode campus("Campus");
    campus.add("Rizal Building")->add("Floor 1");
    assert(campus.json().find("Floor 1") != std::string::npos);

    Graph campusGraph;
    const int room = campusGraph.addNode("R1", "Room", Kind::Room, 1, 0, 0);
    const int hall = campusGraph.addNode("H1", "Hall", Kind::Hall, 1, 1, 0);
    const int exit = campusGraph.addNode("EX1", "Exit", Kind::Exit, 1, 2, 0);
    const int cutoff = campusGraph.addNode("R2", "Cut-off room", Kind::Room, 1, 4, 0);
    campusGraph.addEdge(room, hall, 5);
    campusGraph.addEdge(hall, exit, 5);
    assert((campusGraph.bfs(room, [&](int node) { return node == exit; }) ==
        std::vector<int>{room, hall, exit}));
    assert((campusGraph.cutOff() == std::vector<int>{cutoff}));

    std::vector<int> sorted{4, 1, 3, 2};
    mergeSort(sorted, [](int left, int right) { return left < right; });
    assert((sorted == std::vector<int>{1, 2, 3, 4}));
    assert(binarySearch(sorted, 3, [](int value) { return value; }) == 2);

    BinaryTree<int> binary;
    binary.root = std::make_unique<BinaryTree<int>::Node>(1);
    binary.addLeft(binary.root.get(), 2);
    binary.addRight(binary.root.get(), 3);
    assert(binary.root->left->value == 2);
    assert(binary.root->right->value == 3);

    BinarySearchTree<int> searchTree;
    for (int value : {4, 2, 6, 1, 3, 5, 7}) searchTree.insert(value);
    assert(searchTree.contains(5));
    assert(!searchTree.contains(8));

    AvlTree<int> balancedTree;
    for (int value : {1, 2, 3, 4, 5, 6, 7}) balancedTree.insert(value);
    assert(balancedTree.contains(1));
    assert(balancedTree.contains(7));

    MaxHeap<int> heap;
    for (int value : {3, 1, 5, 2, 4}) heap.push(value);
    std::vector<int> descending;
    while (!heap.empty()) descending.push_back(heap.pop());
    assert((descending == std::vector<int>{5, 4, 3, 2, 1}));

    Trie words;
    words.insert("campus");
    assert(words.contains("campus"));
    assert(!words.contains("camp"));

    std::vector<std::vector<std::pair<int, int>>> graph(4);
    graph[0] = {{1, 4}, {2, 1}};
    graph[1] = {{0, 4}, {3, 1}};
    graph[2] = {{0, 1}, {1, 2}, {3, 5}};
    graph[3] = {{1, 1}, {2, 5}};
    const auto distance = dijkstraDistances(graph, 0);
    assert((distance == std::vector<int>{0, 3, 1, 4}));
}
