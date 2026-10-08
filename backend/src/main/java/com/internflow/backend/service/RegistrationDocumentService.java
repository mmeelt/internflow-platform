package com.internflow.backend.service;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.util.Locale;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import com.internflow.backend.exception.ApiException;

/** Stores the two official student-registration documents outside the public web root. */
@Service
public class RegistrationDocumentService {
    private final FileSecurityValidator validator;
    private final MalwareScanService malwareScanner;

    @Value("${app.upload.dir:uploads}")
    private String uploadDir;

    public RegistrationDocumentService(FileSecurityValidator validator, MalwareScanService malwareScanner) {
        this.validator = validator;
        this.malwareScanner = malwareScanner;
    }

    public StoredDocuments store(UUID challengeId, MultipartFile identityCard, MultipartFile agreement) {
        String identityExtension = validator.validateSubmission(identityCard);
        String agreementExtension = validator.validateSubmission(agreement);
        if (!("pdf".equals(identityExtension) || "png".equals(identityExtension) || "jpg".equals(identityExtension) || "jpeg".equals(identityExtension))) {
            throw ApiException.badRequest("Identity card must be a PDF, PNG, or JPG image");
        }
        if (!"pdf".equals(agreementExtension)) {
            throw ApiException.badRequest("Internship agreement must be a PDF");
        }
        Path directory = Paths.get(uploadDir).toAbsolutePath().normalize().resolve("registration").resolve(challengeId.toString()).normalize();
        Path root = Paths.get(uploadDir).toAbsolutePath().normalize();
        if (!directory.startsWith(root)) throw ApiException.badRequest("Invalid registration document path");
        try {
            Files.createDirectories(directory);
            Path identityTarget = directory.resolve("identity-card." + identityExtension);
            Path agreementTarget = directory.resolve("internship-agreement.pdf");
            Files.copy(identityCard.getInputStream(), identityTarget, StandardCopyOption.REPLACE_EXISTING);
            Files.copy(agreement.getInputStream(), agreementTarget, StandardCopyOption.REPLACE_EXISTING);
            try {
                malwareScanner.requireClean(identityTarget);
                malwareScanner.requireClean(agreementTarget);
            } catch (RuntimeException exception) {
                Files.deleteIfExists(identityTarget);
                Files.deleteIfExists(agreementTarget);
                throw exception;
            }
            return new StoredDocuments(
                    root.relativize(identityTarget).toString().replace('\\', '/'), cleanName(identityCard.getOriginalFilename()),
                    root.relativize(agreementTarget).toString().replace('\\', '/'), cleanName(agreement.getOriginalFilename())
            );
        } catch (IOException exception) {
            throw ApiException.internal("Could not store registration documents");
        }
    }

    public Path resolveStoredPath(String relativePath) {
        if (relativePath == null || relativePath.isBlank()) throw ApiException.notFound("Document has not been uploaded");
        Path root = Paths.get(uploadDir).toAbsolutePath().normalize();
        Path file = root.resolve(relativePath).normalize();
        if (!file.startsWith(root) || !Files.isRegularFile(file)) throw ApiException.notFound("Document is unavailable");
        return file;
    }

    /** Stores a signed agreement separately from the original registration document. */
    public StoredSignedAgreement storeSignedAgreement(Long studentId, MultipartFile signedAgreement) {
        String extension = validator.validateSubmission(signedAgreement);
        if (!"pdf".equals(extension)) {
            throw ApiException.badRequest("The signed internship agreement must be a PDF");
        }

        Path root = Paths.get(uploadDir).toAbsolutePath().normalize();
        Path directory = root.resolve("signed-agreements").normalize();
        if (!directory.startsWith(root)) throw ApiException.badRequest("Invalid signed agreement path");
        Path target = directory.resolve(studentId + "-" + UUID.randomUUID() + ".pdf").normalize();
        if (!target.startsWith(root)) throw ApiException.badRequest("Invalid signed agreement path");

        try {
            Files.createDirectories(directory);
            Files.copy(signedAgreement.getInputStream(), target, StandardCopyOption.REPLACE_EXISTING);
            try {
                malwareScanner.requireClean(target);
            } catch (RuntimeException exception) {
                Files.deleteIfExists(target);
                throw exception;
            }
            return new StoredSignedAgreement(
                    root.relativize(target).toString().replace('\\', '/'),
                    cleanName(signedAgreement.getOriginalFilename())
            );
        } catch (IOException exception) {
            throw ApiException.internal("Could not store the signed internship agreement");
        }
    }

    private String cleanName(String value) {
        String name = value == null ? "document.pdf" : Paths.get(value).getFileName().toString().replaceAll("[\\r\\n]", "");
        return name.isBlank() ? "document.pdf" : name.substring(0, Math.min(name.length(), 255));
    }

    public record StoredDocuments(String identityPath, String identityName, String agreementPath, String agreementName) {}
    public record StoredSignedAgreement(String path, String name) {}
}
