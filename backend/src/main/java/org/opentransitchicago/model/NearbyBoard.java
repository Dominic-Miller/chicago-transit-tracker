package org.opentransitchicago.model;

import java.util.List;

public record NearbyBoard(
        String generatedAt,
        MapPoint reference,
        List<NearbyStationBoard> stations
) {
}
