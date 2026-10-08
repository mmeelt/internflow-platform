package com.internflow.backend.controller;

import com.internflow.backend.dto.TaskDto;
import com.internflow.backend.security.UserPrincipal;
import com.internflow.backend.service.TaskService;
import com.internflow.backend.service.TaskService.CreateRequest;
import com.internflow.backend.service.TaskService.StatusUpdateRequest;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/internships/{internshipId}/tasks")
public class TaskController {

    private final TaskService taskService;

    public TaskController(TaskService taskService) {
        this.taskService = taskService;
    }

    /** GET /api/internships/{internshipId}/tasks */
    @GetMapping
    public ResponseEntity<List<TaskDto>> list(@PathVariable Long internshipId,
                                              @AuthenticationPrincipal UserPrincipal principal) {
        return ResponseEntity.ok(taskService.listForInternship(internshipId, principal));
    }

    /** GET /api/internships/{internshipId}/tasks/{taskId} */
    @GetMapping("/{taskId}")
    public ResponseEntity<TaskDto> getOne(@PathVariable Long internshipId,
                                          @PathVariable Long taskId,
                                          @AuthenticationPrincipal UserPrincipal principal) {
        return ResponseEntity.ok(taskService.findById(internshipId, taskId, principal));
    }

    /** POST /api/internships/{internshipId}/tasks — supervisor/admin only */
    @PostMapping
    public ResponseEntity<TaskDto> create(@PathVariable Long internshipId,
                                          @Valid @RequestBody CreateBody body,
                                          @AuthenticationPrincipal UserPrincipal principal) {
        CreateRequest req = new CreateRequest(body.title(), body.description(), body.dueDate(), body.priority());
        return ResponseEntity.status(HttpStatus.CREATED).body(taskService.create(internshipId, req, principal));
    }

    /** PATCH /api/internships/{internshipId}/tasks/{taskId} — update status, progress, or feedback */
    @PatchMapping("/{taskId}")
    public ResponseEntity<TaskDto> update(@PathVariable Long internshipId,
                                          @PathVariable Long taskId,
                                          @RequestBody StatusUpdateBody body,
                                          @AuthenticationPrincipal UserPrincipal principal) {
        StatusUpdateRequest req = new StatusUpdateRequest(body.status(), body.progress(), body.feedback());
        return ResponseEntity.ok(taskService.updateStatus(internshipId, taskId, req, principal));
    }

    /** POST /api/internships/{internshipId}/tasks/{taskId}/feedbacks — supervisor/admin/co-supervisor only */
    @PostMapping("/{taskId}/feedbacks")
    public ResponseEntity<TaskDto> addFeedback(@PathVariable Long internshipId,
                                               @PathVariable Long taskId,
                                               @RequestBody FeedbackBody body,
                                               @AuthenticationPrincipal UserPrincipal principal) {
        return ResponseEntity.ok(taskService.addFeedback(internshipId, taskId, body.content(), principal));
    }

    /** DELETE /api/internships/{internshipId}/tasks/{taskId} — supervisor/admin only */
    @DeleteMapping("/{taskId}")
    public ResponseEntity<Void> delete(@PathVariable Long internshipId,
                                       @PathVariable Long taskId,
                                       @AuthenticationPrincipal UserPrincipal principal) {
        taskService.delete(internshipId, taskId, principal);
        return ResponseEntity.noContent().build();
    }

    // ── Request bodies ────────────────────────────────────────────────────────

    public record CreateBody(
            @NotBlank String title,
            String description,
            LocalDate dueDate,
            String priority
    ) {}

    public record StatusUpdateBody(String status, Integer progress, String feedback) {}

    public record FeedbackBody(String content) {}
}
