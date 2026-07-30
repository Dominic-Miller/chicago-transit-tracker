package org.opentransitchicago.route;

import tools.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.opentransitchicago.model.MapPoint;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class RouteGeometryServiceTest {
    @Test
    void mapsSharedSegmentsAndNormalizesPurpleExpress() throws Exception {
        var rows = new ObjectMapper().readTree("""
                [{"lines":"Brown, Orange, Pink, Purple (Express)",
                  "the_geom":{"type":"MultiLineString","coordinates":[
                    [[-87.630,41.880],[-87.620,41.890]]
                  ]}}]
                """);

        Map<String, java.util.List<java.util.List<MapPoint>>> paths =
                RouteGeometryService.mapPaths(rows);

        assertThat(paths.keySet()).containsExactlyInAnyOrder("Brown", "Orange", "Pink", "Purple");
        assertThat(paths.get("Purple").get(0)).containsExactly(
                new MapPoint(41.880, -87.630), new MapPoint(41.890, -87.620));
    }

    @Test
    void normalizesAliasesAndCityLabels() {
        assertThat(RouteNames.canonical("Purple (Exp)")).isEqualTo("Purple");
        assertThat(RouteNames.canonical("Yellow Line")).isEqualTo("Yellow");
        assertThat(RouteNames.canonical("org")).isEqualTo("Orange");
        assertThat(RouteNames.canonical("Blue Line (O'Hare)")).isEqualTo("Blue");
    }
}
