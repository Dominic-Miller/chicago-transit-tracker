package org.opentransitchicago.model;

public record Arrival(
        String stationId,
        String runNumber,
        String route,
        String destination,
        String platform,
        String arrivalTime,
        long minutes,
        boolean approaching,
        boolean scheduled,
        boolean delayed
) {
}
