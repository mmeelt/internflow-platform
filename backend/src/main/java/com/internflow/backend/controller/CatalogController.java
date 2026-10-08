package com.internflow.backend.controller;

import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Stream;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import com.internflow.backend.entity.InternSkill;
import com.internflow.backend.entity.SupervisorProfile;
import com.internflow.backend.repository.InternProfileRepository;
import com.internflow.backend.repository.InternSkillRepository;
import com.internflow.backend.repository.SupervisorProfileRepository;

@RestController
@RequestMapping("/api/catalog")
public class CatalogController {
    private final SupervisorProfileRepository supervisors;
    private final InternProfileRepository interns;
    private final InternSkillRepository skills;

    public CatalogController(SupervisorProfileRepository supervisors,
                             InternProfileRepository interns,
                             InternSkillRepository skills) {
        this.supervisors = supervisors;
        this.interns = interns;
        this.skills = skills;
    }

    @GetMapping("/registration-options")
    public ResponseEntity<Map<String, List<String>>> registrationOptions() {
        return ResponseEntity.ok(Map.of(
                "posts", clean(supervisors.findAll().stream().map(SupervisorProfile::getPost)),
                "departments", clean(Stream.concat(
                        supervisors.findAll().stream().map(SupervisorProfile::getDepartment),
                        interns.findAll().stream().map(profile -> profile.getDepartment()))),
                "specializations", clean(supervisors.findAll().stream().map(SupervisorProfile::getSpecialization)),
                "technologies", clean(skills.findAll().stream().map(InternSkill::getSkill))
        ));
    }

    private List<String> clean(Stream<String> values) {
        return values.filter(Objects::nonNull)
                .map(String::trim)
                .filter(value -> !value.isBlank())
                .distinct()
                .sorted(String.CASE_INSENSITIVE_ORDER)
                .toList();
    }
}
