package org.opentransitchicago.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Arrays;
import java.util.Set;
import java.util.stream.Collectors;
import java.util.concurrent.ConcurrentHashMap;

@Component
public class RateLimitFilter extends OncePerRequestFilter {
    private static final int MAX_CLIENTS = 4096;

    private final int requestLimit;
    private final long windowMillis;
    private final Set<String> allowedOrigins;
    private final ConcurrentHashMap<String, Counter> counters = new ConcurrentHashMap<>();

    public RateLimitFilter(@Value("${app.rate-limit.requests:300}") int requestLimit,
                           @Value("${app.rate-limit.window-seconds:300}") long windowSeconds,
                           @Value("${app.allowed-origins:}") String allowedOrigins) {
        this.requestLimit = Math.max(1, requestLimit);
        this.windowMillis = Math.max(1, windowSeconds) * 1000;
        this.allowedOrigins = Arrays.stream(allowedOrigins.split(","))
                .map(String::trim)
                .filter(origin -> !origin.isEmpty())
                .collect(Collectors.toUnmodifiableSet());
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        return !request.getRequestURI().startsWith("/api/")
                || request.getRequestURI().equals("/api/health")
                || request.getMethod().equalsIgnoreCase("OPTIONS");
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        long now = System.currentTimeMillis();
        long window = now / windowMillis;
        String client = request.getRemoteAddr();

        if (!counters.containsKey(client) && counters.size() >= MAX_CLIENTS) {
            counters.entrySet().removeIf(entry -> entry.getValue().window() < window);
            if (counters.size() >= MAX_CLIENTS) {
                counters.keySet().stream().findFirst().ifPresent(counters::remove);
            }
        }

        Counter counter = counters.compute(client, (key, existing) ->
                existing == null || existing.window() != window
                        ? new Counter(window, 1)
                        : new Counter(window, existing.requests() + 1));

        if (counter.requests() > requestLimit) {
            long retryAfter = Math.max(1, ((window + 1) * windowMillis - now + 999) / 1000);
            String origin = request.getHeader("Origin");
            if (origin != null && allowedOrigins.contains(origin)) {
                response.setHeader("Access-Control-Allow-Origin", origin);
                response.setHeader("Vary", "Origin");
            }
            response.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
            response.setHeader("Retry-After", Long.toString(retryAfter));
            response.setContentType("application/json");
            response.getWriter().write("{\"message\":\"Too many requests. Try again shortly.\"}");
            return;
        }

        filterChain.doFilter(request, response);
    }

    private record Counter(long window, int requests) {
    }
}
