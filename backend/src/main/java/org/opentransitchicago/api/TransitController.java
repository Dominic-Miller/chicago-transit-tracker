package org.opentransitchicago.api;

import org.opentransitchicago.arrival.ArrivalService;
import org.opentransitchicago.model.ArrivalBoard;
import org.opentransitchicago.model.Station;
import org.opentransitchicago.model.TrainPosition;
import org.opentransitchicago.position.PositionService;
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

    public TransitController(StationService stationService, ArrivalService arrivalService,
                             PositionService positionService) {
        this.stationService = stationService;
        this.arrivalService = arrivalService;
        this.positionService = positionService;
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
}
