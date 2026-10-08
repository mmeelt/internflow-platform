package com.internflow.backend.repository;

import com.internflow.backend.entity.Task;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.time.LocalDate;

public interface TaskRepository extends JpaRepository<Task, Long> {
    List<Task> findByInternshipId(Long internshipId);

    long countByInternshipId(Long internshipId);

    @Query("SELECT COUNT(t) FROM Task t WHERE t.internship.id = :internshipId AND t.status = :status")
    long countByInternshipIdAndStatus(@Param("internshipId") Long internshipId,
                                      @Param("status") String status);

    @Query("""
            SELECT t FROM Task t
            WHERE t.internship.id = :internshipId
              AND LOWER(t.title) = LOWER(:title)
              AND t.dueDate = :dueDate
              AND COALESCE(t.description, '') = COALESCE(:description, '')
              AND t.createdAt >= :createdAfter
            ORDER BY t.createdAt DESC
            """)
    List<Task> findRecentMatchingTasks(
            @Param("internshipId") Long internshipId,
            @Param("title") String title,
            @Param("description") String description,
            @Param("dueDate") LocalDate dueDate,
            @Param("createdAfter") java.time.Instant createdAfter);

    @Query("""
            SELECT t FROM Task t
            JOIN FETCH t.internship i
            JOIN FETCH i.intern
            WHERE (i.supervisor.id = :supervisorId OR EXISTS (
                SELECT c.id FROM CoSupervisorAssignment c
                WHERE c.internship.id = i.id
                  AND c.supervisor.id = :supervisorId
                  AND c.status = 'accepted'
            ))
              AND t.dueDate IS NOT NULL
              AND t.dueDate >= :today
              AND LOWER(t.status) NOT IN ('done', 'reviewed')
            ORDER BY t.dueDate ASC, t.id ASC
            """)
    List<Task> findUpcomingForSupervisor(
            @Param("supervisorId") Long supervisorId,
            @Param("today") LocalDate today);
}
