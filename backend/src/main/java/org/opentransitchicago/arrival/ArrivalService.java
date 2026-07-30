package org.opentransitchicago.arrival;

import tools.jackson.databind.JsonNode;
import org.opentransitchicago.model.Arrival;
import org.opentransitchicago.model.ArrivalBoard;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.server.ResponseStatusException;

import java.time.Duration;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

@Service
public class ArrivalService {
    private static final ZoneId CHICAGO = ZoneId.of("America/Chicago");
    private static final DateTimeFormatter CTA_TIME = DateTimeFormatter.ISO_LOCAL_DATE_TIME;

    private final RestClient trainTrackerClient;
    private final String apiKey;

    public ArrivalService(RestClient.Builder builder, @Value("${cta.api-key:}") String apiKey) {
        this.trainTrackerClient = builder.baseUrl("https://lapi.transitchicago.com").build();
        this.apiKey = apiKey == null ? "" : apiKey.trim();
    }

    public ArrivalBoard getArrivals(String stationId) {
        if (apiKey.isBlank()) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                    "CTA_API_KEY is not configured on the server");
        }

        JsonNode response = trainTrackerClient.get()
                .uri(uriBuilder -> uriBuilder
                        .path("/api/1.0/ttarrivals.aspx")
                        .queryParam("key", apiKey)
                        .queryParam("mapid", stationId)
                        .queryParam("max", 12)
                        .queryParam("outputType", "JSON")
                        .build())
                .retrieve()
                .body(JsonNode.class);

        JsonNode root = response == null ? null : response.path("ctatt");
        if (root == null || root.isMissingNode()) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY,
                    "CTA returned an unexpected response");
        }

        int errorCode = root.path("errCd").asInt(-1);
        if (errorCode != 0) {
            String errorName = root.path("errNm").asText("CTA request failed");
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, errorName);
        }

        List<Arrival> arrivals = new ArrayList<>();
        for (JsonNode eta : root.path("eta")) {
            arrivals.add(mapArrival(eta));
        }
        arrivals.sort(Comparator.comparing(Arrival::arrivalTime));

        return new ArrivalBoard(root.path("tmst").asText(), arrivals);
    }

    static Arrival mapArrival(JsonNode eta) {
        String arrivalTime = eta.path("arrT").asText();
        long minutes = minutesUntil(arrivalTime, ZonedDateTime.now(CHICAGO));
        boolean approaching = "1".equals(eta.path("isApp").asText()) || minutes == 0;

        return new Arrival(
                eta.path("rn").asText(),
                eta.path("rt").asText(),
                eta.path("destNm").asText(),
                eta.path("stpDe").asText(),
                arrivalTime,
                minutes,
                approaching,
                "1".equals(eta.path("isSch").asText()),
                "1".equals(eta.path("isDly").asText())
        );
    }

    static long minutesUntil(String value, ZonedDateTime now) {
        try {
            ZonedDateTime arrival = LocalDateTime.parse(value, CTA_TIME).atZone(CHICAGO);
            return Math.max(0, Duration.between(now, arrival).toMinutes());
        } catch (DateTimeParseException exception) {
            return 0;
        }
    }
}
