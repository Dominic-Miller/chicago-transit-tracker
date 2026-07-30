package org.opentransitchicago.bus;

import org.junit.jupiter.api.Test;
import org.opentransitchicago.model.BusStop;
import tools.jackson.databind.ObjectMapper;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class BusStopServiceTest {
    @Test
    void mapsStopCoordinatesDirectionsAndRoutes() throws Exception {
        var rows = new ObjectMapper().readTree("""
                [{"systemstop":"4996.0","public_nam":"Belmont & Broadway","dir":"WB",
                  "routesstpg":"77,151,156","owlroutes":"N77",
                  "the_geom":{"type":"Point","coordinates":[-87.64428,41.94011]}}]
                """);

        List<BusStop> stops = BusStopService.mapStops(rows);

        assertThat(stops).containsExactly(new BusStop("4996", "Belmont & Broadway", "Westbound",
                41.94011, -87.64428, List.of("77", "151", "156", "N77")));
    }

    @Test
    void ignoresRowsWithoutUsableCoordinatesOrRoutes() throws Exception {
        var rows = new ObjectMapper().readTree("""
                [{"systemstop":"1","public_nam":"No routes","the_geom":{"coordinates":[-87.6,41.8]}},
                 {"systemstop":"2","routesstpg":"22"}]
                """);

        assertThat(BusStopService.mapStops(rows)).isEmpty();
    }
}
