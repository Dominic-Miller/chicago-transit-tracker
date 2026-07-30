package org.opentransitchicago.arrival;

import org.junit.jupiter.api.Test;
import tools.jackson.databind.ObjectMapper;
import org.opentransitchicago.model.Arrival;

import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.Duration;
import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;

class ArrivalServiceTest {
    @Test
    void calculatesWholeMinutesInChicagoTime() {
        ZonedDateTime now = ZonedDateTime.of(2026, 7, 29, 12, 0, 15, 0,
                ZoneId.of("America/Chicago"));

        assertThat(ArrivalService.minutesUntil("2026-07-29T12:05:15", now)).isEqualTo(5);
    }

    @Test
    void neverReturnsNegativeMinutes() {
        ZonedDateTime now = ZonedDateTime.of(2026, 7, 29, 12, 5, 0, 0,
                ZoneId.of("America/Chicago"));

        assertThat(ArrivalService.minutesUntil("2026-07-29T12:04:00", now)).isZero();
    }

    @Test
    void preservesScheduledAndDelayedFlags() throws Exception {
        var eta = new ObjectMapper().readTree("""
                {"rn":"132","rt":"Blue","destNm":"O'Hare","stpDe":"Service toward O'Hare",
                 "arrT":"2099-07-29T12:05:15","isApp":"0","isSch":"1","isDly":"1"}
                """);

        Arrival arrival = ArrivalService.mapArrival(eta);

        assertThat(arrival.arrivalTime()).isEqualTo("2099-07-29T12:05:15");
        assertThat(arrival.scheduled()).isTrue();
        assertThat(arrival.delayed()).isTrue();
    }

    @Test
    void boundedCacheExpiresAndEvictsLeastRecentlyUsedEntry() {
        ArrivalCache cache = new ArrivalCache(Duration.ofSeconds(20), 2);
        Instant now = Instant.parse("2026-07-30T12:00:00Z");
        ArrivalBatch batch = new ArrivalBatch("now", java.util.List.of());

        cache.put("a", batch, now);
        cache.put("b", batch, now);
        assertThat(cache.get("a", now.plusSeconds(1))).isSameAs(batch);
        cache.put("c", batch, now.plusSeconds(2));

        assertThat(cache.contains("a")).isTrue();
        assertThat(cache.contains("b")).isFalse();
        assertThat(cache.get("a", now.plusSeconds(20))).isNull();
    }
}
