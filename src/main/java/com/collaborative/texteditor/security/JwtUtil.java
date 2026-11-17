package com.collaborative.texteditor.security;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Component;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.Base64;
import java.util.HashMap;
import java.util.Map;


@Component
public class JwtUtil {

    private static final String SECRET = "collaborative-texteditor-distributed-systems-secret-key-32bytes-min";
    private static final long EXPIRATION_SECONDS = 86400 * 7; 
    private final ObjectMapper objectMapper = new ObjectMapper();

    public String generateToken(Long userId, String username, String role) {
        try {
            long now = Instant.now().getEpochSecond();
            long exp = now + EXPIRATION_SECONDS;

            Map<String, Object> header = new HashMap<>();
            header.put("alg", "HS256");
            header.put("typ", "JWT");

            Map<String, Object> claims = new HashMap<>();
            claims.put("sub", username);
            claims.put("userId", userId);
            claims.put("role", role);
            claims.put("iat", now);
            claims.put("exp", exp);

            String encodedHeader = base64UrlEncode(objectMapper.writeValueAsBytes(header));
            String encodedClaims = base64UrlEncode(objectMapper.writeValueAsBytes(claims));
            String dataToSign = encodedHeader + "." + encodedClaims;

            String signature = sign(dataToSign, SECRET);
            return dataToSign + "." + signature;
        } catch (Exception e) {
            throw new RuntimeException("Error generating JWT token", e);
        }
    }

    public boolean validateToken(String token) {
        try {
            if (token == null || token.trim().isEmpty()) return false;
            String[] parts = token.split("\\.");
            if (parts.length != 3) return false;

            String dataToSign = parts[0] + "." + parts[1];
            String expectedSignature = sign(dataToSign, SECRET);
            if (!MessageDigest.isEqual(parts[2].getBytes(StandardCharsets.UTF_8), expectedSignature.getBytes(StandardCharsets.UTF_8))) {
                return false;
            }

            JsonNode claims = getClaims(token);
            long exp = claims.path("exp").asLong(0);
            return exp > Instant.now().getEpochSecond();
        } catch (Exception e) {
            return false;
        }
    }

    public Long getUserIdFromToken(String token) {
        return getClaims(token).path("userId").asLong();
    }

    public String getUsernameFromToken(String token) {
        return getClaims(token).path("sub").asText();
    }

    public String getRoleFromToken(String token) {
        return getClaims(token).path("role").asText();
    }

    private JsonNode getClaims(String token) {
        try {
            String[] parts = token.split("\\.");
            byte[] decodedBytes = Base64.getUrlDecoder().decode(parts[1]);
            return objectMapper.readTree(decodedBytes);
        } catch (Exception e) {
            throw new IllegalArgumentException("Invalid JWT token", e);
        }
    }

    private String sign(String data, String secret) throws Exception {
        Mac mac = Mac.getInstance("HmacSHA256");
        SecretKeySpec keySpec = new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256");
        mac.init(keySpec);
        byte[] rawHmac = mac.doFinal(data.getBytes(StandardCharsets.UTF_8));
        return base64UrlEncode(rawHmac);
    }

    private String base64UrlEncode(byte[] bytes) {
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }
}

