package org.opentransitchicago.arrival;

import org.opentransitchicago.model.Arrival;

import java.util.List;

public record ArrivalBatch(String generatedAt, List<Arrival> arrivals) {
}
