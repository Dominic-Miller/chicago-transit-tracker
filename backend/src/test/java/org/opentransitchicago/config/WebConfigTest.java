package org.opentransitchicago.config;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class WebConfigTest {
    @Test
    void parsesOnlyExplicitNonEmptyOrigins() {
        WebConfig config = new WebConfig("https://one.example, https://two.example, ,");

        assertThat(config.allowedOrigins()).containsExactly(
                "https://one.example",
                "https://two.example"
        );
    }
}
