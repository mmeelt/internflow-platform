package com.internflow.backend.entity.enums;

public enum TaskStatus {
    todo,
    in_progress,
    done,
    reviewed,
    disapproved;

    public static TaskStatus fromFrontend(String value) {
        if ("in-progress".equals(value)) return in_progress;
        return valueOf(value);
    }

    public String toFrontend() {
        return this == in_progress ? "in-progress" : name();
    }
}
