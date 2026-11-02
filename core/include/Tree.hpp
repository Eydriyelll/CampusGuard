// Location hierarchy: Campus -> Building -> Floor -> Room.
#pragma once

#include <string>
#include "ds.hpp"

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
