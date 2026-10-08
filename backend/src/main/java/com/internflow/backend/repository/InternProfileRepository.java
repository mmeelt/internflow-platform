package com.internflow.backend.repository;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import com.internflow.backend.entity.InternProfile;
public interface InternProfileRepository extends JpaRepository<InternProfile, Long> { Optional<InternProfile> findByUserId(Long userId); }
