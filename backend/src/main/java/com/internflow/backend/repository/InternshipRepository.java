package com.internflow.backend.repository;

import com.internflow.backend.entity.Internship;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;

public interface InternshipRepository extends JpaRepository<Internship, Long> {
    @Override
    @EntityGraph(attributePaths = { "intern", "supervisor" })
    List<Internship> findAll();

    List<Internship> findByInternId(Long internId);

    Optional<Internship> findByEnterpriseProjectId(Long enterpriseProjectId);

    /**
     * The supervisor dashboard immediately renders the intern details for
     * every internship. Fetch them in the same query so the API is safe with
     * Open Session in View disabled.
     */
    @EntityGraph(attributePaths = { "intern", "supervisor" })
    List<Internship> findBySupervisorId(Long supervisorId);

    @Query("""
            SELECT DISTINCT i FROM Internship i
            JOIN FETCH i.intern
            JOIN FETCH i.supervisor
            WHERE i.intern.id = :userId OR i.supervisor.id = :userId OR EXISTS (
                SELECT c.id FROM CoSupervisorAssignment c
                WHERE c.internship.id = i.id
                  AND c.supervisor.id = :userId
                  AND c.status = 'accepted'
            )
            """)
    List<Internship> findReadableByUserId(Long userId);

    @Query("SELECT COUNT(c) > 0 FROM CoSupervisorAssignment c WHERE c.internship.id = :internshipId AND c.supervisor.id = :supervisorId AND c.status = 'accepted'")
    boolean existsAcceptedCoSupervisor(Long internshipId, Long supervisorId);
}
