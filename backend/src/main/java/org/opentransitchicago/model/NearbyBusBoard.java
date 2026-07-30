package org.opentransitchicago.model;

import java.util.List;

public record NearbyBusBoard(
        String generatedAt,
        MapPoint reference,
        List<NearbyBusStopBoard> stops
) {
}
