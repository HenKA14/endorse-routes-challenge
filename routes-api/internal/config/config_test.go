package config

import (
	"strings"
	"testing"
	"time"
)

func env(m map[string]string) func(string) string {
	return func(k string) string { return m[k] }
}

func TestLoadDefaults(t *testing.T) {
	cfg, err := Load(env(nil))
	if err != nil {
		t.Fatal(err)
	}
	if cfg.Port != "8080" || cfg.JWTTTL != time.Hour || len(cfg.CORSOrigins) != 1 {
		t.Fatalf("defaults inesperados: %+v", cfg)
	}
}

func TestLoadParsesOrigins(t *testing.T) {
	cfg, err := Load(env(map[string]string{"CORS_ORIGINS": "https://a.com, https://b.com,", "PORT": "9000"}))
	if err != nil {
		t.Fatal(err)
	}
	if strings.Join(cfg.CORSOrigins, "|") != "https://a.com|https://b.com" || cfg.Port != "9000" {
		t.Fatalf("got %+v", cfg)
	}
}

func TestLoadErrors(t *testing.T) {
	cases := map[string]map[string]string{
		"producción sin secretos":  {"APP_ENV": "production"},
		"secreto corto":            {"JWT_SECRET": "corto"},
		"ttl inválido":             {"JWT_TTL_SECONDS": "-5"},
		"producción sin client id": {"APP_ENV": "production", "JWT_SECRET": strings.Repeat("x", 32)},
	}
	for name, vars := range cases {
		t.Run(name, func(t *testing.T) {
			if _, err := Load(env(vars)); err == nil {
				t.Fatal("esperaba error")
			}
		})
	}
}
