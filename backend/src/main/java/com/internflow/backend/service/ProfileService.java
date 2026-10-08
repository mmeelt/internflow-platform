package com.internflow.backend.service;

import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import com.internflow.backend.dto.ProfileDto;
import com.internflow.backend.entity.*;
import com.internflow.backend.entity.enums.UserRole;
import com.internflow.backend.exception.ApiException;
import com.internflow.backend.repository.*;
import com.internflow.backend.security.UserPrincipal;

@Service
public class ProfileService {
    private final UserRepository users;
    private final InternProfileRepository interns;
    private final SupervisorProfileRepository supervisors;
    private final InternSkillRepository skills;

    public ProfileService(UserRepository users, InternProfileRepository interns,
                          SupervisorProfileRepository supervisors, InternSkillRepository skills) {
        this.users = users;
        this.interns = interns;
        this.supervisors = supervisors;
        this.skills = skills;
    }

    @Transactional(readOnly = true)
    public ProfileDto get(UserPrincipal principal) {
        return dto(user(principal));
    }

    @Transactional
    public ProfileDto update(UpdateRequest request, UserPrincipal principal) {
        User user = user(principal);
        if (request.name() != null && !request.name().isBlank()) user.setName(request.name().trim());
        if (request.phone() != null) user.setPhone(request.phone().trim());
        if (request.bio() != null) user.setBio(request.bio().trim());
        if (request.photoUrl() != null) {
            if (!request.photoUrl().startsWith("data:image/") || request.photoUrl().length() > 3_000_000) {
                throw ApiException.badRequest("Profile photo must be a valid image under 2 MB");
            }
            user.setPhotoUrl(request.photoUrl());
        }

        if (user.getRole() == UserRole.student) {
            InternProfile profile = interns.findByUserId(user.getId()).orElseGet(() -> {
                InternProfile created = new InternProfile();
                created.setUser(user);
                return created;
            });
            if (request.university() != null) profile.setUniversity(request.university());
            if (request.department() != null) profile.setDepartment(request.department());
            if (request.year() != null) profile.setYear(request.year());
            if (request.previousInternships() != null) profile.setPreviousInternships(request.previousInternships());
            if (request.enterprise() != null) profile.setEnterprise(request.enterprise());
            if (request.specialization() != null) profile.setSpecialization(request.specialization());
            if (request.subjectOfInternship() != null) profile.setSubjectOfInternship(request.subjectOfInternship());
            interns.save(profile);
            if (request.skills() != null) {
                skills.deleteByUserId(user.getId());
                request.skills().stream().filter(value -> value != null && !value.isBlank()).distinct().forEach(value -> {
                    InternSkill skill = new InternSkill();
                    skill.setUser(user);
                    skill.setSkill(value.trim());
                    skills.save(skill);
                });
            }
        } else if (user.getRole() == UserRole.supervisor) {
            SupervisorProfile profile = supervisors.findByUserId(user.getId()).orElseGet(() -> {
                SupervisorProfile created = new SupervisorProfile();
                created.setUser(user);
                return created;
            });
            if (request.organization() != null) profile.setOrganization(request.organization());
            if (request.department() != null) profile.setDepartment(request.department());
            if (request.post() != null) profile.setPost(request.post());
            if (request.specialization() != null) profile.setSpecialization(request.specialization());
            if (request.otherEncadrantInfo() != null) profile.setOtherEncadrantInfo(request.otherEncadrantInfo());
            if (request.yearsExperience() != null) profile.setYearsExperience(request.yearsExperience());
            supervisors.save(profile);
        }
        users.save(user);
        return dto(user);
    }

    private User user(UserPrincipal principal) {
        return users.findById(principal.getId()).orElseThrow(() -> ApiException.notFound("User not found"));
    }

    private ProfileDto dto(User user) {
        InternProfile intern = interns.findByUserId(user.getId()).orElse(null);
        SupervisorProfile supervisor = supervisors.findByUserId(user.getId()).orElse(null);
        List<String> userSkills = user.getRole() == UserRole.student
                ? skills.findByUserIdOrderBySkillAsc(user.getId()).stream().map(InternSkill::getSkill).toList()
                : List.of();
        return new ProfileDto(user.getId(), user.getName(), user.getEmail(), user.getRole().name(),
                user.getStatus(), user.getPhone(), user.getPhotoUrl(), user.getBio(),
                intern == null ? null : intern.getUniversity(),
                user.getRole() == UserRole.supervisor
                        ? (supervisor == null ? null : supervisor.getDepartment())
                        : (intern == null ? null : intern.getDepartment()),
                intern == null ? null : intern.getYear(), intern == null ? null : intern.getPreviousInternships(),
                intern == null ? null : intern.getEnterprise(), intern == null ? null : intern.getSubjectOfInternship(),
                userSkills, supervisor == null ? null : supervisor.getOrganization(),
                supervisor == null ? null : supervisor.getPost(), user.getRole() == UserRole.student
                        ? (intern == null ? null : intern.getSpecialization())
                        : (supervisor == null ? null : supervisor.getSpecialization()),
                supervisor == null ? null : supervisor.getOtherEncadrantInfo(),
                supervisor == null ? null : supervisor.getYearsExperience(),
                supervisor == null ? null : supervisor.getTotalInterns());
    }

    public record UpdateRequest(String name, String phone, String photoUrl, String bio,
                                String university, String department, String year,
                                String previousInternships, String enterprise, String subjectOfInternship,
                                List<String> skills, String organization, String post, String specialization,
                                String otherEncadrantInfo, Integer yearsExperience) {}
}
