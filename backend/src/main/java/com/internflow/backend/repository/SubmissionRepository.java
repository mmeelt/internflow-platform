package com.internflow.backend.repository;

import com.internflow.backend.entity.Submission;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.time.Instant;

public interface SubmissionRepository extends JpaRepository<Submission, Long> {
    interface SupervisorActivityView {
        Long getId();
        String getInternName();
        String getAction();
        Instant getOccurredAt();
    }
    List<Submission> findByTaskId(Long taskId);

    /** Total submissions across all tasks belonging to a given internship. */
    long countByTaskInternshipId(Long internshipId);

    long countByTaskId(Long taskId);

    @Query(value = "SELECT DISTINCT s.* FROM submissions s " +
           "JOIN tasks t ON t.id = s.task_id JOIN internships i ON i.id = t.internship_id " +
           "LEFT JOIN co_supervisor_assignments c ON c.internship_id = i.id AND c.status = 'accepted' " +
           "WHERE i.intern_id = :userId OR i.supervisor_id = :userId OR c.supervisor_id = :userId ORDER BY s.uploaded_at DESC", nativeQuery = true)
    List<Submission> findVisibleToUser(Long userId);

    @Query("SELECT s FROM Submission s JOIN FETCH s.task t JOIN FETCH t.internship i JOIN FETCH i.intern ORDER BY s.uploadedAt DESC")
    List<Submission> findAllByOrderByUploadedAtDesc();

    @Query(value = """
            SELECT s.id AS id,
                   u.name AS internName,
                   CONCAT('Uploaded ', s.name, ' for ', t.title) AS action,
                   s.uploaded_at AS occurredAt
            FROM submissions s
            JOIN tasks t ON t.id = s.task_id
            JOIN internships i ON i.id = t.internship_id
            JOIN users u ON u.id = i.intern_id
            LEFT JOIN co_supervisor_assignments c
                   ON c.internship_id = i.id
                  AND c.supervisor_id = :supervisorId
                  AND c.status = 'accepted'
            WHERE i.supervisor_id = :supervisorId OR c.id IS NOT NULL
            ORDER BY s.uploaded_at DESC
            LIMIT 8
            """, nativeQuery = true)
    List<SupervisorActivityView> findRecentStudentActivityForSupervisor(Long supervisorId);
}
