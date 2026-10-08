package com.internflow.backend.repository;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import com.internflow.backend.entity.PendingProjectAssignment;
import com.internflow.backend.entity.enums.UserRole;

public interface PendingProjectAssignmentRepository extends JpaRepository<PendingProjectAssignment, Long> {
    List<PendingProjectAssignment> findByEmailIgnoreCaseAndRole(String email, UserRole role);
    boolean existsByEmailIgnoreCaseAndRole(String email, UserRole role);
    boolean existsByProjectIdAndRole(Long projectId, UserRole role);
    List<PendingProjectAssignment> findByProjectId(Long projectId);
    Optional<PendingProjectAssignment> findByProjectIdAndRole(Long projectId, UserRole role);
}
