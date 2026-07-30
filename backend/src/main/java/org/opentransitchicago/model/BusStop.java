package org.opentransitchicago.model;

import java.util.List;

public record BusStop(
        String id,
        String name,
        String direction,
        double latitude,
        double longitude,
        List<String> routes
) {
}
