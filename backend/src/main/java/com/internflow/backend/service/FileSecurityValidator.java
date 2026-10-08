package com.internflow.backend.service;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;
import org.springframework.stereotype.Component;
import org.springframework.web.multipart.MultipartFile;
import com.internflow.backend.exception.ApiException;

@Component
public class FileSecurityValidator {
    private static final long DOCUMENT_LIMIT = 100L * 1024 * 1024;
    private static final long CODE_LIMIT = 2L * 1024 * 1024;
    private static final long VIDEO_LIMIT = 100L * 1024 * 1024;
    private static final long ARCHIVE_UNCOMPRESSED_LIMIT = 60L * 1024 * 1024;
    private static final long ARCHIVE_ENTRY_LIMIT = 25L * 1024 * 1024;
    private static final int ARCHIVE_ENTRY_COUNT_LIMIT = 25;
    private static final Set<String> DOCUMENTS = Set.of("pdf", "png", "jpg", "jpeg", "docx", "txt", "csv", "zip");
    private static final Set<String> REPORT_DOCUMENTS = Set.of("pdf", "docx", "txt", "csv", "zip");
    private static final Set<String> REPORT_ARCHIVE_CONTENT = Set.of("pdf", "docx", "txt", "csv");
    private static final Set<String> CODE = Set.of("java", "kt", "py", "js", "jsx", "ts", "tsx", "css", "json", "md", "sql", "xml", "yml", "yaml");
    private static final Set<String> VIDEOS = Set.of("mp4", "mov", "webm");
    private static final Map<String, String> SAFE_MIME = Map.ofEntries(
            Map.entry("pdf", "application/pdf"),
            Map.entry("png", "image/png"),
            Map.entry("jpg", "image/jpeg"),
            Map.entry("jpeg", "image/jpeg"),
            Map.entry("docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"),
            Map.entry("txt", "text/plain"),
            Map.entry("csv", "text/csv"),
            Map.entry("zip", "application/zip")
    );

    public String validateSubmission(MultipartFile file) {
        String extension = extension(file);
        if (!DOCUMENTS.contains(extension)) {
            throw ApiException.badRequest("Allowed submission types: PDF, DOCX, TXT, CSV, PNG, JPG, and ZIP");
        }
        validateSize(file, DOCUMENT_LIMIT);
        validateSignature(file, extension);
        if ("zip".equals(extension)) validateArchive(file, REPORT_ARCHIVE_CONTENT);
        return extension;
    }

    public String validateProjectAsset(String type, MultipartFile file) {
        String extension = extension(file);
        switch (type) {
            case "report" -> {
                if (!REPORT_DOCUMENTS.contains(extension)) {
                    throw ApiException.badRequest("The report must be a PDF, DOCX, TXT, CSV, or a ZIP containing one of these files");
                }
                validateSize(file, DOCUMENT_LIMIT);
                validateSignature(file, extension);
                if ("zip".equals(extension)) validateArchive(file, REPORT_ARCHIVE_CONTENT);
            }
            case "code" -> {
                if ("zip".equals(extension)) {
                    validateSize(file, DOCUMENT_LIMIT);
                    validateSignature(file, extension);
                    validateArchive(file, CODE);
                } else {
                    if (!CODE.contains(extension)) throw ApiException.badRequest("Unsupported source-code file type");
                    validateSize(file, CODE_LIMIT);
                    validateText(file);
                }
            }
            case "video" -> {
                if (!VIDEOS.contains(extension)) throw ApiException.badRequest("Allowed video types: MP4, MOV, and WEBM");
                validateSize(file, VIDEO_LIMIT);
                validateVideoSignature(file, extension);
            }
            default -> throw ApiException.badRequest("Asset type must be report, code, or video");
        }
        return extension;
    }

    public String safeContentType(String extension) {
        return SAFE_MIME.getOrDefault(extension, "application/octet-stream");
    }

    private String extension(MultipartFile file) {
        if (file == null || file.isEmpty()) throw ApiException.badRequest("A non-empty file is required");
        String original = file.getOriginalFilename() == null ? "" : file.getOriginalFilename().trim();
        if (original.isBlank() || original.contains("\0")) throw ApiException.badRequest("Invalid filename");
        String lower = original.toLowerCase(Locale.ROOT);
        int dot = lower.lastIndexOf('.');
        if (dot <= 0 || dot == lower.length() - 1) throw ApiException.badRequest("A valid file extension is required");
        String extension = lower.substring(dot + 1);
        String base = lower.substring(0, dot);
        if (base.matches(".*\\.(exe|dll|bat|cmd|com|ps1|sh|html|htm|svg|jar|war)$")) {
            throw ApiException.badRequest("Double-extension files are not allowed");
        }
        return extension;
    }

    private void validateSize(MultipartFile file, long limit) {
        if (file.getSize() <= 0 || file.getSize() > limit) {
            throw ApiException.badRequest("File exceeds the allowed size");
        }
    }

    private void validateSignature(MultipartFile file, String extension) {
        byte[] header = header(file, 12);
        boolean valid = switch (extension) {
            case "pdf" -> starts(header, "%PDF-".getBytes(StandardCharsets.US_ASCII));
            case "png" -> starts(header, new byte[]{(byte) 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A});
            case "jpg", "jpeg" -> header.length >= 3 && header[0] == (byte) 0xFF && header[1] == (byte) 0xD8 && header[2] == (byte) 0xFF;
            case "docx" -> header.length >= 4 && header[0] == 'P' && header[1] == 'K' && header[2] == 3 && header[3] == 4;
            case "txt", "csv" -> {
                validateText(file);
                yield true;
            }
            case "zip" -> header.length >= 4 && header[0] == 'P' && header[1] == 'K'
                    && ((header[2] == 3 && header[3] == 4) || (header[2] == 5 && header[3] == 6));
            default -> false;
        };
        if (!valid) throw ApiException.badRequest("File content does not match its extension");
    }

    private void validateVideoSignature(MultipartFile file, String extension) {
        byte[] header = header(file, 16);
        boolean valid = switch (extension) {
            case "mp4", "mov" -> header.length >= 12 && header[4] == 'f' && header[5] == 't' && header[6] == 'y' && header[7] == 'p';
            case "webm" -> header.length >= 4 && header[0] == 0x1A && header[1] == 0x45 && header[2] == (byte) 0xDF && header[3] == (byte) 0xA3;
            default -> false;
        };
        if (!valid) throw ApiException.badRequest("Video content does not match its extension");
    }

    private void validateText(MultipartFile file) {
        byte[] sample = header(file, 8192);
        for (byte value : sample) {
            if (value == 0) throw ApiException.badRequest("Binary or executable content is not allowed");
        }
    }

    /** Archives are streamed only: they are never extracted to disk. */
    private void validateArchive(MultipartFile file, Set<String> allowedExtensions) {
        try (ZipInputStream archive = new ZipInputStream(file.getInputStream())) {
            int entries = 0;
            long totalBytes = 0;
            boolean hasFile = false;
            ZipEntry entry;
            while ((entry = archive.getNextEntry()) != null) {
                if (entry.isDirectory()) continue;
                hasFile = true;
                if (++entries > ARCHIVE_ENTRY_COUNT_LIMIT) {
                    throw ApiException.badRequest("ZIP archives may contain at most " + ARCHIVE_ENTRY_COUNT_LIMIT + " files");
                }
                String name = entry.getName() == null ? "" : entry.getName().replace('\\', '/');
                if (name.startsWith("/") || name.contains("../") || name.indexOf('\0') >= 0) {
                    throw ApiException.badRequest("ZIP archive contains an unsafe filename");
                }
                String entryExtension = extension(name);
                if (!allowedExtensions.contains(entryExtension)) {
                    throw ApiException.badRequest("ZIP archive contains an unsupported file type: " + entryExtension);
                }
                long entryBytes = streamLength(archive, ARCHIVE_ENTRY_LIMIT + 1);
                totalBytes += entryBytes;
                if (entryBytes > ARCHIVE_ENTRY_LIMIT || totalBytes > ARCHIVE_UNCOMPRESSED_LIMIT) {
                    throw ApiException.badRequest("ZIP archive expands beyond the safe document limit");
                }
            }
            if (!hasFile) throw ApiException.badRequest("ZIP archive must contain at least one file");
        } catch (ApiException exception) {
            throw exception;
        } catch (IOException exception) {
            throw ApiException.badRequest("Could not inspect ZIP archive");
        }
    }

    private long streamLength(InputStream input, long limit) throws IOException {
        byte[] buffer = new byte[8192];
        long count = 0;
        int read;
        while ((read = input.read(buffer)) != -1) {
            count += read;
            if (count > limit) return count;
        }
        return count;
    }

    private byte[] header(MultipartFile file, int length) {
        try (InputStream input = file.getInputStream()) {
            return input.readNBytes(length);
        } catch (IOException error) {
            throw ApiException.badRequest("Could not inspect uploaded file");
        }
    }

    private String extension(String name) {
        int dot = name.lastIndexOf('.');
        return dot < 1 || dot == name.length() - 1 ? "" : name.substring(dot + 1).toLowerCase(Locale.ROOT);
    }

    private boolean starts(byte[] value, byte[] prefix) {
        if (value.length < prefix.length) return false;
        for (int i = 0; i < prefix.length; i++) if (value[i] != prefix[i]) return false;
        return true;
    }
}
