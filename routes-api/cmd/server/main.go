// Comando principal del routes-api (composition root).
package main

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"routes-api/internal/auth"
	"routes-api/internal/config"
	"routes-api/internal/httpapi"
	"routes-api/internal/routing"
)

func main() {
	slog.SetDefault(slog.New(slog.NewJSONHandler(os.Stdout, nil)))
	if err := run(); err != nil {
		slog.Error("error fatal", "error", err)
		os.Exit(1)
	}
}

func run() error {
	cfg, err := config.Load(os.Getenv)
	if err != nil {
		return err
	}

	provider, err := routing.NewFileGraphProvider(cfg.GraphFile)
	if err != nil {
		return err
	}
	authSvc := auth.NewService(auth.Config{
		Secret:       []byte(cfg.JWTSecret),
		Issuer:       cfg.JWTIssuer,
		Audience:     cfg.JWTAudience,
		TTL:          cfg.JWTTTL,
		ClientID:     cfg.ClientID,
		ClientSecret: cfg.ClientSecret,
	})
	handler := httpapi.NewHandler(routing.NewService(provider), authSvc, int(cfg.JWTTTL.Seconds()))

	srv := &http.Server{
		Addr:              ":" + cfg.Port,
		Handler:           httpapi.NewRouter(handler, authSvc, cfg.CORSOrigins),
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       10 * time.Second,
		WriteTimeout:      15 * time.Second,
		IdleTimeout:       60 * time.Second,
	}

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	errCh := make(chan error, 1)
	go func() {
		slog.Info("routes-api escuchando", "port", cfg.Port, "env", cfg.Env)
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			errCh <- err
		}
	}()

	select {
	case err := <-errCh:
		return err
	case <-ctx.Done():
	}

	slog.Info("apagando servidor")
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	return srv.Shutdown(shutdownCtx)
}
