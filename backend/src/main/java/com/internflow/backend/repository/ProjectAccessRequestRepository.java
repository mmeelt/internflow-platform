package com.internflow.backend.repository;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import com.internflow.backend.entity.ProjectAccessRequest;

public interface ProjectAccessRequestRepository extends JpaRepository<ProjectAccessRequest, Long> {
    List<ProjectAccessRequest> findByProjectIdAndRequesterId(Long projectId, Long requesterId);
    Optional<ProjectAccessRequest> findByProjectIdAndRequesterIdAndAssetType(Long projectId, Long requesterId, String assetType);
    List<ProjectAccessRequest> findByProject_Supervisor_IdAndStatusOrderByCreatedAtDesc(Long supervisorId, String status);
    void deleteByProjectId(Long projectId);
}
