package com.internflow.backend.security;

import io.jsonwebtoken.JwtException;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import org.springframework.lang.NonNull;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

/**
 * Reads "Authorization: Bearer <token>", validates it, and — if valid —
 * populates the SecurityContext so downstream @PreAuthorize checks and
 * controllers can rely on the authenticated principal.
 *
 * Invalid/expired/missing tokens simply fall through unauthenticated;
 * SecurityConfig then rejects the request with 401 for protected routes.
 */
@Component
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private final JwtService jwtService;
    private final UserDetailsService userDetailsService;

    public JwtAuthenticationFilter(JwtService jwtService, UserDetailsService userDetailsService) {
        this.jwtService = jwtService;
        this.userDetailsService = userDetailsService;
    }

    @Override
    protected void doFilterInternal(
            @NonNull HttpServletRequest request,
            @NonNull HttpServletResponse response,
            @NonNull FilterChain filterChain
    ) throws ServletException, IOException {

        final String authHeader = request.getHeader("Authorization");

        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            filterChain.doFilter(request, response);
            return;
        }

        final String token = authHeader.substring(7);

        try {
            final String email = jwtService.extractUsername(token);

            if (email != null
                    && SecurityContextHolder.getContext().getAuthentication() == null
                    && !jwtService.isRefreshToken(token)) {

                UserDetails userDetails = userDetailsService.loadUserByUsername(email);

                boolean hasCurrentSessionVersion = userDetails instanceof UserPrincipal principal
                        && jwtService.hasCurrentSessionVersion(token, principal.getSessionVersion());
                if (userDetails.isEnabled() && userDetails.isAccountNonLocked()
                        && hasCurrentSessionVersion
                        && jwtService.isTokenValid(token, userDetails)) {
                    UsernamePasswordAuthenticationToken authToken =
                            new UsernamePasswordAuthenticationToken(userDetails, null, userDetails.getAuthorities());
                    authToken.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
                    SecurityContextHolder.getContext().setAuthentication(authToken);
                }
            }
        } catch (JwtException ignored) {
            // Invalid token -> leave unauthenticated, let SecurityConfig 401 it
            // (JwtException also covers io.jsonwebtoken.io.DecodingException, a subclass)
            SecurityContextHolder.clearContext();
        }
        filterChain.doFilter(request, response);
    }
}
