package com.internflow.backend.repository;

import com.internflow.backend.entity.User;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

import com.internflow.backend.entity.enums.UserRole;

public interface UserRepository extends JpaRepository<User, Long> {
    Optional<User> findByEmail(String email);
    boolean existsByEmail(String email);
    Page<User> findByStatus(String status, Pageable pageable);
    List<User> findByRole(UserRole role);
    List<User> findByRoleAndStatus(UserRole role, String status);
    boolean existsByRole(UserRole role);
}