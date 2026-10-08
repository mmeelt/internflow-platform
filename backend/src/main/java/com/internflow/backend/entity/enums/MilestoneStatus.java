package com.internflow.backend.entity.enums;

public enum MilestoneStatus {
    completed,
    in_progress,
    pending;

    public static MilestoneStatus fromFrontend(String value) {
        if ("in-progress".equals(value)) return in_progress;
        return valueOf(value);
    }

    public String toFrontend() {
        return this == in_progress ? "in-progress" : name();
    }
}
