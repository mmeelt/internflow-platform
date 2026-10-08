package com.internflow.backend.service;

import com.internflow.backend.dto.PersonalCalendarTaskDto;
import com.internflow.backend.entity.PersonalCalendarTask;
import com.internflow.backend.entity.User;
import com.internflow.backend.entity.enums.TaskPriority;
import com.internflow.backend.exception.ApiException;
import com.internflow.backend.repository.PersonalCalendarTaskRepository;
import com.internflow.backend.repository.UserRepository;
import com.internflow.backend.security.UserPrincipal;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.LocalDate;
import java.util.List;

@Service
public class PersonalCalendarTaskService {
    private final PersonalCalendarTaskRepository repository;
    private final UserRepository userRepository;
    public PersonalCalendarTaskService(PersonalCalendarTaskRepository repository, UserRepository userRepository) {
        this.repository = repository; this.userRepository = userRepository;
    }

    @Transactional(readOnly = true)
    public List<PersonalCalendarTaskDto> list(UserPrincipal principal) {
        return repository.findByStudentIdOrderByStartDateAsc(principal.getId()).stream().map(this::toDto).toList();
    }

    @Transactional
    public PersonalCalendarTaskDto create(CreateRequest request, UserPrincipal principal) {
        if (request.dueDate() != null && request.dueDate().isBefore(request.startDate())) {
            throw ApiException.badRequest("Deadline cannot be before the start date");
        }
        TaskPriority priority;
        try { priority = TaskPriority.valueOf(request.priority().toLowerCase()); }
        catch (Exception ex) { throw ApiException.badRequest("Priority must be low, medium, or high"); }
        User student = userRepository.findById(principal.getId()).orElseThrow(() -> ApiException.notFound("Student not found"));
        PersonalCalendarTask task = new PersonalCalendarTask();
        task.setStudent(student); task.setTitle(request.title()); task.setDescription(request.description());
        task.setStartDate(request.startDate()); task.setDueDate(request.dueDate()); task.setCategory(request.category()); task.setPriority(priority);
        return toDto(repository.save(task));
    }

    @Transactional
    public void delete(Long id, UserPrincipal principal) {
        PersonalCalendarTask task = repository.findById(id).orElseThrow(() -> ApiException.notFound("Calendar task not found"));
        if (!task.getStudent().getId().equals(principal.getId())) throw ApiException.forbidden("You cannot delete this calendar task");
        repository.delete(task);
    }

    @Transactional
    public PersonalCalendarTaskDto updateStatus(Long id, String status, UserPrincipal principal) {
        if (!"todo".equals(status) && !"done".equals(status)) throw ApiException.badRequest("Status must be todo or done");
        PersonalCalendarTask task = repository.findById(id).orElseThrow(() -> ApiException.notFound("Calendar task not found"));
        if (!task.getStudent().getId().equals(principal.getId())) throw ApiException.forbidden("You cannot update this calendar task");
        task.setStatus(status);
        return toDto(repository.save(task));
    }

    private PersonalCalendarTaskDto toDto(PersonalCalendarTask task) {
        return new PersonalCalendarTaskDto(task.getId(), task.getTitle(), task.getDescription(), task.getStartDate(), task.getDueDate(), task.getCategory(), task.getPriority().name(), task.getStatus());
    }
    public record CreateRequest(String title, String description, LocalDate startDate, LocalDate dueDate, String category, String priority) {}
}
