package org.opentransitchicago.model;

public record BusPosition(
        String vehicleId,
        String route,
        String destination,
        double latitude,
        double longitude,
        int heading,
        boolean delayed
) {
}
