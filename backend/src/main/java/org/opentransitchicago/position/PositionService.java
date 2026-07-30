package org.opentransitchicago.position;

import tools.jackson.databind.JsonNode;
import org.opentransitchicago.model.TrainPosition;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.server.ResponseStatusException;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@Service
public class PositionService {
    private static final Map<String, String> ROUTE_CODES = routeCodes();

    private final RestClient trainTrackerClient;
    private final String apiKey;

    public PositionService(RestClient.Builder builder, @Value("${cta.api-key:}") String apiKey) {
        this.trainTrackerClient = builder.baseUrl("https://lapi.transitchicago.com").build();
        this.apiKey = apiKey == null ? "" : apiKey.trim();
    }

    public List<TrainPosition> getPositions(String route) {
        if (apiKey.isBlank()) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                    "CTA_API_KEY is not configured on the server");
        }

        String routeCode = routeCode(route);
        JsonNode response = trainTrackerClient.get()
                .uri(uriBuilder -> uriBuilder
                        .path("/api/1.0/ttpositions.aspx")
                        .queryParam("key", apiKey)
                        .queryParam("rt", routeCode)
                        .queryParam("outputType", "JSON")
                        .build())
                .retrieve()
                .body(JsonNode.class);

        return mapResponse(response);
    }

    static List<TrainPosition> mapResponse(JsonNode response) {
        JsonNode root = response == null ? null : response.path("ctatt");
        if (root == null || root.isMissingNode()) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY,
                    "CTA returned an unexpected response");
        }

        if (root.path("errCd").asInt(-1) != 0) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY,
                    root.path("errNm").asText("CTA request failed"));
        }

        List<TrainPosition> trains = new ArrayList<>();
        for (JsonNode route : root.path("route")) {
            for (JsonNode train : route.path("train")) {
                double latitude = train.path("lat").asDouble(Double.NaN);
                double longitude = train.path("lon").asDouble(Double.NaN);
                if (!Double.isFinite(latitude) || !Double.isFinite(longitude)) {
                    continue;
                }
                trains.add(new TrainPosition(
                        train.path("rn").asText(),
                        train.path("destNm").asText(),
                        train.path("nextStaNm").asText(),
                        latitude,
                        longitude,
                        train.path("heading").asInt(0),
                        "1".equals(train.path("isDly").asText())
                ));
            }
        }

        return trains;
    }

    static String routeCode(String route) {
        String code = ROUTE_CODES.get(route == null ? "" : route.trim().toLowerCase(Locale.ROOT));
        if (code == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unknown CTA rail route");
        }
        return code;
    }

    private static Map<String, String> routeCodes() {
        Map<String, String> codes = new LinkedHashMap<>();
        codes.put("red", "red");
        codes.put("blue", "blue");
        codes.put("green", "g");
        codes.put("g", "g");
        codes.put("brown", "brn");
        codes.put("brn", "brn");
        codes.put("purple", "p");
        codes.put("p", "p");
        codes.put("pink", "pink");
        codes.put("orange", "org");
        codes.put("org", "org");
        codes.put("yellow", "y");
        codes.put("y", "y");
        return Map.copyOf(codes);
    }
}
