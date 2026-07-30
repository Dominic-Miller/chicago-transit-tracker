package org.opentransitchicago.bus;

import org.opentransitchicago.model.MapPoint;
import org.opentransitchicago.model.RouteGeometry;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import tools.jackson.databind.JsonNode;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Service
public class BusRouteGeometryService {
    private final RestClient cityDataClient;
    private final BusCache<RouteGeometry> cache = new BusCache<>(Duration.ofHours(12), 160);

    public BusRouteGeometryService(RestClient.Builder builder) {
        this.cityDataClient = builder.baseUrl("https://data.cityofchicago.org").build();
    }

    public RouteGeometry getGeometry(String route) {
        String normalized = BusTrackerService.validateRoute(route);
        Instant now = Instant.now();
        RouteGeometry cached = cache.get(normalized, now);
        if (cached != null) return cached;
        JsonNode rows = cityDataClient.get().uri(uriBuilder -> uriBuilder
                .path("/resource/6uva-a5ei.json")
                .queryParam("$limit", 10)
                .queryParam("$where", "route='" + normalized + "'")
                .build()).retrieve().body(JsonNode.class);
        RouteGeometry geometry = new RouteGeometry(normalized, mapPaths(rows));
        cache.put(normalized, geometry, now);
        return geometry;
    }

    static List<List<MapPoint>> mapPaths(JsonNode rows) {
        if (rows == null || !rows.isArray()) return List.of();
        List<List<MapPoint>> paths = new ArrayList<>();
        for (JsonNode row : rows) {
            JsonNode geometry = row.path("the_geom");
            if (!"MultiLineString".equals(geometry.path("type").asText())) continue;
            for (JsonNode coordinatePath : geometry.path("coordinates")) {
                List<MapPoint> points = new ArrayList<>();
                for (JsonNode coordinate : coordinatePath) {
                    if (!coordinate.isArray() || coordinate.size() < 2) continue;
                    double longitude = coordinate.get(0).asDouble(Double.NaN);
                    double latitude = coordinate.get(1).asDouble(Double.NaN);
                    if (Double.isFinite(latitude) && Double.isFinite(longitude)) {
                        points.add(new MapPoint(latitude, longitude));
                    }
                }
                if (points.size() >= 2) paths.add(List.copyOf(points));
            }
        }
        return List.copyOf(paths);
    }
}
