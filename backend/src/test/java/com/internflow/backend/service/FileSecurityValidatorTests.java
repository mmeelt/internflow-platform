package com.internflow.backend.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;
import com.internflow.backend.exception.ApiException;

class FileSecurityValidatorTests {
    private final FileSecurityValidator validator = new FileSecurityValidator();

    @Test
    void acceptsPdfOnlyWhenSignatureMatches() {
        var pdf = new MockMultipartFile("file", "report.pdf", "application/pdf",
                "%PDF-1.7\nsafe".getBytes(StandardCharsets.US_ASCII));
        assertEquals("pdf", validator.validateSubmission(pdf));
    }

    @Test
    void rejectsDisguisedExecutableAndDoubleExtension() {
        var disguised = new MockMultipartFile("file", "report.pdf", "application/pdf",
                "MZ executable".getBytes(StandardCharsets.US_ASCII));
        var doubled = new MockMultipartFile("file", "report.exe.pdf", "application/pdf",
                "%PDF-1.7".getBytes(StandardCharsets.US_ASCII));
        assertThrows(ApiException.class, () -> validator.validateSubmission(disguised));
        assertThrows(ApiException.class, () -> validator.validateSubmission(doubled));
    }

    @Test
    void rejectsActiveHtmlSubmission() {
        var html = new MockMultipartFile("file", "payload.html", "text/html",
                "<script>alert(1)</script>".getBytes(StandardCharsets.UTF_8));
        assertThrows(ApiException.class, () -> validator.validateSubmission(html));
    }

    @Test
    void rejectsBinaryContentAsSourceCode() {
        var binary = new MockMultipartFile("file", "code.ts", "text/plain", new byte[]{1, 2, 0, 4});
        assertThrows(ApiException.class, () -> validator.validateProjectAsset("code", binary));
    }

    @Test
    void acceptsAReportZipWithOnlySafeContents() throws Exception {
        var archive = new MockMultipartFile("file", "report.zip", "application/zip",
                zip("report.txt", "Safe report content".getBytes(StandardCharsets.UTF_8)));
        assertEquals("zip", validator.validateProjectAsset("report", archive));
    }

    @Test
    void rejectsZipPathTraversal() throws Exception {
        var archive = new MockMultipartFile("file", "report.zip", "application/zip",
                zip("../outside.txt", "unsafe".getBytes(StandardCharsets.UTF_8)));
        assertThrows(ApiException.class, () -> validator.validateProjectAsset("report", archive));
    }

    private byte[] zip(String name, byte[] content) throws Exception {
        var output = new ByteArrayOutputStream();
        try (var archive = new ZipOutputStream(output)) {
            archive.putNextEntry(new ZipEntry(name));
            archive.write(content);
            archive.closeEntry();
        }
        return output.toByteArray();
    }
}
