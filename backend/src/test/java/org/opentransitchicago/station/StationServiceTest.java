package org.opentransitchicago.station;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.opentransitchicago.model.Station;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class StationServiceTest {
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Test
    void groupsDirectionalStopsIntoOneStation() throws Exception {
        JsonNode rows = objectMapper.readTree("""
                [
                  {"stop_id":"1","station_name":"Lake","station_descriptive_name":"Lake (Red Line)",
                   "map_id":"41660","ada":true,"red":true,
                   "location":{"latitude":"41.8848","longitude":"-87.6278"}},
                  {"stop_id":"2","station_name":"Lake","station_descriptive_name":"Lake (Red Line)",
                   "map_id":"41660","ada":true,"red":true,
                   "location":{"latitude":"41.8848","longitude":"-87.6278"}}
                ]
                """);

        List<Station> stations = StationService.mapStations(rows);

        assertThat(stations).hasSize(1);
        assertThat(stations.get(0).id()).isEqualTo("41660");
        assertThat(stations.get(0).routes()).containsExactly("Red");
        assertThat(stations.get(0).accessible()).isTrue();
    }
}
