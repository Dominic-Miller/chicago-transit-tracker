package org.opentransitchicago.model;

import java.util.List;

public record ArrivalBoard(
        String generatedAt,
        List<Arrival> arrivals
) {
}
