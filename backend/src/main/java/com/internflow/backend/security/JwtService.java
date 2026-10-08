package com.internflow.backend.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.util.Date;
import java.util.List;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
public class JwtService {

    private final SecretKey key;
    private final long accessTokenExpirationMs;
    private final long refreshTokenExpirationMs;
    private final String issuer;
    private final String audience;

    public JwtService(
            @Value("${security.jwt.secret}") String secret,
            @Value("${security.jwt.access-token-expiration-ms}") long accessTokenExpirationMs,
            @Value("${security.jwt.refresh-token-expiration-ms}") long refreshTokenExpirationMs,
            @Value("${security.jwt.issuer}") String issuer,
            @Value("${security.jwt.audience}") String audience
    ) {
        // secret must be a Base64-encoded string of at least 256 bits (32 bytes) for HS256
        this.key = Keys.hmacShaKeyFor(java.util.Base64.getDecoder().decode(secret));
        this.accessTokenExpirationMs = accessTokenExpirationMs;
        this.refreshTokenExpirationMs = refreshTokenExpirationMs;
        this.issuer = issuer;
        this.audience = audience;
    }

    public String generateAccessToken(UserPrincipal principal) {
        List<String> roles = principal.getAuthorities().stream()
                .map(Object::toString)
                .collect(Collectors.toList());

        return Jwts.builder()
                .subject(principal.getUsername())
                .claim("uid", principal.getId())
                .claim("sv", principal.getSessionVersion())
                .claim("roles", roles)
                .claim("type", "access")
                .issuer(issuer)
                .audience().add(audience).and()
                .issuedAt(new Date())
                .expiration(new Date(System.currentTimeMillis() + accessTokenExpirationMs))
                .signWith(key)
                .compact();
    }

    public String generateRefreshToken(UserPrincipal principal) {
        return Jwts.builder()
                .id(UUID.randomUUID().toString())
                .subject(principal.getUsername())
                .claim("uid", principal.getId())
                .claim("sv", principal.getSessionVersion())
                .claim("type", "refresh")
                .issuer(issuer)
                .audience().add(audience).and()
                .issuedAt(new Date())
                .expiration(new Date(System.currentTimeMillis() + refreshTokenExpirationMs))
                .signWith(key)
                .compact();
    }

    public String extractUsername(String token) {
        return extractClaim(token, Claims::getSubject);
    }

    public String extractTokenType(String token) {
        return extractClaim(token, c -> c.get("type", String.class));
    }

    public UUID extractTokenId(String token) {
        return UUID.fromString(extractClaim(token, Claims::getId));
    }

    public Date extractExpiration(String token) {
        return extractClaim(token, Claims::getExpiration);
    }

    public boolean wasIssuedBeforePasswordChange(String token, java.time.Instant passwordChangedAt) {
        return passwordChangedAt != null
                && extractClaim(token, Claims::getIssuedAt).toInstant().isBefore(passwordChangedAt);
    }

    public boolean hasCurrentSessionVersion(String token, int sessionVersion) {
        Integer tokenVersion = extractClaim(token, claims -> claims.get("sv", Integer.class));
        return tokenVersion != null && tokenVersion == sessionVersion;
    }

    public boolean isTokenValid(String token, UserDetails userDetails) {
        final String username = extractUsername(token);
        return username.equals(userDetails.getUsername()) && !isTokenExpired(token);
    }

    public boolean isRefreshToken(String token) {
        return "refresh".equals(extractTokenType(token));
    }

    private boolean isTokenExpired(String token) {
        return extractClaim(token, Claims::getExpiration).before(new Date());
    }

    private <T> T extractClaim(String token, Function<Claims, T> resolver) {
        Claims claims = extractAllClaims(token);
        return resolver.apply(claims);
    }

    private Claims extractAllClaims(String token) {
        try {
            return Jwts.parser()
                    .verifyWith(key)
                    .requireIssuer(issuer)
                    .requireAudience(audience)
                    .build()
                    .parseSignedClaims(token)
                    .getPayload();
        } catch (JwtException | IllegalArgumentException e) {
            throw new JwtException("Invalid or expired JWT token", e);
        }
    }
}
