package org.opentransitchicago.config;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import static org.assertj.core.api.Assertions.assertThat;

class RateLimitFilterTest {
    @Test
    void limitsApiTrafficButLeavesHealthChecksAvailable() throws Exception {
        RateLimitFilter filter = new RateLimitFilter(2, 300, "https://open-transit.example");

        assertThat(run(filter, "/api/stations").getStatus()).isEqualTo(200);
        assertThat(run(filter, "/api/stations").getStatus()).isEqualTo(200);

        MockHttpServletResponse limited = run(filter, "/api/stations");
        assertThat(limited.getStatus()).isEqualTo(429);
        assertThat(limited.getHeader("Retry-After")).isNotBlank();
        assertThat(limited.getHeader("Access-Control-Allow-Origin")).isEqualTo("https://open-transit.example");
        assertThat(run(filter, "/api/health").getStatus()).isEqualTo(200);
    }

    private MockHttpServletResponse run(RateLimitFilter filter, String path) throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", path);
        request.setRemoteAddr("203.0.113.5");
        request.addHeader("Origin", "https://open-transit.example");
        MockHttpServletResponse response = new MockHttpServletResponse();
        filter.doFilter(request, response, new MockFilterChain());
        return response;
    }
}
