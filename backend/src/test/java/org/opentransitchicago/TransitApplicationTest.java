package org.opentransitchicago;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;

@SpringBootTest(properties = "cta.api-key=test-key")
class TransitApplicationTest {
    @Test
    void contextLoads() {
    }
}
