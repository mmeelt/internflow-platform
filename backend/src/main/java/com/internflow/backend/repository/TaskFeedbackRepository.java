package com.internflow.backend.repository;

import com.internflow.backend.entity.TaskFeedback;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface TaskFeedbackRepository extends JpaRepository<TaskFeedback, Long> {
    List<TaskFeedback> findByTaskIdOrderByCreatedAtAsc(Long taskId);
}
