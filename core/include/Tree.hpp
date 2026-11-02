// Campus hierarchy plus binary-tree indexes used by the location directory.
#pragma once

#include <algorithm>
#include <map>
#include <memory>
#include <string>
#include <vector>
#include "ds.hpp"

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
class BinarySearchTree : public BinaryTree<T> {
    using Node = typename BinaryTree<T>::Node;

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
    void insert(const T& value) { insert(this->root, value); }
    bool contains(const T& value) const { return contains(this->root.get(), value); }
};

class AvlIndex {
    struct Node {
        std::string key;
        int value;
        int height = 1;
        std::unique_ptr<Node> left;
        std::unique_ptr<Node> right;

        Node(const std::string& item, int index) : key(item), value(index) {}
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
        const std::string& key,
        int value
    ) {
        if (!node) return std::make_unique<Node>(key, value);

        if (key < node->key) {
            node->left = insert(std::move(node->left), key, value);
        } else if (node->key < key) {
            node->right = insert(std::move(node->right), key, value);
        } else {
            node->value = value;
            return node;
        }

        updateHeight(node.get());
        const int difference = balance(node.get());
        if (difference > 1) {
            if (node->left && node->left->key < key) {
                node->left = rotateLeft(std::move(node->left));
            }
            return rotateRight(std::move(node));
        }
        if (difference < -1) {
            if (node->right && key < node->right->key) {
                node->right = rotateRight(std::move(node->right));
            }
            return rotateLeft(std::move(node));
        }
        return node;
    }

public:
    void clear() { root.reset(); }

    void insert(const std::string& key, int value) {
        root = insert(std::move(root), key, value);
    }

    int find(const std::string& key) const {
        const Node* current = root.get();
        while (current) {
            if (key == current->key) return current->value;
            current = key < current->key ? current->left.get() : current->right.get();
        }
        return -1;
    }
};

class Trie {
    struct Node {
        std::map<char, std::unique_ptr<Node>> children;
        std::vector<int> matches;
    };

    Node root;

public:
    void clear() { root = Node{}; }

    void insert(const std::string& word, int index) {
        Node* current = &root;
        for (char letter : word) {
            auto& child = current->children[letter];
            if (!child) child = std::make_unique<Node>();
            current = child.get();
            if (current->matches.empty() || current->matches.back() != index) {
                current->matches.push_back(index);
            }
        }
    }

    std::vector<int> prefix(const std::string& word, size_t limit = 12) const {
        const Node* current = &root;
        for (char letter : word) {
            auto child = current->children.find(letter);
            if (child == current->children.end()) return {};
            current = child->second.get();
        }
        std::vector<int> result;
        for (int index : current->matches) {
            result.push_back(index);
            if (result.size() == limit) break;
        }
        return result;
    }
};

struct TreeNode {
    std::string label;
    LinkedList<TreeNode*> children;

    explicit TreeNode(const std::string& value) : label(value) {}

    TreeNode(const TreeNode&) = delete;
    TreeNode& operator=(const TreeNode&) = delete;

    ~TreeNode() {
        children.forEach([](TreeNode* child) { delete child; });
    }

    TreeNode* add(const std::string& value) {
        TreeNode* child = new TreeNode(value);
        children.add(child);
        return child;
    }

    bool removeDeep(const std::string& value) {
        TreeNode** match = children.find(
            [&](TreeNode* child) { return child->label == value; }
        );

        if (match) {
            TreeNode* child = *match;
            children.removeIf([&](TreeNode* item) { return item == child; });
            delete child;
            return true;
        }

        bool removed = false;
        children.forEach([&](TreeNode* child) {
            if (!removed && child->removeDeep(value)) removed = true;
        });
        return removed;
    }

    std::string json() {
        std::string result = "{\"n\":\"" + label + "\",\"c\":[";
        std::string separator;

        children.forEach([&](TreeNode* child) {
            result += separator + child->json();
            separator = ",";
        });
        return result + "]}";
    }
};
