package org.opentransitchicago.station;

import tools.jackson.databind.JsonNode;
import org.opentransitchicago.model.Station;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;

@Service
public class StationService {
    private static final Duration CACHE_DURATION = Duration.ofHours(12);
    private static final Map<String, String> ROUTE_FIELDS = Map.of(
            "red", "Red",
            "blue", "Blue",
            "g", "Green",
            "brn", "Brown",
            "p", "Purple",
            "pnk", "Pink",
            "o", "Orange",
            "y", "Yellow"
    );

    private final RestClient cityDataClient;
    private volatile List<Station> cachedStations = List.of();
    private volatile Instant cacheExpiresAt = Instant.EPOCH;

    public StationService(RestClient.Builder builder) {
        this.cityDataClient = builder.baseUrl("https://data.cityofchicago.org").build();
    }

    public List<Station> getStations() {
        if (Instant.now().isBefore(cacheExpiresAt) && !cachedStations.isEmpty()) {
            return cachedStations;
        }

        synchronized (this) {
            if (Instant.now().isBefore(cacheExpiresAt) && !cachedStations.isEmpty()) {
                return cachedStations;
            }

            JsonNode rows = cityDataClient.get()
                    .uri(uriBuilder -> uriBuilder
                            .path("/resource/8pix-ypme.json")
                            .queryParam("$limit", 1_000)
                            .build())
                    .retrieve()
                    .body(JsonNode.class);

            cachedStations = mapStations(rows);
            cacheExpiresAt = Instant.now().plus(CACHE_DURATION);
            return cachedStations;
        }
    }

    static List<Station> mapStations(JsonNode rows) {
        if (rows == null || !rows.isArray()) {
            return List.of();
        }

        Map<String, MutableStation> grouped = new LinkedHashMap<>();
        for (JsonNode row : rows) {
            String mapId = row.path("map_id").asText();
            JsonNode location = row.path("location");
            if (mapId.isBlank() || location.isMissingNode()) {
                continue;
            }

            MutableStation station = grouped.computeIfAbsent(mapId, ignored -> new MutableStation(
                    mapId,
                    row.path("station_name").asText("Unknown station"),
                    row.path("station_descriptive_name").asText(""),
                    location.path("latitude").asDouble(),
                    location.path("longitude").asDouble(),
                    row.path("ada").asBoolean(false)
            ));

            ROUTE_FIELDS.forEach((field, route) -> {
                if (row.path(field).asBoolean(false)) {
                    station.routes.add(route);
                }
            });
        }

        return grouped.values().stream()
                .map(MutableStation::toStation)
                .sorted((left, right) -> left.name().compareToIgnoreCase(right.name()))
                .toList();
    }

    private static final class MutableStation {
        private final String id;
        private final String name;
        private final String descriptiveName;
        private final double latitude;
        private final double longitude;
        private final boolean accessible;
        private final LinkedHashSet<String> routes = new LinkedHashSet<>();

        private MutableStation(String id, String name, String descriptiveName,
                               double latitude, double longitude, boolean accessible) {
            this.id = id;
            this.name = name;
            this.descriptiveName = descriptiveName;
            this.latitude = latitude;
            this.longitude = longitude;
            this.accessible = accessible;
        }

        private Station toStation() {
            return new Station(id, name, descriptiveName, latitude, longitude,
                    accessible, new ArrayList<>(routes));
        }
    }
}
