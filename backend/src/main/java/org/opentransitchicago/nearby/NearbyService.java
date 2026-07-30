package org.opentransitchicago.nearby;

import org.opentransitchicago.arrival.ArrivalBatch;
import org.opentransitchicago.arrival.ArrivalService;
import org.opentransitchicago.model.Arrival;
import org.opentransitchicago.model.MapPoint;
import org.opentransitchicago.model.NearbyBoard;
import org.opentransitchicago.model.NearbyStationBoard;
import org.opentransitchicago.model.Station;
import org.opentransitchicago.station.StationService;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

@Service
public class NearbyService {
    private static final double EARTH_RADIUS_MILES = 3_958.8;
    private final StationService stationService;
    private final ArrivalService arrivalService;

    public NearbyService(StationService stationService, ArrivalService arrivalService) {
        this.stationService = stationService;
        this.arrivalService = arrivalService;
    }

    public NearbyBoard getNearby(double latitude, double longitude) {
        validateCoordinates(latitude, longitude);
        List<StationDistance> nearest = stationService.getStations().stream()
                .map(station -> new StationDistance(station,
                        distanceMiles(latitude, longitude, station.latitude(), station.longitude())))
                .sorted(Comparator.comparingDouble(StationDistance::distanceMiles)
                        .thenComparing(value -> value.station().id()))
                .limit(4)
                .toList();

        if (nearest.isEmpty()) {
            return new NearbyBoard("", new MapPoint(latitude, longitude), List.of());
        }

        ArrivalBatch batch = arrivalService.getArrivals(
                nearest.stream().map(value -> value.station().id()).toList(), 40);
        List<NearbyStationBoard> boards = new ArrayList<>();
        for (StationDistance item : nearest) {
            List<Arrival> arrivals = batch.arrivals().stream()
                    .filter(arrival -> item.station().id().equals(arrival.stationId()))
                    .toList();
            boards.add(new NearbyStationBoard(item.station(), roundMiles(item.distanceMiles()),
                    approximateWalkMinutes(item.distanceMiles()), arrivals));
        }
        return new NearbyBoard(batch.generatedAt(), new MapPoint(latitude, longitude), boards);
    }

    static void validateCoordinates(double latitude, double longitude) {
        if (!Double.isFinite(latitude) || latitude < -90 || latitude > 90
                || !Double.isFinite(longitude) || longitude < -180 || longitude > 180) {
            throw new IllegalArgumentException("Latitude and longitude must be finite and in range");
        }
    }

    static double distanceMiles(double latitudeA, double longitudeA,
                                double latitudeB, double longitudeB) {
        double latitudeDelta = Math.toRadians(latitudeB - latitudeA);
        double longitudeDelta = Math.toRadians(longitudeB - longitudeA);
        double a = Math.sin(latitudeDelta / 2) * Math.sin(latitudeDelta / 2)
                + Math.cos(Math.toRadians(latitudeA)) * Math.cos(Math.toRadians(latitudeB))
                * Math.sin(longitudeDelta / 2) * Math.sin(longitudeDelta / 2);
        return EARTH_RADIUS_MILES * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }

    static long approximateWalkMinutes(double distanceMiles) {
        return Math.max(1, (long) Math.ceil(distanceMiles * 1.2 / 3 * 60));
    }

    private static double roundMiles(double distanceMiles) {
        return Math.round(distanceMiles * 100.0) / 100.0;
    }

    private record StationDistance(Station station, double distanceMiles) {
    }
}
