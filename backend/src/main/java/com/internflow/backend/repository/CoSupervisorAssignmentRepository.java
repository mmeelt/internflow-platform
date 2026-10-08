package com.internflow.backend.repository;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import com.internflow.backend.entity.CoSupervisorAssignment;

public interface CoSupervisorAssignmentRepository extends JpaRepository<CoSupervisorAssignment, Long> {
    Optional<CoSupervisorAssignment> findByInternshipIdAndSupervisorId(Long internshipId, Long supervisorId);
    List<CoSupervisorAssignment> findByInternshipId(Long internshipId);

    @EntityGraph(attributePaths = {"internship", "internship.intern", "internship.supervisor"})
    List<CoSupervisorAssignment> findBySupervisorIdAndStatusOrderByCreatedAtDesc(Long supervisorId, String status);
}
