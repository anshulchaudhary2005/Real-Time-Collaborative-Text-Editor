package com.collaborative.texteditor.security;

import lombok.AllArgsConstructor;
import lombok.Data;

import java.security.Principal;

@Data
@AllArgsConstructor
public class UserPrincipal implements Principal {
    private final Long userId;
    private final String username;
    private final String role;

    @Override
    public String getName() {
        return username;
    }
}

