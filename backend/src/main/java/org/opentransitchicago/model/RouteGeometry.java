package org.opentransitchicago.model;

import java.util.List;

public record RouteGeometry(String route, List<List<MapPoint>> paths) {
}
