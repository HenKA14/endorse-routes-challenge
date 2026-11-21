// Package auth emite y valida JWT HS256 (client credentials simplificado).
package auth

import (
	"crypto/sha256"
	"crypto/subtle"
	"errors"
	"fmt"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

const ScopeRoutes = "routes:calculate"

var (
	ErrInvalidCredentials = errors.New("credenciales de cliente inválidas")
	ErrInvalidToken       = errors.New("token inválido")
)

type Config struct {
	Secret       []byte
	Issuer       string
	Audience     string
	TTL          time.Duration
	ClientID     string
	ClientSecret string
}

type Claims struct {
	Scope []string `json:"scope"`
	jwt.RegisteredClaims
}

type Service struct {
	cfg Config
	now func() time.Time
}

func NewService(cfg Config) *Service {
	return &Service{cfg: cfg, now: time.Now}
}

// equal compara en tiempo constante (sobre hashes de igual longitud).
func equal(a, b string) bool {
	ha, hb := sha256.Sum256([]byte(a)), sha256.Sum256([]byte(b))
	return subtle.ConstantTimeCompare(ha[:], hb[:]) == 1
}

func (s *Service) Issue(clientID, clientSecret string) (string, error) {
	okID := equal(clientID, s.cfg.ClientID)
	okSecret := equal(clientSecret, s.cfg.ClientSecret)
	if !okID || !okSecret {
		return "", ErrInvalidCredentials
	}
	now := s.now()
	claims := Claims{
		Scope: []string{ScopeRoutes},
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   clientID,
			Issuer:    s.cfg.Issuer,
			Audience:  jwt.ClaimStrings{s.cfg.Audience},
			IssuedAt:  jwt.NewNumericDate(now),
			NotBefore: jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(now.Add(s.cfg.TTL)),
		},
	}
	return jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString(s.cfg.Secret)
}

// Verify valida firma (solo HS256, evita ataques alg=none / confusión de
// algoritmo), expiración, issuer y audience.
func (s *Service) Verify(token string) (*Claims, error) {
	claims := &Claims{}
	_, err := jwt.ParseWithClaims(token, claims, func(*jwt.Token) (any, error) { return s.cfg.Secret, nil },
		jwt.WithValidMethods([]string{jwt.SigningMethodHS256.Alg()}),
		jwt.WithIssuer(s.cfg.Issuer),
		jwt.WithAudience(s.cfg.Audience),
		jwt.WithExpirationRequired(),
		jwt.WithLeeway(15*time.Second),
		jwt.WithTimeFunc(s.now),
	)
	if err != nil {
		return nil, fmt.Errorf("%w: %v", ErrInvalidToken, err)
	}
	return claims, nil
}

// HasScope indica si el token incluye el scope requerido.
func (c *Claims) HasScope(scope string) bool {
	for _, s := range c.Scope {
		if s == scope {
			return true
		}
	}
	return false
}
