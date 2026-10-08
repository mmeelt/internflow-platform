package com.internflow.backend.controller;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import com.internflow.backend.dto.ProfileDto;
import com.internflow.backend.security.UserPrincipal;
import com.internflow.backend.service.ProfileService;
@RestController @RequestMapping("/api/profile")
public class ProfileController {
 private final ProfileService service; public ProfileController(ProfileService service) { this.service = service; }
 @GetMapping public ResponseEntity<ProfileDto> get(@AuthenticationPrincipal UserPrincipal p) { return ResponseEntity.ok(service.get(p)); }
 @PatchMapping public ResponseEntity<ProfileDto> update(@RequestBody ProfileService.UpdateRequest r, @AuthenticationPrincipal UserPrincipal p) { return ResponseEntity.ok(service.update(r, p)); }
}
