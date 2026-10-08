package com.internflow.backend.service;

import jakarta.servlet.http.HttpServletRequest;
import java.time.Clock;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.stereotype.Service;
import com.internflow.backend.exception.ApiException;

@Service
public class SecurityRateLimiter {
    private final ConcurrentHashMap<String, Deque<Long>> attempts = new ConcurrentHashMap<>();
    private final Clock clock = Clock.systemUTC();

    public void require(String action, String identity, int maximum, long windowSeconds) {
        String safeIdentity = identity == null ? "unknown" : identity.trim().toLowerCase();
        String key = action + ":" + safeIdentity;
        long now = clock.millis();
        long cutoff = now - windowSeconds * 1000L;
        Deque<Long> bucket = attempts.computeIfAbsent(key, ignored -> new ArrayDeque<>());
        synchronized (bucket) {
            while (!bucket.isEmpty() && bucket.peekFirst() < cutoff) bucket.removeFirst();
            if (bucket.size() >= maximum) {
                throw ApiException.tooManyRequests("Too many requests. Please wait and try again.");
            }
            bucket.addLast(now);
        }
        if (attempts.size() > 20_000) {
            attempts.entrySet().removeIf(entry -> {
                Deque<Long> values = entry.getValue();
                synchronized (values) {
                    return values.isEmpty() || values.peekLast() < cutoff;
                }
            });
        }
    }

    public String clientIp(HttpServletRequest request) {
        // Trust proxy headers only when the application is deployed behind a
        // configured reverse proxy that removes client-supplied forwarding headers.
        return request.getRemoteAddr();
    }
}
