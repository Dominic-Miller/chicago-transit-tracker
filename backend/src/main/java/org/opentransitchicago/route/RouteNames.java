package org.opentransitchicago.route;

import java.util.Locale;
import java.util.Map;

public final class RouteNames {
    private static final Map<String, String> ROUTES = Map.ofEntries(
            Map.entry("red", "Red"),
            Map.entry("blue", "Blue"),
            Map.entry("green", "Green"), Map.entry("g", "Green"),
            Map.entry("brown", "Brown"), Map.entry("brn", "Brown"),
            Map.entry("purple", "Purple"), Map.entry("p", "Purple"),
            Map.entry("purple express", "Purple"), Map.entry("purple exp", "Purple"),
            Map.entry("pink", "Pink"), Map.entry("pnk", "Pink"),
            Map.entry("orange", "Orange"), Map.entry("org", "Orange"), Map.entry("o", "Orange"),
            Map.entry("yellow", "Yellow"), Map.entry("y", "Yellow")
    );

    private RouteNames() {
    }

    public static String canonical(String value) {
        String normalized = value == null ? "" : value.toLowerCase(Locale.ROOT)
                .replace("(express)", " express")
                .replace("(exp)", " exp")
                .replace("line", "")
                .replaceAll("\\s+", " ")
                .trim();
        String direct = ROUTES.get(normalized);
        if (direct != null) {
            return direct;
        }
        return ROUTES.entrySet().stream()
                .filter(entry -> normalized.startsWith(entry.getKey() + " "))
                .map(Map.Entry::getValue)
                .findFirst()
                .orElse(null);
    }
}
