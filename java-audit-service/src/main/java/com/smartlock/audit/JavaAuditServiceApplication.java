package com.smartlock.audit;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/**
 * Entrypoint for the Java 21 / Spring Boot 3 Enterprise Audit Microservice.
 */
@SpringBootApplication
public class JavaAuditServiceApplication {

    public static void main(String[] args) {
        SpringApplication.run(JavaAuditServiceApplication.class, args);
    }
}
