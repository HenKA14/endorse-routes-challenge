package auth

import (
	"errors"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

func testConfig() Config {
	return Config{
		Secret:       []byte("test-secret-test-secret-test-secret!"),
		Issuer:       "routes-api",
		Audience:     "routes-clients",
		TTL:          time.Hour,
		ClientID:     "client",
		ClientSecret: "secret",
	}
}

func TestIssueAndVerify(t *testing.T) {
	svc := NewService(testConfig())
	token, err := svc.Issue("client", "secret")
	if err != nil {
		t.Fatal(err)
	}
	claims, err := svc.Verify(token)
	if err != nil {
		t.Fatal(err)
	}
	if claims.Subject != "client" || !claims.HasScope(ScopeRoutes) || claims.HasScope("otro") {
		t.Fatalf("claims inesperados: %+v", claims)
	}
}

func TestIssueRejectsBadCredentials(t *testing.T) {
	svc := NewService(testConfig())
	for _, c := range [][2]string{{"client", "x"}, {"x", "secret"}, {"", ""}} {
		if _, err := svc.Issue(c[0], c[1]); !errors.Is(err, ErrInvalidCredentials) {
			t.Errorf("Issue(%q,%q) = %v", c[0], c[1], err)
		}
	}
}

func TestVerifyRejectsInvalidTokens(t *testing.T) {
	cfg := testConfig()
	svc := NewService(cfg)

	other := cfg
	other.Secret = []byte("otro-secreto-otro-secreto-otro-secreto")
	wrongSig, _ := NewService(other).Issue("client", "secret")

	wrongAudCfg := cfg
	wrongAudCfg.Audience = "otra-audiencia"
	wrongAud, _ := NewService(wrongAudCfg).Issue("client", "secret")

	expiredSvc := NewService(cfg)
	expiredSvc.now = func() time.Time { return time.Now().Add(-2 * time.Hour) }
	expired, _ := expiredSvc.Issue("client", "secret")

	none, _ := jwt.NewWithClaims(jwt.SigningMethodNone, jwt.MapClaims{
		"sub": "client", "iss": cfg.Issuer, "aud": cfg.Audience, "exp": time.Now().Add(time.Hour).Unix(),
		"scope": []string{ScopeRoutes},
	}).SignedString(jwt.UnsafeAllowNoneSignatureType)

	noExp, _ := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"sub": "client", "iss": cfg.Issuer, "aud": cfg.Audience,
	}).SignedString(cfg.Secret)

	for name, token := range map[string]string{
		"firma de otro secreto": wrongSig,
		"audiencia distinta":    wrongAud,
		"expirado":              expired,
		"alg none":              none,
		"sin exp":               noExp,
		"basura":                "abc.def.ghi",
	} {
		t.Run(name, func(t *testing.T) {
			if _, err := svc.Verify(token); !errors.Is(err, ErrInvalidToken) {
				t.Fatalf("got %v", err)
			}
		})
	}
}
