package org.opentransitchicago.bus;

import org.opentransitchicago.model.BusArrival;
import org.opentransitchicago.model.BusArrivalBoard;
import org.opentransitchicago.model.BusStop;
import org.opentransitchicago.model.MapPoint;
import org.opentransitchicago.model.NearbyBusBoard;
import org.opentransitchicago.model.NearbyBusStopBoard;
import org.opentransitchicago.nearby.NearbyService;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

@Service
public class NearbyBusService {
    private final BusStopService busStopService;
    private final BusTrackerService busTrackerService;

    public NearbyBusService(BusStopService busStopService, BusTrackerService busTrackerService) {
        this.busStopService = busStopService;
        this.busTrackerService = busTrackerService;
    }

    public NearbyBusBoard getNearby(double latitude, double longitude) {
        NearbyService.validateCoordinates(latitude, longitude);
        List<StopDistance> nearest = busStopService.getStops().stream()
                .map(stop -> new StopDistance(stop, NearbyService.distanceMiles(latitude, longitude,
                        stop.latitude(), stop.longitude())))
                .sorted(Comparator.comparingDouble(StopDistance::distanceMiles)
                        .thenComparing(value -> value.stop().id()))
                .limit(10).toList();
        if (nearest.isEmpty()) {
            return new NearbyBusBoard("", new MapPoint(latitude, longitude), List.of());
        }
        BusArrivalBoard batch = busTrackerService.getPredictions(
                nearest.stream().map(value -> value.stop().id()).toList(), 60);
        List<NearbyBusStopBoard> boards = new ArrayList<>();
        for (StopDistance item : nearest) {
            List<BusArrival> arrivals = batch.arrivals().stream()
                    .filter(arrival -> item.stop().id().equals(arrival.stopId())).toList();
            boards.add(new NearbyBusStopBoard(item.stop(), roundMiles(item.distanceMiles()),
                    NearbyService.approximateWalkMinutes(item.distanceMiles()), arrivals));
        }
        return new NearbyBusBoard(batch.generatedAt(), new MapPoint(latitude, longitude), List.copyOf(boards));
    }

    private static double roundMiles(double distanceMiles) {
        return Math.round(distanceMiles * 100.0) / 100.0;
    }

    private record StopDistance(BusStop stop, double distanceMiles) {
    }
}
