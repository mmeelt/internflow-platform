package com.internflow.backend.repository;

import com.internflow.backend.entity.PersonalCalendarTask;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface PersonalCalendarTaskRepository extends JpaRepository<PersonalCalendarTask, Long> {
    List<PersonalCalendarTask> findByStudentIdOrderByStartDateAsc(Long studentId);
}
