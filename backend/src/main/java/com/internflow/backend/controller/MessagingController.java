package com.internflow.backend.controller;
import jakarta.validation.constraints.NotBlank;
import com.internflow.backend.dto.*;
import com.internflow.backend.security.UserPrincipal;
import com.internflow.backend.service.MessagingService;
import org.springframework.http.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import java.util.List;
@RestController @RequestMapping("/api/messages")
public class MessagingController {
 private final MessagingService service; public MessagingController(MessagingService service) { this.service = service; }
 @GetMapping("/conversations") public ResponseEntity<List<ConversationDto>> conversations(@AuthenticationPrincipal UserPrincipal p) { return ResponseEntity.ok(service.list(p)); }
 @PostMapping("/conversations") public ResponseEntity<ConversationDto> start(@RequestBody StartBody body, @AuthenticationPrincipal UserPrincipal p) { return ResponseEntity.status(HttpStatus.CREATED).body(service.start(body.recipientId(), p)); }
 @GetMapping("/conversations/{id}") public ResponseEntity<List<MessageDto>> messages(@PathVariable Long id, @AuthenticationPrincipal UserPrincipal p) { return ResponseEntity.ok(service.listMessages(id, p)); }
 @PostMapping("/conversations/{id}") public ResponseEntity<MessageDto> send(@PathVariable Long id, @RequestBody SendBody body, @AuthenticationPrincipal UserPrincipal p) { return ResponseEntity.status(HttpStatus.CREATED).body(service.send(id, body.content(), p)); }
 public record StartBody(Long recipientId) {} public record SendBody(@NotBlank String content) {}
}
