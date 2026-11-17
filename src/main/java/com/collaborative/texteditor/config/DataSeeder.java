package com.collaborative.texteditor.config;

import com.collaborative.texteditor.document.User;
import com.collaborative.texteditor.repository.UserRepository;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class DataSeeder {

    @Bean
    public CommandLineRunner initDatabase(UserRepository userRepository) {
        return args -> {
           
            userRepository.findAll().forEach(user -> {
                boolean changed = false;
                if (user.getPassword() == null || user.getPassword().isEmpty()) {
                    user.setPassword("password123");
                    changed = true;
                }
                if (user.getRole() == null || user.getRole().isEmpty()) {
                    user.setRole("ROLE_USER");
                    changed = true;
                }
                if (changed) {
                    userRepository.save(user);
                }
            });

        
            if (!userRepository.existsByUsername("developer_nishant")) {
                userRepository.save(User.builder()
                        .username("developer_nishant")
                        .password("password123")
                        .role("ROLE_USER")
                        .build());
            }

            if (!userRepository.existsByUsername("alice_collaborator")) {
                userRepository.save(User.builder()
                        .username("alice_collaborator")
                        .password("password123")
                        .role("ROLE_USER")
                        .build());
            }

            if (!userRepository.existsByUsername("bob_viewer")) {
                userRepository.save(User.builder()
                        .username("bob_viewer")
                        .password("password123")
                        .role("ROLE_USER")
                        .build());
            }

            System.out.println("User database verified & seeded: developer_nishant, alice_collaborator, bob_viewer");
        };
    }
}
