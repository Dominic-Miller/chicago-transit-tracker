package org.opentransitchicago.model;

import java.util.List;

public record BusArrivalBoard(String generatedAt, List<BusArrival> arrivals) {
}
