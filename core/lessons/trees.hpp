// Small tree examples for learning; the app's campus tree is in ../include/Tree.hpp.
#pragma once

#include <algorithm>
#include <map>
#include <memory>
#include <string>
#include <utility>
#include <vector>

template <class T>
class BinaryTree {
public:
    struct Node {
        T value;
        std::unique_ptr<Node> left;
        std::unique_ptr<Node> right;

        explicit Node(const T& item) : value(item) {}
    };

    std::unique_ptr<Node> root;

    void addLeft(Node* parent, const T& value) {
        parent->left = std::make_unique<Node>(value);
    }

    void addRight(Node* parent, const T& value) {
        parent->right = std::make_unique<Node>(value);
    }
};

template <class T>
class BinarySearchTree {
    struct Node {
        T value;
        std::unique_ptr<Node> left;
        std::unique_ptr<Node> right;

        explicit Node(const T& item) : value(item) {}
    };

    std::unique_ptr<Node> root;

    static void insert(std::unique_ptr<Node>& node, const T& value) {
        if (!node) {
            node = std::make_unique<Node>(value);
        } else if (value < node->value) {
            insert(node->left, value);
        } else if (node->value < value) {
            insert(node->right, value);
        }
    }

    static bool contains(const Node* node, const T& value) {
        if (!node) return false;
        if (value == node->value) return true;
        return value < node->value
            ? contains(node->left.get(), value)
            : contains(node->right.get(), value);
    }

public:
    void insert(const T& value) { insert(root, value); }
    bool contains(const T& value) const { return contains(root.get(), value); }
};

template <class T>
class AvlTree {
    struct Node {
        T value;
        int height = 1;
        std::unique_ptr<Node> left;
        std::unique_ptr<Node> right;

        explicit Node(const T& item) : value(item) {}
    };

    std::unique_ptr<Node> root;

    static int height(const std::unique_ptr<Node>& node) {
        return node ? node->height : 0;
    }

    static void updateHeight(Node* node) {
        node->height = 1 + std::max(height(node->left), height(node->right));
    }

    static int balance(const Node* node) {
        return height(node->left) - height(node->right);
    }

    static std::unique_ptr<Node> rotateRight(std::unique_ptr<Node> top) {
        auto newTop = std::move(top->left);
        top->left = std::move(newTop->right);
        updateHeight(top.get());
        newTop->right = std::move(top);
        updateHeight(newTop.get());
        return newTop;
    }

    static std::unique_ptr<Node> rotateLeft(std::unique_ptr<Node> top) {
        auto newTop = std::move(top->right);
        top->right = std::move(newTop->left);
        updateHeight(top.get());
        newTop->left = std::move(top);
        updateHeight(newTop.get());
        return newTop;
    }

    static std::unique_ptr<Node> insert(
        std::unique_ptr<Node> node,
        const T& value
    ) {
        if (!node) return std::make_unique<Node>(value);

        if (value < node->value) {
            node->left = insert(std::move(node->left), value);
        } else if (node->value < value) {
            node->right = insert(std::move(node->right), value);
        } else {
            return node;
        }

        updateHeight(node.get());
        const int difference = balance(node.get());

        if (difference > 1) {
            if (node->left && node->left->value < value) {
                node->left = rotateLeft(std::move(node->left));
            }
            return rotateRight(std::move(node));
        }

        if (difference < -1) {
            if (node->right && value < node->right->value) {
                node->right = rotateRight(std::move(node->right));
            }
            return rotateLeft(std::move(node));
        }
        return node;
    }

    static bool contains(const Node* node, const T& value) {
        if (!node) return false;
        if (value == node->value) return true;
        return value < node->value
            ? contains(node->left.get(), value)
            : contains(node->right.get(), value);
    }

public:
    void insert(const T& value) { root = insert(std::move(root), value); }
    bool contains(const T& value) const { return contains(root.get(), value); }
};

template <class T>
class MaxHeap {
    std::vector<T> values;

public:
    bool empty() const { return values.empty(); }
    size_t size() const { return values.size(); }

    void push(const T& value) {
        values.push_back(value);
        size_t child = values.size() - 1;

        while (child > 0) {
            const size_t parent = (child - 1) / 2;
            if (!(values[parent] < values[child])) break;
            std::swap(values[parent], values[child]);
            child = parent;
        }
    }

    T pop() {
        T largest = values.front();
        values.front() = values.back();
        values.pop_back();

        size_t parent = 0;
        while (parent * 2 + 1 < values.size()) {
            size_t largerChild = parent * 2 + 1;
            const size_t rightChild = largerChild + 1;

            if (rightChild < values.size() &&
                values[largerChild] < values[rightChild]) {
                largerChild = rightChild;
            }
            if (!(values[parent] < values[largerChild])) break;
            std::swap(values[parent], values[largerChild]);
            parent = largerChild;
        }
        return largest;
    }
};

class Trie {
    struct Node {
        std::map<char, std::unique_ptr<Node>> children;
        bool isWord = false;
    };

    Node root;

public:
    void insert(const std::string& word) {
        Node* current = &root;
        for (char letter : word) {
            auto& child = current->children[letter];
            if (!child) child = std::make_unique<Node>();
            current = child.get();
        }
        current->isWord = true;
    }

    bool contains(const std::string& word) const {
        const Node* current = &root;
        for (char letter : word) {
            auto child = current->children.find(letter);
            if (child == current->children.end()) return false;
            current = child->second.get();
        }
        return current->isWord;
    }
};
