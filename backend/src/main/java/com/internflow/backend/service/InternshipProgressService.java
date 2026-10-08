package com.internflow.backend.service;

import org.springframework.stereotype.Service;
import com.internflow.backend.repository.TaskRepository;

/**
 * Single source of truth for internship progress:
 * completed (done or reviewed) tasks / all available tasks.
 */
@Service
public class InternshipProgressService {
    private final TaskRepository taskRepository;

    public InternshipProgressService(TaskRepository taskRepository) {
        this.taskRepository = taskRepository;
    }

    public int calculate(Long internshipId) {
        long total = taskRepository.countByInternshipId(internshipId);
        if (total == 0) return 0;
        long completed = taskRepository.countByInternshipIdAndStatus(internshipId, "done")
                + taskRepository.countByInternshipIdAndStatus(internshipId, "reviewed");
        return (int) Math.round(completed * 100.0 / total);
    }
}
