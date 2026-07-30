package org.opentransitchicago.bus;

import org.junit.jupiter.api.Test;
import org.opentransitchicago.model.BusArrival;
import tools.jackson.databind.ObjectMapper;

import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZonedDateTime;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class BusTrackerServiceTest {
    @Test
    void mapsLiveScheduledDelayedAndDuePredictionStates() throws Exception {
        var liveNode = new ObjectMapper().readTree("""
                {"typ":"A","stpid":"4996","vid":"8713","rt":"77","rtdir":"Westbound",
                 "des":"Cumberland","prdtm":"20260730 11:30","prdctdn":"6","dly":true}
                """);
        var dueNode = new ObjectMapper().readTree("""
                {"typ":"S","stpid":"4996","vid":"","rt":"77","rtdir":"Westbound",
                 "des":"Cumberland","prdtm":"20260730 11:24","prdctdn":"DUE","dly":false}
                """);

        BusArrival live = BusTrackerService.mapPrediction(liveNode);
        BusArrival due = BusTrackerService.mapPrediction(dueNode);

        assertThat(live).extracting(BusArrival::minutes, BusArrival::scheduled, BusArrival::delayed)
                .containsExactly(6L, false, true);
        assertThat(due.approaching()).isTrue();
        assertThat(due.scheduled()).isTrue();
        assertThat(due.predictionTime()).isEqualTo("2026-07-30T11:24");
    }

    @Test
    void derivesMinutesFromPredictionTimeWhenCountdownIsUnavailable() {
        ZonedDateTime now = ZonedDateTime.of(2026, 7, 30, 11, 20, 0, 0,
                ZoneId.of("America/Chicago"));

        assertThat(BusTrackerService.parseMinutes("", "20260730 11:27", now)).isEqualTo(7);
    }

    @Test
    void validatesRouteIdentifiers() {
        assertThat(BusTrackerService.validateRoute(" n5 ")).isEqualTo("N5");
        assertThatThrownBy(() -> BusTrackerService.validateRoute("22' OR 1=1"))
                .isInstanceOf(org.springframework.web.server.ResponseStatusException.class);
    }

    @Test
    void boundedCacheExpiresAndEvictsLeastRecentlyUsedEntry() {
        BusCache<String> cache = new BusCache<>(Duration.ofSeconds(45), 2);
        Instant now = Instant.parse("2026-07-30T12:00:00Z");
        cache.put("a", "one", now);
        cache.put("b", "two", now);
        assertThat(cache.get("a", now.plusSeconds(1))).isEqualTo("one");
        cache.put("c", "three", now.plusSeconds(2));

        assertThat(cache.contains("a")).isTrue();
        assertThat(cache.contains("b")).isFalse();
        assertThat(cache.get("a", now.plusSeconds(45))).isNull();
    }
}
