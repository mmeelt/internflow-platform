package com.internflow.backend.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import com.internflow.backend.entity.EnterpriseProject;
import java.util.List;

public interface EnterpriseProjectRepository extends JpaRepository<EnterpriseProject, Long> {
    List<EnterpriseProject> findAllByOrderByIdDesc();
}
