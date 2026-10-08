package com.internflow.backend.security;

import com.internflow.backend.entity.User;

import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

import java.util.Collection;
import java.util.List;
import java.time.Instant;

/**
 * Adapts our JPA {@link User} entity to Spring Security's UserDetails contract.
 * The role is exposed as "ROLE_STUDENT" / "ROLE_SUPERVISOR" / "ROLE_ADMIN" so
 * that @PreAuthorize("hasRole('ADMIN')") works out of the box.
 */
public class UserPrincipal implements UserDetails {

    private final Long id;
    private final String email;
    private final String passwordHash;
    private final String status;
    private final Instant passwordChangedAt;
    private final int sessionVersion;
    private final Collection<? extends GrantedAuthority> authorities;

    public UserPrincipal(User user) {
        this.id = user.getId();
        this.email = user.getEmail();
        this.passwordHash = user.getPasswordHash();
        this.status = user.getStatus();
        this.passwordChangedAt = user.getPasswordChangedAt();
        this.sessionVersion = user.getSessionVersion();
        this.authorities = List.of(new SimpleGrantedAuthority("ROLE_" + user.getRole().name().toUpperCase()));
    }

    public Long getId() { return id; }
    public Instant getPasswordChangedAt() { return passwordChangedAt; }
    public int getSessionVersion() { return sessionVersion; }

    @Override
    public Collection<? extends GrantedAuthority> getAuthorities() { return authorities; }

    @Override
    public String getPassword() { return passwordHash; }

    @Override
    public String getUsername() { return email; }

    @Override
    public boolean isAccountNonExpired() { return true; }

    @Override
    public boolean isAccountNonLocked() { return !"Revoked".equals(status); }

    @Override
    public boolean isCredentialsNonExpired() { return true; }

    @Override
    public boolean isEnabled() { return "Active".equals(status); }
}
