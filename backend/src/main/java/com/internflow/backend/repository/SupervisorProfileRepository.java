package com.internflow.backend.repository;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import com.internflow.backend.entity.SupervisorProfile;
public interface SupervisorProfileRepository extends JpaRepository<SupervisorProfile, Long> { Optional<SupervisorProfile> findByUserId(Long userId); }
