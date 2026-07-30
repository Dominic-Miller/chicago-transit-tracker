package org.opentransitchicago.api;

import org.opentransitchicago.arrival.ArrivalService;
import org.opentransitchicago.model.ArrivalBoard;
import org.opentransitchicago.model.NearbyBoard;
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

    public TransitController(StationService stationService, ArrivalService arrivalService,
                             PositionService positionService, NearbyService nearbyService,
                             RouteGeometryService routeGeometryService) {
        this.stationService = stationService;
        this.arrivalService = arrivalService;
        this.positionService = positionService;
        this.nearbyService = nearbyService;
        this.routeGeometryService = routeGeometryService;
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
