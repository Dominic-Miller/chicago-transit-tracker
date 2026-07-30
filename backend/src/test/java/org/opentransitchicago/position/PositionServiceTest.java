package org.opentransitchicago.position;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.opentransitchicago.model.TrainPosition;
import org.springframework.web.server.ResponseStatusException;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class PositionServiceTest {
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Test
    void mapsLiveTrainLocations() throws Exception {
        JsonNode response = objectMapper.readTree("""
                {"ctatt":{"tmst":"2026-07-29T21:40:00","errCd":"0","errNm":null,
                "route":[{"@name":"blue","train":[{
                  "rn":"132","destNm":"O'Hare","nextStaId":"40070","nextStaNm":"Jackson",
                  "arrT":"2026-07-29T21:42:00","lat":"41.87748","lon":"-87.62927",
                  "heading":"358","isApp":"1","isDly":"0"
                }]}]}}
                """);

        var positions = PositionService.mapResponse(response);

        assertThat(positions).hasSize(1);
        TrainPosition train = positions.get(0);
        assertThat(train.runNumber()).isEqualTo("132");
        assertThat(train.latitude()).isEqualTo(41.87748);
        assertThat(train.nextStationName()).isEqualTo("Jackson");
    }

    @Test
    void acceptsDisplayNamesAndRejectsUnknownRoutes() {
        assertThat(PositionService.routeCode("Orange")).isEqualTo("org");
        assertThat(PositionService.routeCode("Brn")).isEqualTo("brn");
        assertThatThrownBy(() -> PositionService.routeCode("Silver"))
                .isInstanceOf(ResponseStatusException.class);
    }
}
