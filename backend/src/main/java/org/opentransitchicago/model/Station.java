package org.opentransitchicago.model;

import java.util.List;

public record Station(
        String id,
        String name,
        String descriptiveName,
        double latitude,
        double longitude,
        boolean accessible,
        List<String> routes
) {
}
