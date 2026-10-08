package com.internflow.backend.dto;

import java.time.Instant;

public record ProjectAssetDto(
        Long id, String type, String name, String contentType, long size, Instant uploadedAt
) {}
