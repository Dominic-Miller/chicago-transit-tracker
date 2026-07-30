package org.opentransitchicago.bus;

import java.time.Duration;
import java.time.Instant;
import java.util.LinkedHashMap;

final class BusCache<T> {
    private final Duration ttl;
    private final int capacity;
    private final LinkedHashMap<String, Entry<T>> entries = new LinkedHashMap<>(16, 0.75f, true);

    BusCache(Duration ttl, int capacity) {
        this.ttl = ttl;
        this.capacity = capacity;
    }

    synchronized T get(String key, Instant now) {
        Entry<T> entry = entries.get(key);
        if (entry == null) return null;
        if (!now.isBefore(entry.expiresAt())) {
            entries.remove(key);
            return null;
        }
        return entry.value();
    }

    synchronized void put(String key, T value, Instant now) {
        entries.put(key, new Entry<>(value, now.plus(ttl)));
        while (entries.size() > capacity) {
            entries.remove(entries.entrySet().iterator().next().getKey());
        }
    }

    synchronized int size() {
        return entries.size();
    }

    synchronized boolean contains(String key) {
        return entries.containsKey(key);
    }

    private record Entry<T>(T value, Instant expiresAt) {
    }
}
