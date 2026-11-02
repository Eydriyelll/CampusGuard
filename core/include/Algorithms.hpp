// Merge sort and binary search for room IDs.
#pragma once

#include <vector>

template <class T, class Compare>
void mergeSortRange(
    std::vector<T>& values,
    int start,
    int end,
    Compare comesBefore,
    std::vector<T>& temporary
) {
    if (end - start < 2) return;

    const int middle = (start + end) / 2;
    mergeSortRange(values, start, middle, comesBefore, temporary);
    mergeSortRange(values, middle, end, comesBefore, temporary);

    int left = start;
    int right = middle;
    int out = start;

    while (left < middle && right < end) {
        if (comesBefore(values[right], values[left])) {
            temporary[out++] = values[right++];
        } else {
            temporary[out++] = values[left++];
        }
    }

    while (left < middle) temporary[out++] = values[left++];
    while (right < end) temporary[out++] = values[right++];

    for (int i = start; i < end; ++i) values[i] = temporary[i];
}

template <class T, class Compare>
void mergeSort(std::vector<T>& values, Compare comesBefore) {
    std::vector<T> temporary(values.size());
    mergeSortRange(values, 0, static_cast<int>(values.size()), comesBefore, temporary);
}

// The vector must be sorted by keyOf(). Returns the matching index, or -1.
template <class T, class Key, class GetKey>
int binarySearch(const std::vector<T>& values, const Key& wanted, GetKey keyOf) {
    int low = 0;
    int high = static_cast<int>(values.size()) - 1;

    while (low <= high) {
        const int middle = low + (high - low) / 2;
        const auto key = keyOf(values[middle]);

        if (key == wanted) return middle;
        if (key < wanted) {
            low = middle + 1;
        } else {
            high = middle - 1;
        }
    }
    return -1;
}
