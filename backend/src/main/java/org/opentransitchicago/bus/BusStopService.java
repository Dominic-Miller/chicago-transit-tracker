package org.opentransitchicago.bus;

import org.opentransitchicago.model.BusStop;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.server.ResponseStatusException;
import tools.jackson.databind.JsonNode;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;

@Service
public class BusStopService {
    private static final Duration CACHE_DURATION = Duration.ofHours(12);
    private final RestClient cityDataClient;
    private volatile List<BusStop> cachedStops = List.of();
    private volatile Instant cacheExpiresAt = Instant.EPOCH;

    public BusStopService(RestClient.Builder builder) {
        this.cityDataClient = builder.baseUrl("https://data.cityofchicago.org").build();
    }

    public List<BusStop> getStops() {
        if (Instant.now().isBefore(cacheExpiresAt) && !cachedStops.isEmpty()) return cachedStops;
        synchronized (this) {
            if (Instant.now().isBefore(cacheExpiresAt) && !cachedStops.isEmpty()) return cachedStops;
            JsonNode rows = cityDataClient.get()
                    .uri(uriBuilder -> uriBuilder.path("/resource/qs84-j7wh.json")
                            .queryParam("$limit", 20_000).build())
                    .retrieve().body(JsonNode.class);
            List<BusStop> mapped = mapStops(rows);
            if (mapped.isEmpty()) {
                throw new ResponseStatusException(HttpStatus.BAD_GATEWAY,
                        "Chicago bus stop data is temporarily unavailable");
            }
            cachedStops = mapped;
            cacheExpiresAt = Instant.now().plus(CACHE_DURATION);
            return cachedStops;
        }
    }

    public BusStop getStop(String stopId) {
        return getStops().stream().filter(stop -> stop.id().equals(stopId)).findFirst()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Unknown CTA bus stop"));
    }

    public List<BusStop> getStopsForRoute(String route) {
        String normalized = route == null ? "" : route.trim().toUpperCase(Locale.ROOT);
        return getStops().stream().filter(stop -> stop.routes().stream()
                .anyMatch(candidate -> candidate.equalsIgnoreCase(normalized))).toList();
    }

    public List<BusStop> search(String query) {
        String normalized = query == null ? "" : query.trim().toLowerCase(Locale.ROOT);
        if (normalized.length() < 2) return List.of();
        return getStops().stream().filter(stop -> (stop.name() + " " + stop.direction() + " "
                        + String.join(" ", stop.routes())).toLowerCase(Locale.ROOT).contains(normalized))
                .limit(12).toList();
    }

    static List<BusStop> mapStops(JsonNode rows) {
        if (rows == null || !rows.isArray()) return List.of();
        List<BusStop> stops = new ArrayList<>();
        for (JsonNode row : rows) {
            String id = normalizeStopId(row.path("systemstop").asText());
            JsonNode coordinates = row.path("the_geom").path("coordinates");
            if (id.isBlank() || !coordinates.isArray() || coordinates.size() < 2) continue;
            double longitude = coordinates.get(0).asDouble(Double.NaN);
            double latitude = coordinates.get(1).asDouble(Double.NaN);
            if (!Double.isFinite(latitude) || !Double.isFinite(longitude)) continue;

            LinkedHashSet<String> routes = new LinkedHashSet<>();
            addRoutes(routes, row.path("routesstpg").asText());
            addRoutes(routes, row.path("owlroutes").asText());
            if (routes.isEmpty()) continue;
            stops.add(new BusStop(
                    id,
                    row.path("public_nam").asText("Bus stop"),
                    directionName(row.path("dir").asText()),
                    latitude,
                    longitude,
                    List.copyOf(routes)
            ));
        }
        return stops.stream().sorted(Comparator.comparing(BusStop::name, String.CASE_INSENSITIVE_ORDER)
                .thenComparing(BusStop::id)).toList();
    }

    private static String normalizeStopId(String value) {
        String trimmed = value == null ? "" : value.trim();
        return trimmed.endsWith(".0") ? trimmed.substring(0, trimmed.length() - 2) : trimmed;
    }

    private static void addRoutes(LinkedHashSet<String> routes, String value) {
        if (value == null || value.isBlank()) return;
        for (String route : value.split(",")) {
            String normalized = route.trim().toUpperCase(Locale.ROOT);
            if (!normalized.isBlank()) routes.add(normalized);
        }
    }

    static String directionName(String value) {
        return switch (value == null ? "" : value.trim().toUpperCase(Locale.ROOT)) {
            case "NB" -> "Northbound";
            case "SB" -> "Southbound";
            case "EB" -> "Eastbound";
            case "WB" -> "Westbound";
            default -> value == null ? "" : value.trim();
        };
    }
}
