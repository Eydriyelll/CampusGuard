// Simple data structures used by the campus application.
#pragma once

#include <cstddef>

template <class T>
class LinkedList {
    struct Node {
        T value;
        Node* next;
    };

    Node* head = nullptr;
    Node* tail = nullptr;
    size_t count = 0;

public:
    LinkedList() = default;
    LinkedList(const LinkedList&) = delete;
    LinkedList& operator=(const LinkedList&) = delete;

    ~LinkedList() { clear(); }

    void clear() {
        while (head) {
            Node* oldHead = head;
            head = head->next;
            delete oldHead;
        }
        tail = nullptr;
        count = 0;
    }

    void add(const T& value) {
        Node* newNode = new Node{value, nullptr};
        if (tail) {
            tail->next = newNode;
        } else {
            head = newNode;
        }
        tail = newNode;
        ++count;
    }

    template <class Predicate>
    T* find(Predicate matches) {
        for (Node* current = head; current; current = current->next) {
            if (matches(current->value)) return &current->value;
        }
        return nullptr;
    }

    template <class Predicate>
    bool removeIf(Predicate matches) {
        Node* previous = nullptr;
        Node* current = head;

        while (current) {
            if (matches(current->value)) {
                if (previous) {
                    previous->next = current->next;
                } else {
                    head = current->next;
                }
                if (current == tail) tail = previous;
                delete current;
                --count;
                return true;
            }
            previous = current;
            current = current->next;
        }
        return false;
    }

    template <class Function>
    void forEach(Function visit) {
        for (Node* current = head; current; current = current->next) {
            visit(current->value);
        }
    }

    size_t size() const { return count; }
};

template <class T>
class DoublyLinkedList {
    struct Node {
        T value;
        Node* previous;
        Node* next;
    };

    Node* head = nullptr;
    Node* tail = nullptr;
    size_t count = 0;

public:
    DoublyLinkedList() = default;
    DoublyLinkedList(const DoublyLinkedList&) = delete;
    DoublyLinkedList& operator=(const DoublyLinkedList&) = delete;

    ~DoublyLinkedList() { clear(); }

    void clear() {
        while (head) {
            Node* oldHead = head;
            head = head->next;
            delete oldHead;
        }
        tail = nullptr;
        count = 0;
    }

    void add(const T& value) {
        Node* newNode = new Node{value, tail, nullptr};
        if (tail) {
            tail->next = newNode;
        } else {
            head = newNode;
        }
        tail = newNode;
        ++count;
    }

    template <class Predicate>
    T* find(Predicate matches) {
        for (Node* current = head; current; current = current->next) {
            if (matches(current->value)) return &current->value;
        }
        return nullptr;
    }

    template <class Predicate>
    bool removeIf(Predicate matches) {
        for (Node* current = head; current; current = current->next) {
            if (!matches(current->value)) continue;

            if (current->previous) {
                current->previous->next = current->next;
            } else {
                head = current->next;
            }
            if (current->next) {
                current->next->previous = current->previous;
            } else {
                tail = current->previous;
            }
            delete current;
            --count;
            return true;
        }
        return false;
    }

    template <class Function>
    void forEach(Function visit) {
        for (Node* current = head; current; current = current->next) {
            visit(current->value);
        }
    }

    size_t size() const { return count; }
};

template <class T>
class Stack {
    struct Node {
        T value;
        Node* next;
    };

    Node* topNode = nullptr;
    size_t count = 0;

public:
    Stack() = default;
    Stack(const Stack&) = delete;
    Stack& operator=(const Stack&) = delete;

    ~Stack() {
        while (!empty()) pop();
    }

    void push(const T& value) {
        topNode = new Node{value, topNode};
        ++count;
    }

    T pop() {
        Node* oldTop = topNode;
        T value = oldTop->value;
        topNode = oldTop->next;
        delete oldTop;
        --count;
        return value;
    }

    bool empty() const { return topNode == nullptr; }
    size_t size() const { return count; }
};

template <class T>
class Queue {
    struct Node {
        T value;
        Node* next;
    };

    Node* head = nullptr;
    Node* tail = nullptr;
    size_t count = 0;

public:
    Queue() = default;
    Queue(const Queue&) = delete;
    Queue& operator=(const Queue&) = delete;

    ~Queue() {
        while (!empty()) dequeue();
    }

    void enqueue(const T& value) {
        Node* newNode = new Node{value, nullptr};
        if (tail) {
            tail->next = newNode;
        } else {
            head = newNode;
        }
        tail = newNode;
        ++count;
    }

    T dequeue() {
        Node* oldHead = head;
        T value = oldHead->value;
        head = oldHead->next;
        if (!head) tail = nullptr;
        delete oldHead;
        --count;
        return value;
    }

    bool empty() const { return head == nullptr; }
    size_t size() const { return count; }
};
