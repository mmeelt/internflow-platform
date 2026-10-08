package com.internflow.backend.security;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.AuthenticationProvider;
import org.springframework.security.authentication.dao.DaoAuthenticationProvider;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.List;

@Configuration
@EnableWebSecurity
@EnableMethodSecurity // enables @PreAuthorize on controllers
public class SecurityConfig {

    private final JwtAuthenticationFilter jwtAuthFilter;
    private final CustomUserDetailsService userDetailsService;
    private final RestAuthEntryPoint restAuthEntryPoint;
    private final RestAccessDeniedHandler restAccessDeniedHandler;
    private final SecurityResponseHeadersFilter securityResponseHeadersFilter;

    @Value("${app.cors.allowed-origins}")
    private List<String> allowedOrigins;

    public SecurityConfig(
            JwtAuthenticationFilter jwtAuthFilter,
            CustomUserDetailsService userDetailsService,
            RestAuthEntryPoint restAuthEntryPoint,
            RestAccessDeniedHandler restAccessDeniedHandler,
            SecurityResponseHeadersFilter securityResponseHeadersFilter
    ) {
        this.jwtAuthFilter = jwtAuthFilter;
        this.userDetailsService = userDetailsService;
        this.restAuthEntryPoint = restAuthEntryPoint;
        this.restAccessDeniedHandler = restAccessDeniedHandler;
        this.securityResponseHeadersFilter = securityResponseHeadersFilter;
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder(12);
    }

    @Bean
    public AuthenticationProvider authenticationProvider() {
        DaoAuthenticationProvider provider = new DaoAuthenticationProvider(userDetailsService);
        provider.setPasswordEncoder(passwordEncoder());
        return provider;
    }

    @Bean
    public AuthenticationManager authenticationManager(AuthenticationConfiguration config) throws Exception {
        return config.getAuthenticationManager();
    }

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
                .cors(cors -> cors.configurationSource(corsConfigurationSource()))
                .csrf(csrf -> csrf.disable())
                .sessionManagement(sm -> sm.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .exceptionHandling(ex -> ex
                        .authenticationEntryPoint(restAuthEntryPoint)
                        .accessDeniedHandler(restAccessDeniedHandler))
                .headers(headers -> headers
                        .contentTypeOptions(withDefaults -> {})
                        .frameOptions(frame -> frame.deny())
                        .httpStrictTransportSecurity(hsts -> hsts
                                .includeSubDomains(true)
                                .maxAgeInSeconds(31536000)))
                .authorizeHttpRequests(auth -> auth
                        // Public endpoints
                        .requestMatchers("/api/auth/**").permitAll()
                        .requestMatchers("/api/projects/selectable").permitAll()
                        .requestMatchers("/actuator/health").permitAll()

                        // STRICT ISOLATION PER PATH
                        // Admin endpoint folder can ONLY be accessed by ADMIN
                        .requestMatchers("/api/admin/**").hasRole("ADMIN")

                        // Supervisor endpoint folder can ONLY be accessed by SUPERVISOR
                        .requestMatchers("/api/supervisor/**").hasRole("SUPERVISOR")
                        .requestMatchers("/api/supervisors/**").hasRole("SUPERVISOR")

                        // Student endpoint folder can ONLY be accessed by STUDENT
                        .requestMatchers("/api/student/**").hasRole("STUDENT")

                        // Everything else requires a valid, authenticated session
                        .anyRequest().authenticated())
                .authenticationProvider(authenticationProvider())
                .addFilterBefore(securityResponseHeadersFilter, UsernamePasswordAuthenticationFilter.class)
                .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration configuration = new CorsConfiguration();
        configuration.setAllowedOrigins(allowedOrigins);
        configuration.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        configuration.setAllowedHeaders(List.of("Authorization", "Content-Type"));
        configuration.setExposedHeaders(List.of("Content-Disposition", "X-Request-ID"));
        // The refresh token is an HttpOnly, SameSite cookie. Origins remain an
        // explicit allowlist, so credentialed cross-origin API calls are safe.
        configuration.setAllowCredentials(true);
        configuration.setMaxAge(3600L);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", configuration);
        return source;
    }
}
