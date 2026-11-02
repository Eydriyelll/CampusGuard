// Learning example: a circular list. App lists are in ../include/ds.hpp.
#pragma once

#include <cstddef>
#include <vector>

template <class T>
class CircularList {
    struct Node {
        T value;
        Node* next;
    };

    Node* tail = nullptr;
    size_t count = 0;

public:
    CircularList() = default;
    CircularList(const CircularList&) = delete;
    CircularList& operator=(const CircularList&) = delete;

    ~CircularList() { clear(); }

    void add(const T& value) {
        Node* newNode = new Node{value, nullptr};

        if (!tail) {
            tail = newNode;
            newNode->next = newNode;
        } else {
            newNode->next = tail->next;
            tail->next = newNode;
            tail = newNode;
        }
        ++count;
    }

    bool empty() const { return tail == nullptr; }
    size_t size() const { return count; }

    std::vector<T> values() const {
        std::vector<T> result;
        if (!tail) return result;

        const Node* first = tail->next;
        const Node* current = first;
        do {
            result.push_back(current->value);
            current = current->next;
        } while (current != first);
        return result;
    }

    void clear() {
        if (!tail) return;

        Node* first = tail->next;
        tail->next = nullptr;
        while (first) {
            Node* next = first->next;
            delete first;
            first = next;
        }
        tail = nullptr;
        count = 0;
    }
};
