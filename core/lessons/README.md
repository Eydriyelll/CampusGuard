# DSA lessons

This folder contains small C++ examples for concepts that are not needed by the live
evacuation app. The examples can be built and checked with `./build_native.sh --lessons`.
The app's actual data structures and algorithms stay in `../include/`.

## Find a lesson

| Lesson | Code | How CampusGuard relates |
|---|---|---|
| Linked-list introduction | `../include/ds.hpp` | Each item is stored in a node connected to another node. |
| Singly linked list | `../include/ds.hpp` → `LinkedList` | Used for the campus location tree's child nodes. |
| Doubly linked list | `../include/ds.hpp` → `DoublyLinkedList` | Used for the people registry; links let removal reconnect both neighbors. |
| Circular linked list | `linked_lists.hpp` → `CircularList` | Standalone example; not needed by evacuation routing. |
| Stack | `../include/ds.hpp` → `Stack` | Stores hazard changes so the latest change can be undone first. |
| Queue | `../include/ds.hpp` → `Queue` | Stores SOS requests in arrival order and visits graph nodes for BFS. |
| General tree | `../include/Tree.hpp` → `TreeNode` | Organizes campus, building, floors, and rooms. |
| Binary tree | `trees.hpp` → `BinaryTree` | Standalone example with left and right children. |
| Binary search tree | `trees.hpp` → `BinarySearchTree` | Standalone example that orders values for lookup. |
| AVL tree | `trees.hpp` → `AvlTree` | Standalone balanced search-tree insertion example. |
| Heap | `trees.hpp` → `MaxHeap` | Standalone priority example; SOS dispatch remains FIFO. |
| Other tree: trie | `trees.hpp` → `Trie` | Standalone prefix-tree example. |
| Graph | `../include/Graph.hpp` → `Graph` | Models rooms and hallway connections. |
| Breadth-first search | `../include/Graph.hpp` → `Graph::bfs` | Finds a route by exploring nearby connections first. |
| Depth-first search | `../include/Graph.hpp` → `Graph::cutOff` | Finds rooms unreachable from every open exit. |
| Shortest-path algorithms | `shortest_path.hpp` → `dijkstraDistances` | Dijkstra is a standalone weighted-distance lesson. The app keeps its existing BFS route behavior. |
| Merge sort | `../include/Algorithms.hpp` → `mergeSort` | Sorts location IDs for the search index. |
| Binary search | `../include/Algorithms.hpp` → `binarySearch` | Looks up an ID in the sorted location index. |

`examples.cpp` runs small checks for the app's linked lists, stack, queue, tree, graph,
merge sort, and binary search, as well as the standalone circular list, binary tree, search
tree, AVL tree, heap, trie, and Dijkstra example.

## Keep app behavior clear

Examples marked standalone are study material, not emergency features. The app continues to
use BFS for routes and FIFO order for SOS dispatch; changing those choices would change how the
application behaves.
