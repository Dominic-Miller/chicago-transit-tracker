package org.opentransitchicago.model;

public record BusArrival(
        String stopId,
        String vehicleId,
        String route,
        String destination,
        String direction,
        String predictionTime,
        long minutes,
        boolean approaching,
        boolean scheduled,
        boolean delayed
) {
}
