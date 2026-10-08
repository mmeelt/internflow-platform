package com.internflow.backend.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import com.internflow.backend.entity.ProjectRating;

import java.util.Optional;

public interface ProjectRatingRepository extends JpaRepository<ProjectRating, Long> {
    Optional<ProjectRating> findByProjectIdAndUserId(Long projectId, Long userId);
    long countByProjectId(Long projectId);
    void deleteByProjectId(Long projectId);

    @Query("SELECT AVG(r.rating) FROM ProjectRating r WHERE r.project.id = :projectId")
    Double averageByProjectId(Long projectId);
}
