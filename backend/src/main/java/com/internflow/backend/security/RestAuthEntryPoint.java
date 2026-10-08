package com.internflow.backend.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import org.springframework.security.core.AuthenticationException;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.time.Instant;
import java.util.Map;

/** Returns a JSON 401 instead of Spring's default HTML login page/redirect. */
@Component
public class RestAuthEntryPoint implements AuthenticationEntryPoint {

    private final ObjectMapper mapper = new ObjectMapper();

    @Override
    public void commence(HttpServletRequest request, HttpServletResponse response, AuthenticationException authException)
            throws IOException {
        response.setContentType("application/json");
        response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
        response.getWriter().write(mapper.writeValueAsString(Map.of(
                "timestamp", Instant.now().toString(),
                "status", 401,
                "error", "Unauthorized",
                "message", "Authentication required or token invalid/expired",
                "path", request.getRequestURI()
        )));
    }
}
