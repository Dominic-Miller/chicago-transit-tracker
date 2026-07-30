package org.opentransitchicago.route;

import tools.jackson.databind.JsonNode;
import org.opentransitchicago.model.MapPoint;
import org.opentransitchicago.model.RouteGeometry;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.server.ResponseStatusException;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
public class RouteGeometryService {
    private static final Duration CACHE_DURATION = Duration.ofHours(12);
    private final RestClient cityDataClient;
    private volatile Map<String, List<List<MapPoint>>> cachedPaths = Map.of();
    private volatile Instant cacheExpiresAt = Instant.EPOCH;

    public RouteGeometryService(RestClient.Builder builder) {
        this.cityDataClient = builder.baseUrl("https://data.cityofchicago.org").build();
    }

    public RouteGeometry getGeometry(String requestedRoute) {
        String route = RouteNames.canonical(requestedRoute);
        if (route == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unknown CTA rail route");
        }
        Map<String, List<List<MapPoint>>> paths = getAllPaths();
        return new RouteGeometry(route, paths.getOrDefault(route, List.of()));
    }

    private Map<String, List<List<MapPoint>>> getAllPaths() {
        if (Instant.now().isBefore(cacheExpiresAt) && !cachedPaths.isEmpty()) {
            return cachedPaths;
        }
        synchronized (this) {
            if (Instant.now().isBefore(cacheExpiresAt) && !cachedPaths.isEmpty()) {
                return cachedPaths;
            }
            JsonNode rows = cityDataClient.get()
                    .uri(uriBuilder -> uriBuilder.path("/resource/xbyr-jnvx.json")
                            .queryParam("$limit", 1_000).build())
                    .retrieve().body(JsonNode.class);
            cachedPaths = mapPaths(rows);
            cacheExpiresAt = Instant.now().plus(CACHE_DURATION);
            return cachedPaths;
        }
    }

    static Map<String, List<List<MapPoint>>> mapPaths(JsonNode rows) {
        if (rows == null || !rows.isArray()) {
            return Map.of();
        }
        Map<String, List<List<MapPoint>>> byRoute = new LinkedHashMap<>();
        for (JsonNode row : rows) {
            List<List<MapPoint>> geometryPaths = readGeometry(row.path("the_geom"));
            if (geometryPaths.isEmpty()) {
                continue;
            }
            for (String lineName : row.path("lines").asText("").split(",")) {
                String route = RouteNames.canonical(lineName);
                if (route != null) {
                    byRoute.computeIfAbsent(route, ignored -> new ArrayList<>()).addAll(geometryPaths);
                }
            }
        }
        Map<String, List<List<MapPoint>>> immutable = new LinkedHashMap<>();
        byRoute.forEach((route, paths) -> immutable.put(route, List.copyOf(paths)));
        return Map.copyOf(immutable);
    }

    private static List<List<MapPoint>> readGeometry(JsonNode geometry) {
        if (!"MultiLineString".equals(geometry.path("type").asText())) {
            return List.of();
        }
        List<List<MapPoint>> paths = new ArrayList<>();
        for (JsonNode coordinatePath : geometry.path("coordinates")) {
            List<MapPoint> points = new ArrayList<>();
            for (JsonNode coordinate : coordinatePath) {
                if (coordinate.isArray() && coordinate.size() >= 2) {
                    double longitude = coordinate.get(0).asDouble(Double.NaN);
                    double latitude = coordinate.get(1).asDouble(Double.NaN);
                    if (Double.isFinite(latitude) && Double.isFinite(longitude)) {
                        points.add(new MapPoint(latitude, longitude));
                    }
                }
            }
            if (points.size() >= 2) {
                paths.add(List.copyOf(points));
            }
        }
        return paths;
    }
}
