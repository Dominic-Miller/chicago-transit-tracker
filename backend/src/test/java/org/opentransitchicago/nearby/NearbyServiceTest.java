package org.opentransitchicago.nearby;

import org.junit.jupiter.api.Test;
import org.opentransitchicago.arrival.ArrivalBatch;
import org.opentransitchicago.arrival.ArrivalService;
import org.opentransitchicago.model.Arrival;
import org.opentransitchicago.model.NearbyBoard;
import org.opentransitchicago.model.Station;
import org.opentransitchicago.station.StationService;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatIllegalArgumentException;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class NearbyServiceTest {
    @Test
    void selectsFourNearestStationsWithOneBatchAndGroupsPredictions() {
        StationService stations = mock(StationService.class);
        ArrivalService arrivals = mock(ArrivalService.class);
        List<Station> allStations = List.of(
                station("1", 41.880, -87.630), station("2", 41.881, -87.630),
                station("3", 41.882, -87.630), station("4", 41.883, -87.630),
                station("5", 42.000, -87.630));
        when(stations.getStations()).thenReturn(allStations);
        Arrival prediction = new Arrival("2", "101", "Red", "Howard", "Northbound",
                "2026-07-30T12:05:00", 5, false, false, false);
        when(arrivals.getArrivals(List.of("1", "2", "3", "4"), 40))
                .thenReturn(new ArrivalBatch("2026-07-30T12:00:00", List.of(prediction)));

        NearbyBoard board = new NearbyService(stations, arrivals).getNearby(41.880, -87.630);

        assertThat(board.stations()).extracting(value -> value.station().id())
                .containsExactly("1", "2", "3", "4");
        assertThat(board.stations().get(0).arrivals()).isEmpty();
        assertThat(board.stations().get(1).arrivals()).containsExactly(prediction);
        verify(arrivals).getArrivals(List.of("1", "2", "3", "4"), 40);
    }

    @Test
    void rejectsInvalidCoordinates() {
        NearbyService service = new NearbyService(mock(StationService.class), mock(ArrivalService.class));
        assertThatIllegalArgumentException().isThrownBy(() -> service.getNearby(Double.NaN, -87.6));
        assertThatIllegalArgumentException().isThrownBy(() -> service.getNearby(91, -87.6));
        assertThatIllegalArgumentException().isThrownBy(() -> service.getNearby(41.8, -181));
    }

    @Test
    void calculatesApproximateWalkingContext() {
        assertThat(NearbyService.approximateWalkMinutes(0.5)).isEqualTo(12);
        assertThat(NearbyService.approximateWalkMinutes(0)).isEqualTo(1);
    }

    private static Station station(String id, double latitude, double longitude) {
        return new Station(id, "Station " + id, "", latitude, longitude, true, List.of("Red"));
    }
}
