package com.internflow.backend.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.MailException;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.JavaMailSenderImpl;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;
import org.springframework.web.util.HtmlUtils;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;
import com.internflow.backend.exception.ApiException;
import java.io.UnsupportedEncodingException;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;

@Service
public class EmailService {
    private static final Logger log = LoggerFactory.getLogger(EmailService.class);
    private final JavaMailSender mailSender;

    @Value("${app.mail.from}")
    private String from;

    public EmailService(JavaMailSender mailSender) {
        this.mailSender = mailSender;
        // Google displays app passwords in groups of four characters. Users
        // often paste those visual spaces into configuration, but SMTP expects
        // the compact 16-character value. Do this only for Gmail.
        if (mailSender instanceof JavaMailSenderImpl sender
                && "smtp.gmail.com".equalsIgnoreCase(sender.getHost())
                && sender.getPassword() != null) {
            sender.setPassword(sender.getPassword().replaceAll("\\s+", ""));
        }
    }

    /**
     * Checks connectivity and authentication once at startup. This does not
     * send a message or expose credentials, but makes SMTP misconfiguration
     * visible in backend logs instead of surfacing only as a generic 500.
     */
    @EventListener(ApplicationReadyEvent.class)
    public void verifySmtpConnection() {
        if (!(mailSender instanceof JavaMailSenderImpl sender)) return;
        try {
            sender.testConnection();
            log.info("SMTP connection and authentication verified");
        } catch (MessagingException exception) {
            log.error("SMTP connection/authentication failed: {}", exception.getMessage());
        }
    }

    public void sendLoginCode(String recipient, String name, String role, String code, long validMinutes) {
        sendVerificationCode(recipient, name, role, code, validMinutes, false);
    }

    public void sendRegistrationCode(String recipient, String name, String role, String code, long validMinutes) {
        sendVerificationCode(recipient, name, role, code, validMinutes, true);
    }

    public void sendPasswordResetCode(String recipient, String name, String code, long validMinutes) {
        if (from == null || from.isBlank()) {
            throw ApiException.internal("Email delivery is not configured");
        }
        rejectHeaderInjection(recipient);
        String safeName = HtmlUtils.htmlEscape(name == null || name.isBlank() ? "there" : name);
        String html = buildPasswordResetEmail(safeName, code, validMinutes);
        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, false, "UTF-8");
            helper.setFrom(from, "InternFlow");
            helper.setTo(recipient);
            String requestTime = LocalDateTime.now()
                    .format(DateTimeFormatter.ofPattern("dd MMM yyyy, HH:mm:ss"));
            helper.setSubject("Reset your InternFlow password — " + requestTime);
            helper.setText(html, true);
            mailSender.send(message);
        } catch (MailException | MessagingException | UnsupportedEncodingException ex) {
            throw ApiException.internal("Unable to send the password reset email");
        }
    }

    public void sendImportantNotification(String recipient, String name, String subject, String summary) {
        if (from == null || from.isBlank()) {
            throw ApiException.internal("Email delivery is not configured");
        }
        rejectHeaderInjection(recipient);
        rejectHeaderInjection(subject);
        String safeName = HtmlUtils.htmlEscape(name == null || name.isBlank() ? "there" : name);
        String safeSubject = HtmlUtils.htmlEscape(subject);
        String safeSummary = HtmlUtils.htmlEscape(summary);
        String html = buildNotificationEmail(safeName, safeSubject, safeSummary);
        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, false, "UTF-8");
            helper.setFrom(from, "InternFlow");
            helper.setTo(recipient);
            helper.setSubject(subject + " — InternFlow");
            helper.setText(html, true);
            mailSender.send(message);
        } catch (MailException | MessagingException | UnsupportedEncodingException ex) {
            throw ApiException.internal("Unable to send the notification email");
        }
    }

    private void sendVerificationCode(String recipient, String name, String role, String code, long validMinutes, boolean registration) {
        if (from == null || from.isBlank()) {
            throw ApiException.internal("Email delivery is not configured");
        }
        rejectHeaderInjection(recipient);
        String safeName = HtmlUtils.htmlEscape(name == null || name.isBlank() ? "there" : name);
        String roleLabel = switch (role == null ? "" : role.toLowerCase()) {
            case "student" -> "intern";
            case "supervisor" -> "supervisor";
            case "admin" -> "administrator";
            default -> "member";
        };
        String html = buildVerificationEmail(safeName, roleLabel, code, validMinutes, registration);

        try {
            MimeMessage message = mailSender.createMimeMessage();
            // Single-part HTML: no multipart container, inline resource, or
            // attachment exists for Gmail to display as an "inline" chip.
            MimeMessageHelper helper = new MimeMessageHelper(message, false, "UTF-8");
            helper.setFrom(from, "InternFlow");
            helper.setTo(recipient);
            // A timestamp prevents Gmail from grouping this message with old
            // verification threads that previously contained an inline image.
            String requestTime = LocalDateTime.now()
                    .format(DateTimeFormatter.ofPattern("dd MMM yyyy, HH:mm:ss"));
            helper.setSubject((registration
                    ? "Verify your InternFlow email address"
                    : "Confirm your InternFlow sign-in") + " — " + requestTime);
            helper.setText(html, true);
            mailSender.send(message);
        } catch (MailException | MessagingException | UnsupportedEncodingException ex) {
            throw ApiException.internal("Unable to send the verification email");
        }
    }

    private void rejectHeaderInjection(String value) {
        if (value == null || value.contains("\r") || value.contains("\n")) {
            throw ApiException.badRequest("Invalid email header value");
        }
    }

    private String buildVerificationEmail(String safeName, String roleLabel, String code, long validMinutes, boolean registration) {
        String heading = registration ? "Please confirm your email address" : "Confirm your sign-in";
        String introduction = registration
                ? "Thank you for registering as an InternFlow " + roleLabel
                    + ". You are almost ready to access your workspace. Use the verification code below to confirm your email address."
                : "We received a request to sign in to your InternFlow " + roleLabel
                    + " workspace. Use the verification code below to continue securely.";
        String nextStep = registration
                ? "After verification, your account will be submitted for administrator approval."
                : "After verification, you will be signed in to your workspace.";
        return buildSecurityCodeEmail(heading, safeName, introduction, nextStep, code, validMinutes,
                "InternFlow verification code");
    }

    private String buildPasswordResetEmail(String safeName, String code, long validMinutes) {
        return buildSecurityCodeEmail(
                "Reset your password",
                safeName,
                "We received a request to reset your InternFlow password. Use the verification code below to continue securely.",
                "After verification, you will choose a new password and be signed in to your workspace.",
                code,
                validMinutes,
                "Reset your InternFlow password"
        );
    }

    private String buildSecurityCodeEmail(
            String heading,
            String safeName,
            String introduction,
            String nextStep,
            String code,
            long validMinutes,
            String pageTitle
    ) {
        return """
            <!doctype html>
            <html lang="en">
            <head>
              <meta charset="UTF-8">
              <meta name="viewport" content="width=device-width,initial-scale=1">
              <title>%s</title>
            </head>
            <body style="margin:0;padding:0;background:#EAF4F1;font-family:Arial,'Segoe UI',sans-serif;color:#17212B;">
              <div style="display:none;max-height:0;overflow:hidden;opacity:0;">
                Your secure InternFlow verification code.
              </div>
              <table role="presentation" width="100%%" cellspacing="0" cellpadding="0" border="0" style="background:#EAF4F1;">
                <tr>
                  <td align="center" style="padding:34px 16px 44px;">
                    <table role="presentation" width="100%%" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;">
                      <tr>
                        <td style="padding:0 0 27px;text-align:center;">
                          <div style="color:#0D3A4A;font-size:25px;font-weight:800;letter-spacing:4px;">INTERNFLOW</div>
                          <div style="color:#526B73;font-size:10px;font-weight:600;letter-spacing:1.7px;margin-top:7px;">COMPETITIVENESS CLUSTER OF SOUSSE</div>
                        </td>
                      </tr>
                      <tr>
                        <td style="background:#FFFFFF;border:1px solid #D6E1DE;padding:42px 38px 36px;box-shadow:0 2px 8px rgba(13,58,74,.08);">
                          <div style="text-align:center;margin-bottom:25px;">
                            <div style="color:#315E78;font-size:72px;line-height:1;font-family:Arial,sans-serif;" role="img" aria-label="Email">&#9993;</div>
                          </div>
                          <h1 style="margin:0 0 34px;color:#17212B;font-size:25px;line-height:1.3;font-weight:700;text-align:center;">%s</h1>
                          <p style="margin:0;color:#3F4A54;font-size:15px;line-height:1.65;">Dear <strong>%s</strong>,</p>
                          <p style="margin:12px 0 0;color:#3F4A54;font-size:15px;line-height:1.65;">%s</p>
                          <p style="margin:9px 0 0;color:#758089;font-size:13px;line-height:1.6;">%s</p>

                          <div style="margin:28px 0 23px;background:#F3F7F8;border:1px solid #CCDADD;padding:22px 20px;text-align:center;">
                            <div style="color:#60747B;font-size:11px;font-weight:700;letter-spacing:1.4px;text-transform:uppercase;margin-bottom:13px;">Your verification code</div>
                            <div style="color:#0D3A4A;font-size:34px;line-height:1;font-weight:700;letter-spacing:10px;padding-left:10px;">%s</div>
                            <div style="margin-top:14px;color:#758089;font-size:12px;">Valid for %d minutes · One-time use</div>
                          </div>

                          <p style="margin:0;text-align:center;color:#8A949B;font-size:11px;line-height:1.65;">If you did not request this action, please disregard this email. InternFlow will never ask you to share this code.</p>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:20px 30px;text-align:center;color:#60747B;font-size:11px;line-height:1.7;">
                          INTERNFLOW · Internship Management Platform<br>
                          Automated account security message
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </body>
            </html>
            """.formatted(pageTitle, heading, safeName, introduction, nextStep, code, validMinutes);
    }

    private String buildNotificationEmail(String safeName, String safeSubject, String safeSummary) {
        return """
            <!doctype html>
            <html lang="en">
            <head>
              <meta charset="UTF-8">
              <meta name="viewport" content="width=device-width,initial-scale=1">
              <title>InternFlow notification</title>
            </head>
            <body style="margin:0;padding:0;background:#EEF3F2;font-family:Arial,'Segoe UI',sans-serif;color:#17212B;">
              <table role="presentation" width="100%%" cellspacing="0" cellpadding="0" border="0" style="background:#EEF3F2;">
                <tr>
                  <td align="center" style="padding:36px 16px;">
                    <table role="presentation" width="100%%" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;">
                      <tr>
                        <td style="padding:0 0 24px;text-align:center;">
                          <div style="color:#0D3A4A;font-size:24px;font-weight:800;letter-spacing:4px;">INTERNFLOW</div>
                          <div style="color:#60747B;font-size:10px;font-weight:600;letter-spacing:1.5px;margin-top:7px;">COMPETITIVENESS CLUSTER OF SOUSSE</div>
                        </td>
                      </tr>
                      <tr>
                        <td style="background:#FFFFFF;border:1px solid #D6E1DE;padding:38px 36px;">
                          <div style="width:44px;height:44px;line-height:44px;margin:0 auto 22px;background:#EAF4F1;color:#0D3A4A;border-radius:50%%;text-align:center;font-size:22px;">&#9679;</div>
                          <h1 style="margin:0 0 26px;text-align:center;color:#17212B;font-size:23px;line-height:1.35;">%s</h1>
                          <p style="margin:0;color:#3F4A54;font-size:15px;line-height:1.7;">Dear <strong>%s</strong>,</p>
                          <p style="margin:12px 0 0;color:#3F4A54;font-size:15px;line-height:1.7;">%s</p>
                          <div style="margin:25px 0 0;padding:16px 18px;background:#F5F8F8;border-left:3px solid #0D3A4A;color:#60747B;font-size:13px;line-height:1.6;">
                            Sign in to your InternFlow workspace to view this update.
                          </div>
                          <p style="margin:24px 0 0;text-align:center;color:#8A949B;font-size:11px;line-height:1.6;">
                            For privacy and security, detailed information is available only inside your authenticated workspace.
                          </p>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:18px;text-align:center;color:#60747B;font-size:11px;line-height:1.7;">
                          INTERNFLOW · Internship Management Platform<br>
                          Automated workspace notification
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </body>
            </html>
            """.formatted(safeSubject, safeName, safeSummary);
    }
}
