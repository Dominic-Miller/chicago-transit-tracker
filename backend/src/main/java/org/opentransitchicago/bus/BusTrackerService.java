package org.opentransitchicago.bus;

import org.opentransitchicago.model.BusArrival;
import org.opentransitchicago.model.BusArrivalBoard;
import org.opentransitchicago.model.BusPosition;
import org.opentransitchicago.model.BusRoute;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.server.ResponseStatusException;
import tools.jackson.databind.JsonNode;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.TreeSet;

@Service
public class BusTrackerService {
    private static final ZoneId CHICAGO = ZoneId.of("America/Chicago");
    private static final DateTimeFormatter BUS_TIME = DateTimeFormatter.ofPattern("yyyyMMdd HH:mm");
    private final RestClient busTrackerClient;
    private final String apiKey;
    private final BusCache<BusArrivalBoard> predictionCache = new BusCache<>(Duration.ofSeconds(45), 128);
    private final BusCache<List<BusPosition>> vehicleCache = new BusCache<>(Duration.ofSeconds(45), 64);
    private final BusCache<List<BusRoute>> routeCache = new BusCache<>(Duration.ofHours(12), 1);

    public BusTrackerService(RestClient.Builder builder, @Value("${cta.bus-api-key:}") String apiKey) {
        this.busTrackerClient = builder.baseUrl("https://www.ctabustracker.com").build();
        this.apiKey = apiKey == null ? "" : apiKey.trim();
    }

    public List<BusRoute> getRoutes() {
        requireKey();
        Instant now = Instant.now();
        List<BusRoute> cached = routeCache.get("routes", now);
        if (cached != null) return cached;
        JsonNode response = busTrackerClient.get().uri(uriBuilder -> uriBuilder
                .path("/bustime/api/v3/getroutes")
                .queryParam("key", apiKey).queryParam("format", "json").build())
                .retrieve().body(JsonNode.class);
        JsonNode root = root(response, false);
        List<BusRoute> routes = new ArrayList<>();
        for (JsonNode node : root.path("routes")) {
            String id = node.path("rt").asText().trim();
            if (!id.isBlank()) routes.add(new BusRoute(id, node.path("rtnm").asText(id)));
        }
        routes.sort(Comparator.comparing(BusRoute::id, BusTrackerService::compareRouteIds));
        List<BusRoute> result = List.copyOf(routes);
        routeCache.put("routes", result, now);
        return result;
    }

    public BusArrivalBoard getPredictions(List<String> stopIds, int maximumPredictions) {
        requireKey();
        List<String> canonicalIds = new ArrayList<>(new TreeSet<>(stopIds));
        if (canonicalIds.isEmpty() || canonicalIds.size() > 10) {
            throw new IllegalArgumentException("Bus predictions require between one and ten stop IDs");
        }
        int boundedMaximum = Math.max(1, Math.min(maximumPredictions, 60));
        String cacheKey = String.join(",", canonicalIds) + ":" + boundedMaximum;
        Instant now = Instant.now();
        BusArrivalBoard cached = predictionCache.get(cacheKey, now);
        if (cached != null) return cached;

        JsonNode response = busTrackerClient.get().uri(uriBuilder -> uriBuilder
                .path("/bustime/api/v3/getpredictions")
                .queryParam("key", apiKey).queryParam("format", "json")
                .queryParam("stpid", String.join(",", canonicalIds))
                .queryParam("top", boundedMaximum).build())
                .retrieve().body(JsonNode.class);
        JsonNode root = root(response, true);
        List<BusArrival> arrivals = new ArrayList<>();
        String generatedAt = "";
        for (JsonNode prediction : root.path("prd")) {
            if (generatedAt.isBlank()) generatedAt = isoTime(prediction.path("tmstmp").asText());
            arrivals.add(mapPrediction(prediction));
        }
        if (generatedAt.isBlank()) generatedAt = ZonedDateTime.now(CHICAGO).toLocalDateTime().toString();
        arrivals.sort(Comparator.comparing(BusArrival::predictionTime)
                .thenComparing(BusArrival::route).thenComparing(BusArrival::vehicleId));
        BusArrivalBoard board = new BusArrivalBoard(generatedAt, List.copyOf(arrivals));
        predictionCache.put(cacheKey, board, now);
        return board;
    }

    public List<BusPosition> getVehicles(String route) {
        requireKey();
        String normalizedRoute = validateRoute(route);
        Instant now = Instant.now();
        List<BusPosition> cached = vehicleCache.get(normalizedRoute, now);
        if (cached != null) return cached;
        JsonNode response = busTrackerClient.get().uri(uriBuilder -> uriBuilder
                .path("/bustime/api/v3/getvehicles")
                .queryParam("key", apiKey).queryParam("format", "json")
                .queryParam("rt", normalizedRoute).build())
                .retrieve().body(JsonNode.class);
        JsonNode root = root(response, true);
        List<BusPosition> vehicles = mapVehicles(root);
        vehicleCache.put(normalizedRoute, vehicles, now);
        return vehicles;
    }

    static BusArrival mapPrediction(JsonNode node) {
        String minuteText = node.path("prdctdn").asText();
        long minutes = parseMinutes(minuteText, node.path("prdtm").asText(), ZonedDateTime.now(CHICAGO));
        boolean approaching = "DUE".equalsIgnoreCase(minuteText) || minutes == 0;
        return new BusArrival(
                node.path("stpid").asText(), node.path("vid").asText(), node.path("rt").asText(),
                node.path("des").asText(), node.path("rtdir").asText(),
                isoTime(node.path("prdtm").asText()), minutes, approaching,
                "S".equalsIgnoreCase(node.path("typ").asText()), node.path("dly").asBoolean(false)
        );
    }

    static List<BusPosition> mapVehicles(JsonNode root) {
        List<BusPosition> vehicles = new ArrayList<>();
        for (JsonNode node : root.path("vehicle")) {
            double latitude = node.path("lat").asDouble(Double.NaN);
            double longitude = node.path("lon").asDouble(Double.NaN);
            if (!Double.isFinite(latitude) || !Double.isFinite(longitude)) continue;
            vehicles.add(new BusPosition(node.path("vid").asText(), node.path("rt").asText(),
                    node.path("des").asText(), latitude, longitude,
                    node.path("hdg").asInt(0), node.path("dly").asBoolean(false)));
        }
        return List.copyOf(vehicles);
    }

    static long parseMinutes(String minuteText, String predictionTime, ZonedDateTime now) {
        if ("DUE".equalsIgnoreCase(minuteText)) return 0;
        try {
            return Math.max(0, Long.parseLong(minuteText));
        } catch (NumberFormatException ignored) {
            try {
                LocalDateTime arrival = LocalDateTime.parse(predictionTime, BUS_TIME);
                return Math.max(0, Duration.between(now, arrival.atZone(CHICAGO)).toMinutes());
            } catch (DateTimeParseException exception) {
                return 0;
            }
        }
    }

    static String isoTime(String value) {
        try {
            return LocalDateTime.parse(value, BUS_TIME).toString();
        } catch (DateTimeParseException exception) {
            return value;
        }
    }

    public static String validateRoute(String route) {
        String normalized = route == null ? "" : route.trim().toUpperCase(Locale.ROOT);
        if (!normalized.matches("[A-Z0-9]{1,4}")) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unknown CTA bus route");
        }
        return normalized;
    }

    private JsonNode root(JsonNode response, boolean allowEmptyResult) {
        JsonNode root = response == null ? null : response.path("bustime-response");
        if (root == null || root.isMissingNode()) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "CTA Bus Tracker returned an unexpected response");
        }
        JsonNode errors = root.path("error");
        if (errors.isArray() && !errors.isEmpty()) {
            String message = errors.get(0).path("msg").asText("CTA Bus Tracker request failed");
            String normalized = message.toLowerCase(Locale.ROOT);
            if (allowEmptyResult && (normalized.contains("no predictions")
                    || normalized.contains("no vehicles") || normalized.contains("no service scheduled"))) {
                return root;
            }
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY,
                    message);
        }
        return root;
    }

    private void requireKey() {
        if (apiKey.isBlank()) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                    "CTA_BUS_API_KEY is not configured on the server");
        }
    }

    private static int compareRouteIds(String left, String right) {
        String leftDigits = left.replaceAll("\\D", "");
        String rightDigits = right.replaceAll("\\D", "");
        int leftNumber = leftDigits.isBlank() ? Integer.MAX_VALUE : Integer.parseInt(leftDigits);
        int rightNumber = rightDigits.isBlank() ? Integer.MAX_VALUE : Integer.parseInt(rightDigits);
        int number = Integer.compare(leftNumber, rightNumber);
        return number != 0 ? number : left.compareToIgnoreCase(right);
    }
}
