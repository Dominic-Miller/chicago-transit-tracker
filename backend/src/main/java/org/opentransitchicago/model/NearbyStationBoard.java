package org.opentransitchicago.model;

import java.util.List;

public record NearbyStationBoard(
        Station station,
        double distanceMiles,
        long walkMinutes,
        List<Arrival> arrivals
) {
}
