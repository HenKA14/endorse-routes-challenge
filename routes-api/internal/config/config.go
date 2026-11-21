// Package config carga la configuración desde variables de entorno (12-factor).
package config

import (
	"errors"
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"
)

type Config struct {
	Env          string
	Port         string
	GraphFile    string
	CORSOrigins  []string
	JWTSecret    string
	JWTIssuer    string
	JWTAudience  string
	JWTTTL       time.Duration
	ClientID     string
	ClientSecret string
}

const devSecret = "dev-only-secret-change-me-dev-only-secret"

// Load lee la configuración. En producción los secretos son obligatorios.
func Load(getenv func(string) string) (Config, error) {
	if getenv == nil {
		getenv = os.Getenv
	}
	get := func(key, fallback string) string {
		if v := getenv(key); v != "" {
			return v
		}
		return fallback
	}

	env := get("APP_ENV", "development")
	isProd := env == "production"
	secretDefault := func(v string) string {
		if isProd {
			return ""
		}
		return v
	}

	ttl, err := strconv.Atoi(get("JWT_TTL_SECONDS", "3600"))
	if err != nil || ttl <= 0 {
		return Config{}, errors.New("JWT_TTL_SECONDS debe ser un entero positivo")
	}

	cfg := Config{
		Env:          env,
		Port:         get("PORT", "8080"),
		GraphFile:    get("GRAPH_FILE", "data/lima-graph.json"),
		JWTSecret:    get("JWT_SECRET", secretDefault(devSecret)),
		JWTIssuer:    get("JWT_ISSUER", "routes-api"),
		JWTAudience:  get("JWT_AUDIENCE", "routes-clients"),
		JWTTTL:       time.Duration(ttl) * time.Second,
		ClientID:     get("AUTH_CLIENT_ID", secretDefault("frontend-demo")),
		ClientSecret: get("AUTH_CLIENT_SECRET", secretDefault("frontend-demo-secret")),
	}
	for _, o := range strings.Split(get("CORS_ORIGINS", "http://localhost:5173"), ",") {
		if o = strings.TrimSpace(o); o != "" {
			cfg.CORSOrigins = append(cfg.CORSOrigins, o)
		}
	}

	switch {
	case len(cfg.JWTSecret) < 32:
		return Config{}, fmt.Errorf("JWT_SECRET es obligatorio y debe tener al menos 32 caracteres")
	case cfg.ClientID == "" || cfg.ClientSecret == "":
		return Config{}, errors.New("AUTH_CLIENT_ID y AUTH_CLIENT_SECRET son obligatorios")
	}
	return cfg, nil
}
