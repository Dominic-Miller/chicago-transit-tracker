package org.opentransitchicago.bus;

import org.junit.jupiter.api.Test;
import org.opentransitchicago.model.BusArrival;
import org.opentransitchicago.model.BusArrivalBoard;
import org.opentransitchicago.model.BusStop;
import org.opentransitchicago.model.NearbyBusBoard;

import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class NearbyBusServiceTest {
    @Test
    void selectsTenNearestStopsInOneBatchAndGroupsPredictions() {
        BusStopService stops = mock(BusStopService.class);
        BusTrackerService tracker = mock(BusTrackerService.class);
        List<BusStop> allStops = new ArrayList<>();
        for (int index = 1; index <= 11; index++) {
            allStops.add(new BusStop(String.valueOf(index), "Stop " + index, "Northbound",
                    41.880 + index * .001, -87.630, List.of("22")));
        }
        when(stops.getStops()).thenReturn(allStops);
        BusArrival prediction = new BusArrival("2", "8713", "22", "Howard", "Northbound",
                "2026-07-30T12:05", 5, false, false, false);
        List<String> expectedIds = List.of("1", "2", "3", "4", "5", "6", "7", "8", "9", "10");
        when(tracker.getPredictions(expectedIds, 60))
                .thenReturn(new BusArrivalBoard("2026-07-30T12:00", List.of(prediction)));

        NearbyBusBoard board = new NearbyBusService(stops, tracker).getNearby(41.880, -87.630);

        assertThat(board.stops()).hasSize(10);
        assertThat(board.stops().get(0).arrivals()).isEmpty();
        assertThat(board.stops().get(1).arrivals()).containsExactly(prediction);
        verify(tracker).getPredictions(expectedIds, 60);
    }
}
