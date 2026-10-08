package com.internflow.backend.security;

import java.util.Locale;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import com.internflow.backend.entity.User;
import com.internflow.backend.entity.enums.UserRole;
import com.internflow.backend.repository.UserRepository;

/** Creates the first admin only from deployment-controlled environment variables. */
@Component
public class BootstrapAdminInitializer implements ApplicationRunner {
    private static final Logger log = LoggerFactory.getLogger(BootstrapAdminInitializer.class);

    private final UserRepository users;
    private final PasswordEncoder passwordEncoder;
    private final boolean enabled;
    private final String email;
    private final String password;
    private final String name;

    public BootstrapAdminInitializer(
            UserRepository users,
            PasswordEncoder passwordEncoder,
            @Value("${security.bootstrap-admin.enabled:false}") boolean enabled,
            @Value("${security.bootstrap-admin.email:}") String email,
            @Value("${security.bootstrap-admin.password:}") String password,
            @Value("${security.bootstrap-admin.name:}") String name
    ) {
        this.users = users;
        this.passwordEncoder = passwordEncoder;
        this.enabled = enabled;
        this.email = email;
        this.password = password;
        this.name = name;
    }

    @Override
    public void run(ApplicationArguments args) {
        if (!enabled) return;
        if (users.existsByRole(UserRole.admin)) {
            log.warn("Bootstrap-admin is enabled but an administrator already exists; no account was created.");
            return;
        }

        String normalizedEmail = email == null ? "" : email.trim().toLowerCase(Locale.ROOT);
        if (!normalizedEmail.matches("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$")
                || !StringUtils.hasText(name)
                || password == null
                || !password.matches("^(?=.*[A-Za-z])(?=.*\\d).{12,72}$")) {
            throw new IllegalStateException(
                    "BOOTSTRAP_ADMIN_ENABLED requires a valid email, a name, and a password of at least 12 characters with a letter and a digit");
        }
        if (users.existsByEmail(normalizedEmail)) {
            throw new IllegalStateException("Bootstrap-admin email is already assigned to a non-admin account");
        }

        User admin = new User();
        admin.setEmail(normalizedEmail);
        admin.setPasswordHash(passwordEncoder.encode(password));
        admin.setName(name.trim());
        admin.setRole(UserRole.admin);
        admin.setStatus("Active");
        admin.setEmailVerified(true);
        users.save(admin);
        log.warn("Initial administrator account was created. Disable BOOTSTRAP_ADMIN_ENABLED and remove its password now.");
    }
}
