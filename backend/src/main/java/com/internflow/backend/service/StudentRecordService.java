package com.internflow.backend.service;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import com.internflow.backend.dto.StudentRecordDto;
import com.internflow.backend.entity.Internship;
import com.internflow.backend.entity.InternProfile;
import com.internflow.backend.entity.User;
import com.internflow.backend.exception.ApiException;
import com.internflow.backend.repository.InternProfileRepository;
import com.internflow.backend.repository.InternSkillRepository;
import com.internflow.backend.repository.InternshipRepository;
import com.internflow.backend.security.UserPrincipal;

@Service
public class StudentRecordService {
    private final InternshipRepository internships;
    private final InternProfileRepository profiles;
    private final InternSkillRepository skills;
    private final RegistrationDocumentService documents;

    public StudentRecordService(InternshipRepository internships, InternProfileRepository profiles,
                                InternSkillRepository skills, RegistrationDocumentService documents) {
        this.internships = internships;
        this.profiles = profiles;
        this.skills = skills;
        this.documents = documents;
    }

    @Transactional(readOnly = true)
    public StudentRecordDto get(Long internshipId, UserPrincipal principal) {
        Internship internship = authorisedInternship(internshipId, principal);
        User student = internship.getIntern();
        InternProfile profile = profiles.findByUserId(student.getId()).orElse(null);
        return new StudentRecordDto(student.getId(), student.getName(), student.getEmail(), student.getPhone(), student.getPhotoUrl(), student.getBio(),
                profile == null ? null : profile.getUniversity(), profile == null ? null : profile.getDepartment(),
                profile == null ? null : profile.getYear(), profile == null ? null : profile.getPreviousInternships(),
                profile == null ? null : profile.getEnterprise(), profile == null ? null : profile.getSubjectOfInternship(),
                skills.findByUserIdOrderBySkillAsc(student.getId()).stream().map(item -> item.getSkill()).toList(),
                internship.getTitle(), internship.getDomain(), internship.getStartDate(), internship.getEndDate(),
                student.getIdentityCardName(), student.getInternshipAgreementName(), student.getSignedInternshipAgreementName());
    }

    @Transactional(readOnly = true)
    public DownloadFile download(Long internshipId, String type, UserPrincipal principal) {
        User student = authorisedInternship(internshipId, principal).getIntern();
        String path = switch (type) {
            case "identity-card" -> student.getIdentityCardPath();
            case "internship-agreement" -> student.getInternshipAgreementPath();
            case "signed-internship-agreement" -> student.getSignedInternshipAgreementPath();
            default -> throw ApiException.notFound("Document not found");
        };
        String name = switch (type) {
            case "identity-card" -> student.getIdentityCardName();
            case "internship-agreement" -> student.getInternshipAgreementName();
            case "signed-internship-agreement" -> student.getSignedInternshipAgreementName();
            default -> "document";
        };
        try {
            Path file = documents.resolveStoredPath(path);
            return new DownloadFile(Files.readAllBytes(file), name == null ? "document" : name, Files.probeContentType(file));
        } catch (IOException exception) {
            throw ApiException.internal("Could not read registration document");
        }
    }

    @Transactional
    public StudentRecordDto uploadSignedAgreement(Long internshipId, org.springframework.web.multipart.MultipartFile signedAgreement,
                                                   UserPrincipal principal) {
        Internship internship = authorisedStaffInternship(internshipId, principal);
        User student = internship.getIntern();
        RegistrationDocumentService.StoredSignedAgreement stored = documents.storeSignedAgreement(student.getId(), signedAgreement);
        student.setSignedInternshipAgreementPath(stored.path());
        student.setSignedInternshipAgreementName(stored.name());
        return get(internshipId, principal);
    }

    private Internship authorisedInternship(Long id, UserPrincipal principal) {
        Internship internship = internships.findById(id).orElseThrow(() -> ApiException.notFound("Internship not found"));
        boolean admin = principal.getAuthorities().stream().anyMatch(a -> "ROLE_ADMIN".equals(a.getAuthority()));
        boolean student = internship.getIntern() != null && internship.getIntern().getId().equals(principal.getId());
        boolean assigned = internship.getSupervisor() != null && internship.getSupervisor().getId().equals(principal.getId());
        boolean coSupervisor = internships.existsAcceptedCoSupervisor(id, principal.getId());
        if (!admin && !student && !assigned && !coSupervisor) throw ApiException.forbidden("You do not have access to this student's record");
        return internship;
    }

    private Internship authorisedStaffInternship(Long id, UserPrincipal principal) {
        Internship internship = internships.findById(id).orElseThrow(() -> ApiException.notFound("Internship not found"));
        boolean admin = principal.getAuthorities().stream().anyMatch(a -> "ROLE_ADMIN".equals(a.getAuthority()));
        boolean assigned = internship.getSupervisor() != null && internship.getSupervisor().getId().equals(principal.getId());
        boolean coSupervisor = internships.existsAcceptedCoSupervisor(id, principal.getId());
        if (!admin && !assigned && !coSupervisor) throw ApiException.forbidden("Only an administrator or assigned supervisor can upload the signed agreement");
        return internship;
    }

    public record DownloadFile(byte[] bytes, String filename, String contentType) {}
}
