package com.internflow.backend.repository;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import com.internflow.backend.entity.InternSkill;

public interface InternSkillRepository extends JpaRepository<InternSkill, Long> {
    List<InternSkill> findByUserIdOrderBySkillAsc(Long userId);
    void deleteByUserId(Long userId);
}
