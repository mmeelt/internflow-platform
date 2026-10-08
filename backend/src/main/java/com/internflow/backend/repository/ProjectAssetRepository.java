package com.internflow.backend.repository;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import com.internflow.backend.entity.ProjectAsset;

public interface ProjectAssetRepository extends JpaRepository<ProjectAsset, Long> {
    List<ProjectAsset> findByProjectIdOrderByUploadedAtAsc(Long projectId);
    void deleteByProjectId(Long projectId);
}
