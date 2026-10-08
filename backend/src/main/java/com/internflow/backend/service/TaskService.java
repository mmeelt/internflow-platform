package com.internflow.backend.service;

import com.internflow.backend.dto.TaskDto;
import com.internflow.backend.entity.Internship;
import com.internflow.backend.entity.Task;
import com.internflow.backend.entity.enums.TaskPriority;
import com.internflow.backend.entity.enums.NotificationType;
import com.internflow.backend.exception.ApiException;
import com.internflow.backend.entity.TaskFeedback;
import com.internflow.backend.entity.User;
import com.internflow.backend.repository.InternshipRepository;
import com.internflow.backend.repository.SubmissionRepository;
import com.internflow.backend.repository.TaskRepository;
import com.internflow.backend.repository.UserRepository;
import com.internflow.backend.repository.TaskFeedbackRepository;
import com.internflow.backend.repository.CoSupervisorAssignmentRepository;
import com.internflow.backend.security.UserPrincipal;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

@Service
public class TaskService {

    private final TaskRepository taskRepository;
    private final InternshipRepository internshipRepository;
    private final SubmissionRepository submissionRepository;
    private final NotificationService notificationService;
    private final UserRepository userRepository;
    private final TaskFeedbackRepository taskFeedbackRepository;
    private final CoSupervisorAssignmentRepository coSupervisorAssignmentRepository;

    public TaskService(TaskRepository taskRepository,
                       InternshipRepository internshipRepository,
                       SubmissionRepository submissionRepository,
                       NotificationService notificationService,
                       UserRepository userRepository,
                       TaskFeedbackRepository taskFeedbackRepository,
                       CoSupervisorAssignmentRepository coSupervisorAssignmentRepository) {
        this.taskRepository = taskRepository;
        this.internshipRepository = internshipRepository;
        this.submissionRepository = submissionRepository;
        this.notificationService = notificationService;
        this.userRepository = userRepository;
        this.taskFeedbackRepository = taskFeedbackRepository;
        this.coSupervisorAssignmentRepository = coSupervisorAssignmentRepository;
    }

    // ── Queries ───────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<TaskDto> listForInternship(Long internshipId, UserPrincipal principal) {
        Internship internship = getInternship(internshipId);
        checkMemberAccess(internship, principal);
        return taskRepository.findByInternshipId(internshipId).stream().map(this::toDto).toList();
    }

    @Transactional(readOnly = true)
    public TaskDto findById(Long internshipId, Long taskId, UserPrincipal principal) {
        Internship internship = getInternship(internshipId);
        checkMemberAccess(internship, principal);
        Task task = taskRepository.findById(taskId)
                .orElseThrow(() -> ApiException.notFound("Task not found"));
        if (!task.getInternship().getId().equals(internshipId)) {
            throw ApiException.notFound("Task not found");
        }
        return toDto(task);
    }

    // ── Commands ──────────────────────────────────────────────────────────────

    @Transactional
    public TaskDto create(Long internshipId, CreateRequest req, UserPrincipal principal) {
        Internship internship = getInternship(internshipId);
        // Only the supervisor, co-supervisor or an admin may create tasks
        if (!isSupervisorOf(internship, principal) && !isCoSupervisorOf(internship, principal) && !isAdmin(principal)) {
            throw ApiException.forbidden("Only the assigned supervisor or co-supervisor may create tasks");
        }

        String title = req.title().trim();
        String description = req.description() == null || req.description().isBlank() ? null : req.description().trim();
        // A double-click or a transient client retry must not create two
        // identical assignments. A deliberately repeated task can still be
        // created after this short request window.
        if (!taskRepository.findRecentMatchingTasks(
                internshipId, title, description, req.dueDate(), Instant.now().minusSeconds(15)).isEmpty()) {
            throw ApiException.conflict("This identical task was just assigned. Please wait before trying again.");
        }

        Task task = new Task();
        task.setInternship(internship);
        task.setTitle(title);
        task.setDescription(description);
        task.setDueDate(req.dueDate());
        if (req.priority() != null) {
            try {
                task.setPriority(TaskPriority.valueOf(req.priority().toLowerCase()));
            } catch (IllegalArgumentException e) {
                throw ApiException.badRequest("Priority must be: low, medium, or high");
            }
        }
        Task saved = taskRepository.save(task);
        User creator = userRepository.findById(principal.getId()).orElse(null);
        String creatorName = (creator != null) ? creator.getName() : "A supervisor";
        notificationService.send(internship.getIntern().getId(), NotificationType.deadline,
                "New task assigned", creatorName + " assigned: " + saved.getTitle());
        return toDto(saved);
    }

    @Transactional
    public TaskDto updateStatus(Long internshipId, Long taskId, StatusUpdateRequest req, UserPrincipal principal) {
        Internship internship = getInternship(internshipId);
        Task task = taskRepository.findById(taskId)
                .orElseThrow(() -> ApiException.notFound("Task not found"));

        if (!task.getInternship().getId().equals(internshipId)) {
            throw ApiException.notFound("Task not found");
        }

        // The intern updates their own task progress/status; supervisor, co-supervisor, or admin can also update
        if (!isInternOf(internship, principal) && !isSupervisorOf(internship, principal) && !isCoSupervisorOf(internship, principal) && !isAdmin(principal)) {
            throw ApiException.forbidden("You do not have access to this task");
        }

        if (req.status() != null) {
            task.setStatus(req.status());
            if ("reviewed".equalsIgnoreCase(req.status())) {
                task.setReviewedAt(Instant.now());
            }
        }
        if (req.progress() != null) {
            if (req.progress() < 0 || req.progress() > 100) throw ApiException.badRequest("Progress must be 0–100");
            task.setProgress(req.progress());
        }
        // Supervisors/co-supervisors/admins can add feedback
        User author = null;
        if (req.feedback() != null && (isSupervisorOf(internship, principal) || isCoSupervisorOf(internship, principal) || isAdmin(principal))) {
            task.setFeedback(req.feedback());
            
            // Create a TaskFeedback record
            TaskFeedback tf = new TaskFeedback();
            tf.setTask(task);
            author = userRepository.findById(principal.getId()).orElseThrow();
            tf.setAuthor(author);
            tf.setAuthorName(author.getName());
            tf.setContent(req.feedback());
            taskFeedbackRepository.save(tf);
        }

        Task saved = taskRepository.save(task);
        if (req.feedback() != null && (isSupervisorOf(internship, principal) || isCoSupervisorOf(internship, principal) || isAdmin(principal))) {
            String authorName = (author != null) ? author.getName() : "Supervisor";
            notificationService.send(internship.getIntern().getId(), NotificationType.feedback,
                    "New feedback from " + authorName, "Feedback was added to: " + saved.getTitle());
        } else if ("done".equalsIgnoreCase(req.status()) && isInternOf(internship, principal)) {
            notificationService.send(internship.getSupervisor().getId(), NotificationType.review,
                    "Task ready for review", internship.getIntern().getName() + " completed: " + saved.getTitle());
            coSupervisorAssignmentRepository.findByInternshipId(internship.getId()).stream()
                    .filter(a -> "accepted".equalsIgnoreCase(a.getStatus()))
                    .forEach(a -> notificationService.send(a.getSupervisor().getId(), NotificationType.review,
                            "Task ready for review", internship.getIntern().getName() + " completed: " + saved.getTitle()));
        }
        return toDto(saved);
    }

    @Transactional
    public TaskDto addFeedback(Long internshipId, Long taskId, String content, UserPrincipal principal) {
        Internship internship = getInternship(internshipId);
        Task task = taskRepository.findById(taskId)
                .orElseThrow(() -> ApiException.notFound("Task not found"));

        if (!task.getInternship().getId().equals(internshipId)) {
            throw ApiException.notFound("Task not found");
        }

        if (!isSupervisorOf(internship, principal) && !isCoSupervisorOf(internship, principal) && !isAdmin(principal)) {
            throw ApiException.forbidden("Only supervisors can add feedback");
        }

        if (content == null || content.isBlank()) {
            throw ApiException.badRequest("Feedback content cannot be empty");
        }

        // Add to legacy feedback field and transition task status to reviewed
        task.setFeedback(content.trim());
        task.setStatus("reviewed");
        task.setReviewedAt(Instant.now());
        taskRepository.save(task);

        // Save to task_feedbacks table
        TaskFeedback tf = new TaskFeedback();
        tf.setTask(task);
        User author = userRepository.findById(principal.getId()).orElseThrow();
        tf.setAuthor(author);
        tf.setAuthorName(author.getName());
        tf.setContent(content.trim());
        taskFeedbackRepository.save(tf);

        notificationService.send(internship.getIntern().getId(), NotificationType.feedback,
                "New feedback from " + author.getName(), "Feedback was added to: " + task.getTitle());

        return toDto(task);
    }

    @Transactional
    public void delete(Long internshipId, Long taskId, UserPrincipal principal) {
        Internship internship = getInternship(internshipId);
        if (!isSupervisorOf(internship, principal) && !isCoSupervisorOf(internship, principal) && !isAdmin(principal)) {
            throw ApiException.forbidden("Only the assigned supervisor or co-supervisor may delete tasks");
        }

        Task task = taskRepository.findById(taskId)
                .orElseThrow(() -> ApiException.notFound("Task not found"));
        if (!task.getInternship().getId().equals(internshipId)) {
            throw ApiException.notFound("Task not found");
        }

        // The database foreign key removes the linked submission records too.
        taskRepository.delete(task);
    }

    // ── Request records ───────────────────────────────────────────────────────

    public record CreateRequest(String title, String description, LocalDate dueDate, String priority) {}
    public record StatusUpdateRequest(String status, Integer progress, String feedback) {}

    // ── Helpers ───────────────────────────────────────────────────────────────

    private Internship getInternship(Long internshipId) {
        return internshipRepository.findById(internshipId)
                .orElseThrow(() -> ApiException.notFound("Internship not found"));
    }

    private void checkMemberAccess(Internship internship, UserPrincipal principal) {
        if (isAdmin(principal)) return;
        if (!isInternOf(internship, principal) && !isSupervisorOf(internship, principal) && !isCoSupervisorOf(internship, principal)) {
            throw ApiException.forbidden("You do not have access to this internship");
        }
    }

    private boolean isAdmin(UserPrincipal principal) {
        return "ROLE_ADMIN".equals(principal.getAuthorities().iterator().next().getAuthority());
    }

    private boolean isSupervisorOf(Internship internship, UserPrincipal principal) {
        return internship.getSupervisor().getId().equals(principal.getId());
    }

    private boolean isInternOf(Internship internship, UserPrincipal principal) {
        return internship.getIntern().getId().equals(principal.getId());
    }

    private boolean isCoSupervisorOf(Internship internship, UserPrincipal principal) {
        return internshipRepository.existsAcceptedCoSupervisor(internship.getId(), principal.getId());
    }

    // ── Mapper ────────────────────────────────────────────────────────────────

    private com.internflow.backend.dto.SubmissionDto toSubmissionDto(com.internflow.backend.entity.Submission s) {
        return new com.internflow.backend.dto.SubmissionDto(
                s.getId(),
                s.getTask().getId(),
                s.getName(),
                s.getSize(),
                s.getType().name(),
                s.getFilePath(),
                s.getUploadedAt()
        );
    }

    private TaskDto toDto(Task t) {
        List<com.internflow.backend.dto.SubmissionDto> submissions = submissionRepository.findByTaskId(t.getId())
                .stream().map(this::toSubmissionDto).toList();

        List<com.internflow.backend.dto.TaskFeedbackDto> feedbacks = taskFeedbackRepository.findByTaskIdOrderByCreatedAtAsc(t.getId())
                .stream()
                .map(f -> new com.internflow.backend.dto.TaskFeedbackDto(
                        f.getId(),
                        f.getTask().getId(),
                        f.getAuthor().getId(),
                        f.getAuthorName(),
                        f.getContent(),
                        f.getCreatedAt()
                ))
                .toList();

        return new TaskDto(
                t.getId(),
                t.getInternship().getId(),
                t.getTitle(),
                t.getDescription(),
                t.getDueDate(),
                t.getPriority().name(),
                t.getStatus(),
                t.getProgress(),
                t.getFeedback(),
                t.getReviewedAt(),
                t.getCreatedAt(),
                submissions,
                feedbacks
        );
    }
}
