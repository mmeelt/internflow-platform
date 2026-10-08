package com.internflow.backend.service;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Locale;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;
import org.apache.poi.xwpf.extractor.XWPFWordExtractor;
import org.apache.poi.xwpf.usermodel.XWPFDocument;
import org.springframework.stereotype.Component;
import com.internflow.backend.exception.ApiException;

/** Extracts a bounded amount of text server-side from approved document types. */
@Component
public class DocumentTextExtractor {
    private static final int MAX_TEXT_CHARS = 45_000;
    private static final int MAX_PDF_PAGES = 100;
    private static final int MAX_ZIP_ENTRIES = 25;
    private static final long MAX_ZIP_UNCOMPRESSED_BYTES = 60L * 1024 * 1024;
    private static final long MAX_ZIP_ENTRY_BYTES = 25L * 1024 * 1024;

    public String extract(Path file, String originalName) {
        String extension = extension(originalName);
        try {
            String text = switch (extension) {
                case "pdf" -> pdf(file);
                case "docx" -> docx(file);
                case "txt", "csv" -> Files.readString(file, StandardCharsets.UTF_8);
                case "zip" -> zip(file);
                default -> throw ApiException.badRequest("AI review currently supports PDF, DOCX, TXT, and CSV documents");
            };
            text = normalizeAndLimit(text);
            if (text.length() < 40) {
                throw ApiException.badRequest("No readable text was found. A scanned PDF can be read through Gemini; other documents need selectable text.");
            }
            return text;
        } catch (ApiException exception) {
            throw exception;
        } catch (IOException exception) {
            throw ApiException.badRequest("The document could not be read for AI analysis");
        }
    }

    private String pdf(Path file) throws IOException {
        try (PDDocument document = PDDocument.load(file.toFile())) {
            PDFTextStripper stripper = new PDFTextStripper();
            stripper.setStartPage(1);
            stripper.setEndPage(Math.min(MAX_PDF_PAGES, document.getNumberOfPages()));
            return stripper.getText(document);
        }
    }

    private String docx(Path file) throws IOException {
        try (var input = Files.newInputStream(file);
             var document = new XWPFDocument(input);
             var extractor = new XWPFWordExtractor(document)) {
            return extractor.getText();
        }
    }

    private String zip(Path file) throws IOException {
        StringBuilder text = new StringBuilder();
        int entries = 0;
        long totalBytes = 0;
        try (ZipInputStream archive = new ZipInputStream(Files.newInputStream(file))) {
            ZipEntry entry;
            while ((entry = archive.getNextEntry()) != null && text.length() < MAX_TEXT_CHARS) {
                if (entry.isDirectory()) continue;
                if (++entries > MAX_ZIP_ENTRIES) throw ApiException.badRequest("ZIP archive has too many files to analyse");
                String name = entry.getName() == null ? "" : entry.getName().replace('\\', '/');
                if (name.startsWith("/") || name.contains("../")) throw ApiException.badRequest("ZIP archive contains an unsafe filename");
                String extension = extension(name);
                if (!(extension.equals("pdf") || extension.equals("docx") || extension.equals("txt") || extension.equals("csv"))) {
                    throw ApiException.badRequest("AI can read ZIP files containing only PDF, DOCX, TXT, or CSV files");
                }
                byte[] contents = readArchiveEntry(archive);
                totalBytes += contents.length;
                if (totalBytes > MAX_ZIP_UNCOMPRESSED_BYTES) throw ApiException.badRequest("ZIP archive is too large to analyse safely");
                String entryText = switch (extension) {
                    case "pdf" -> pdf(contents);
                    case "docx" -> docx(contents);
                    default -> new String(contents, StandardCharsets.UTF_8);
                };
                if (!entryText.isBlank()) text.append("\n\n--- ").append(name).append(" ---\n").append(entryText);
            }
        }
        return text.toString();
    }

    private byte[] readArchiveEntry(ZipInputStream archive) throws IOException {
        ByteArrayOutputStream output = new ByteArrayOutputStream();
        byte[] buffer = new byte[8192];
        long count = 0;
        int read;
        while ((read = archive.read(buffer)) != -1) {
            count += read;
            if (count > MAX_ZIP_ENTRY_BYTES) throw ApiException.badRequest("A ZIP entry is too large to analyse safely");
            output.write(buffer, 0, read);
        }
        return output.toByteArray();
    }

    private String pdf(byte[] contents) throws IOException {
        try (PDDocument document = PDDocument.load(contents)) {
            PDFTextStripper stripper = new PDFTextStripper();
            stripper.setStartPage(1);
            stripper.setEndPage(Math.min(MAX_PDF_PAGES, document.getNumberOfPages()));
            return stripper.getText(document);
        }
    }

    private String docx(byte[] contents) throws IOException {
        try (var input = new java.io.ByteArrayInputStream(contents);
             var document = new XWPFDocument(input);
             var extractor = new XWPFWordExtractor(document)) {
            return extractor.getText();
        }
    }

    private String normalizeAndLimit(String text) {
        String normalized = text == null ? "" : text.replace('\u0000', ' ').replaceAll("[\\t \\x0B\\f]+", " ")
                .replaceAll("\\R{3,}", "\\n\\n").trim();
        return normalized.length() <= MAX_TEXT_CHARS ? normalized : normalized.substring(0, MAX_TEXT_CHARS);
    }

    private String extension(String name) {
        int dot = name == null ? -1 : name.lastIndexOf('.');
        return dot < 0 ? "" : name.substring(dot + 1).toLowerCase(Locale.ROOT);
    }
}
