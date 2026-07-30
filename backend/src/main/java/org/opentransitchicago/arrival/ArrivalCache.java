package org.opentransitchicago.arrival;

import java.time.Duration;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;

final class ArrivalCache {
    private final Duration ttl;
    private final int capacity;
    private final LinkedHashMap<String, Entry> entries = new LinkedHashMap<>(16, 0.75f, true);

    ArrivalCache(Duration ttl, int capacity) {
        this.ttl = ttl;
        this.capacity = capacity;
    }

    synchronized ArrivalBatch get(String key, Instant now) {
        Entry entry = entries.get(key);
        if (entry == null) {
            return null;
        }
        if (!now.isBefore(entry.expiresAt())) {
            entries.remove(key);
            return null;
        }
        return entry.value();
    }

    synchronized void put(String key, ArrivalBatch value, Instant now) {
        entries.put(key, new Entry(value, now.plus(ttl)));
        while (entries.size() > capacity) {
            String eldest = entries.entrySet().iterator().next().getKey();
            entries.remove(eldest);
        }
    }

    synchronized int size() {
        return entries.size();
    }

    synchronized boolean contains(String key) {
        return entries.containsKey(key);
    }

    private record Entry(ArrivalBatch value, Instant expiresAt) {
    }
}
