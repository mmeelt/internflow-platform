package com.internflow.backend.repository;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import jakarta.persistence.LockModeType;
import com.internflow.backend.entity.RefreshTokenSession;

public interface RefreshTokenSessionRepository extends JpaRepository<RefreshTokenSession, Long> {
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    Optional<RefreshTokenSession> findByTokenId(UUID tokenId);

    Optional<RefreshTokenSession> findByTokenHash(String tokenHash);

    @Modifying
    @Query("update RefreshTokenSession tokenSession set tokenSession.revokedAt = :now "
            + "where tokenSession.user.id = :userId and tokenSession.revokedAt is null")
    int revokeActiveByUserId(@Param("userId") Long userId, @Param("now") Instant now);
}
