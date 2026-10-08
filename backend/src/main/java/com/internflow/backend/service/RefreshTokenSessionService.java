package com.internflow.backend.service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.util.HexFormat;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import com.internflow.backend.entity.RefreshTokenSession;
import com.internflow.backend.entity.User;
import com.internflow.backend.repository.RefreshTokenSessionRepository;
import com.internflow.backend.security.JwtService;

/** Persists only hashes of refresh JWTs and consumes each token exactly once. */
@Service
public class RefreshTokenSessionService {
    public enum RotationResult { ACCEPTED, INVALID, REUSED }

    private final RefreshTokenSessionRepository sessions;
    private final JwtService jwtService;

    public RefreshTokenSessionService(RefreshTokenSessionRepository sessions, JwtService jwtService) {
        this.sessions = sessions;
        this.jwtService = jwtService;
    }

    @Transactional
    public void register(String refreshToken, User user) {
        RefreshTokenSession session = new RefreshTokenSession();
        session.setTokenId(jwtService.extractTokenId(refreshToken));
        session.setTokenHash(hash(refreshToken));
        session.setUser(user);
        session.setExpiresAt(jwtService.extractExpiration(refreshToken).toInstant());
        sessions.save(session);
    }

    /**
     * Consumes the presented refresh token. A second presentation means a
     * stolen/replayed credential, so every active session for that user is
     * revoked before reporting the failure.
     */
    @Transactional
    public RotationResult rotate(String refreshToken, Long userId) {
        UUID tokenId;
        try {
            tokenId = jwtService.extractTokenId(refreshToken);
        } catch (RuntimeException exception) {
            return RotationResult.INVALID;
        }
        Instant now = Instant.now();
        RefreshTokenSession session = sessions.findByTokenId(tokenId).orElse(null);
        if (session == null || !session.getUser().getId().equals(userId)
                || !MessageDigest.isEqual(
                        hash(refreshToken).getBytes(StandardCharsets.US_ASCII),
                        session == null ? new byte[0] : session.getTokenHash().getBytes(StandardCharsets.US_ASCII))
                || !session.getExpiresAt().isAfter(now)) {
            return RotationResult.INVALID;
        }
        if (session.getRevokedAt() != null) {
            sessions.revokeActiveByUserId(userId, now);
            return RotationResult.REUSED;
        }
        session.setRevokedAt(now);
        return RotationResult.ACCEPTED;
    }

    @Transactional
    public void revoke(String refreshToken) {
        if (refreshToken == null || refreshToken.isBlank()) return;
        sessions.findByTokenHash(hash(refreshToken)).ifPresent(session -> {
            if (session.getRevokedAt() == null) session.setRevokedAt(Instant.now());
        });
    }

    @Transactional
    public void revokeAll(Long userId) {
        sessions.revokeActiveByUserId(userId, Instant.now());
    }

    private String hash(String token) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                    .digest(token.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 is unavailable", exception);
        }
    }
}
