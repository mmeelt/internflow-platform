package com.internflow.backend.controller;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import com.internflow.backend.dto.PersonalCalendarTaskDto;
import com.internflow.backend.security.UserPrincipal;
import com.internflow.backend.service.PersonalCalendarTaskService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/calendar/personal-tasks")
@PreAuthorize("hasRole('STUDENT')")
public class PersonalCalendarTaskController {
    private final PersonalCalendarTaskService service;
    public PersonalCalendarTaskController(PersonalCalendarTaskService service) { this.service = service; }
    @GetMapping public ResponseEntity<List<PersonalCalendarTaskDto>> list(@AuthenticationPrincipal UserPrincipal principal) { return ResponseEntity.ok(service.list(principal)); }
    @PostMapping public ResponseEntity<PersonalCalendarTaskDto> create(@Valid @RequestBody CreateBody body, @AuthenticationPrincipal UserPrincipal principal) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.create(new PersonalCalendarTaskService.CreateRequest(body.title(), body.description(), body.startDate(), body.dueDate(), body.category(), body.priority()), principal));
    }
    @DeleteMapping("/{id}") public ResponseEntity<Void> delete(@PathVariable Long id, @AuthenticationPrincipal UserPrincipal principal) { service.delete(id, principal); return ResponseEntity.noContent().build(); }
    @PatchMapping("/{id}") public ResponseEntity<PersonalCalendarTaskDto> updateStatus(@PathVariable Long id, @RequestBody StatusBody body, @AuthenticationPrincipal UserPrincipal principal) { return ResponseEntity.ok(service.updateStatus(id, body.status(), principal)); }
    public record CreateBody(@NotBlank String title, String description, @NotNull LocalDate startDate, LocalDate dueDate, String category, @NotBlank String priority) {}
    public record StatusBody(@com.fasterxml.jackson.annotation.JsonProperty("status") @NotBlank String status) {}
}
