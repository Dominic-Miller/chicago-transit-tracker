package org.opentransitchicago.model;

public record TrainPosition(
        String runNumber,
        String destination,
        String nextStationName,
        double latitude,
        double longitude,
        int heading,
        boolean delayed
) {
}
