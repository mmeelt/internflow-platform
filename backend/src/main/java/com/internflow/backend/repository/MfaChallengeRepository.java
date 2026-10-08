package com.internflow.backend.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import com.internflow.backend.entity.MfaChallenge;
import java.util.UUID;
import java.util.Optional;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface MfaChallengeRepository extends JpaRepository<MfaChallenge, UUID> {
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select challenge from MfaChallenge challenge where challenge.id = :id")
    Optional<MfaChallenge> findLockedById(@Param("id") UUID id);
}
