package org.opentransitchicago.model;

import java.util.List;

public record NearbyBusStopBoard(
        BusStop stop,
        double distanceMiles,
        long walkMinutes,
        List<BusArrival> arrivals
) {
}
