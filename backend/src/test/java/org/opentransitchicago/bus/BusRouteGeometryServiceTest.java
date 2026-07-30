package org.opentransitchicago.bus;

import org.junit.jupiter.api.Test;
import tools.jackson.databind.ObjectMapper;

import static org.assertj.core.api.Assertions.assertThat;

class BusRouteGeometryServiceTest {
    @Test
    void mapsMultiLineRouteGeometryAndDropsInvalidPoints() throws Exception {
        var rows = new ObjectMapper().readTree("""
                [{"the_geom":{"type":"MultiLineString","coordinates":[
                  [[-87.63,41.88],[-87.64,41.89]], [[-87.65,41.90]]
                ]}}]
                """);

        var paths = BusRouteGeometryService.mapPaths(rows);

        assertThat(paths).hasSize(1);
        assertThat(paths.get(0)).hasSize(2);
        assertThat(paths.get(0).get(0).latitude()).isEqualTo(41.88);
    }
}
