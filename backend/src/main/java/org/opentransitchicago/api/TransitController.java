package org.opentransitchicago.api;

import org.opentransitchicago.arrival.ArrivalService;
import org.opentransitchicago.bus.BusRouteGeometryService;
import org.opentransitchicago.bus.BusStopService;
import org.opentransitchicago.bus.BusTrackerService;
import org.opentransitchicago.bus.NearbyBusService;
import org.opentransitchicago.model.ArrivalBoard;
import org.opentransitchicago.model.BusArrivalBoard;
import org.opentransitchicago.model.BusPosition;
import org.opentransitchicago.model.BusRoute;
import org.opentransitchicago.model.BusStop;
import org.opentransitchicago.model.NearbyBoard;
import org.opentransitchicago.model.NearbyBusBoard;
import org.opentransitchicago.model.RouteGeometry;
import org.opentransitchicago.model.Station;
import org.opentransitchicago.model.TrainPosition;
import org.opentransitchicago.position.PositionService;
import org.opentransitchicago.nearby.NearbyService;
import org.opentransitchicago.route.RouteGeometryService;
import org.opentransitchicago.station.StationService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api")
public class TransitController {
    private final StationService stationService;
    private final ArrivalService arrivalService;
    private final PositionService positionService;
    private final NearbyService nearbyService;
    private final RouteGeometryService routeGeometryService;
    private final NearbyBusService nearbyBusService;
    private final BusTrackerService busTrackerService;
    private final BusStopService busStopService;
    private final BusRouteGeometryService busRouteGeometryService;

    public TransitController(StationService stationService, ArrivalService arrivalService,
                             PositionService positionService, NearbyService nearbyService,
                             RouteGeometryService routeGeometryService,
                             NearbyBusService nearbyBusService,
                             BusTrackerService busTrackerService,
                             BusStopService busStopService,
                             BusRouteGeometryService busRouteGeometryService) {
        this.stationService = stationService;
        this.arrivalService = arrivalService;
        this.positionService = positionService;
        this.nearbyService = nearbyService;
        this.routeGeometryService = routeGeometryService;
        this.nearbyBusService = nearbyBusService;
        this.busTrackerService = busTrackerService;
        this.busStopService = busStopService;
        this.busRouteGeometryService = busRouteGeometryService;
    }

    @GetMapping("/buses/nearby")
    public NearbyBusBoard nearbyBuses(@org.springframework.web.bind.annotation.RequestParam("lat") double latitude,
                                      @org.springframework.web.bind.annotation.RequestParam("lon") double longitude) {
        try {
            return nearbyBusService.getNearby(latitude, longitude);
        } catch (IllegalArgumentException exception) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, exception.getMessage());
        }
    }

    @GetMapping("/buses/routes")
    public List<BusRoute> busRoutes() {
        return busTrackerService.getRoutes();
    }

    @GetMapping("/buses/routes/{route}/vehicles")
    public List<BusPosition> busPositions(@PathVariable String route) {
        return busTrackerService.getVehicles(route);
    }

    @GetMapping("/buses/routes/{route}/geometry")
    public RouteGeometry busRouteGeometry(@PathVariable String route) {
        return busRouteGeometryService.getGeometry(route);
    }

    @GetMapping("/buses/routes/{route}/stops")
    public List<BusStop> busRouteStops(@PathVariable String route) {
        return busStopService.getStopsForRoute(BusTrackerService.validateRoute(route));
    }

    @GetMapping("/buses/stops/{stopId}/arrivals")
    public BusArrivalBoard busStopArrivals(@PathVariable String stopId) {
        if (!stopId.matches("\\d{1,6}")) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Bus stop ID must contain digits");
        }
        busStopService.getStop(stopId);
        return busTrackerService.getPredictions(List.of(stopId), 30);
    }

    @GetMapping("/buses/stops/search")
    public List<BusStop> searchBusStops(@org.springframework.web.bind.annotation.RequestParam("q") String query) {
        return busStopService.search(query);
    }

    @GetMapping("/nearby")
    public NearbyBoard nearby(@org.springframework.web.bind.annotation.RequestParam("lat") double latitude,
                              @org.springframework.web.bind.annotation.RequestParam("lon") double longitude) {
        try {
            return nearbyService.getNearby(latitude, longitude);
        } catch (IllegalArgumentException exception) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, exception.getMessage());
        }
    }

    @GetMapping("/health")
    public Map<String, String> health() {
        return Map.of("status", "ok");
    }

    @GetMapping("/stations")
    public List<Station> stations() {
        return stationService.getStations();
    }

    @GetMapping("/stations/{stationId}/arrivals")
    public ArrivalBoard arrivals(@PathVariable String stationId) {
        if (!stationId.matches("\\d{5}")) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Station ID must contain five digits");
        }
        return arrivalService.getArrivals(stationId);
    }

    @GetMapping("/routes/{route}/trains")
    public List<TrainPosition> trainPositions(@PathVariable String route) {
        return positionService.getPositions(route);
    }

    @GetMapping("/routes/{route}/geometry")
    public RouteGeometry routeGeometry(@PathVariable String route) {
        return routeGeometryService.getGeometry(route);
    }
}
