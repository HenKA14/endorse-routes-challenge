package httpapi

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"routes-api/internal/auth"
	"routes-api/internal/graph"
	"routes-api/internal/routing"
)

const pdfRequest = `{
  "accidentLocation": "San Isidro",
  "depots": ["Miraflores", "Ate"],
  "graph": {
    "Miraflores": { "San Isidro": 7, "Barranco": 3 },
    "San Isidro": { "Miraflores": 7, "Lince": 4 },
    "Barranco": { "Miraflores": 3, "Surco": 5 },
    "Lince": { "San Isidro": 4, "Surco": 6 },
    "Surco": { "Barranco": 5, "Lince": 6, "Ate": 10 },
    "Ate": { "Surco": 10 }
  }
}`

type staticProvider struct{ g graph.Graph }

func (s staticProvider) DefaultGraph(context.Context) (graph.Graph, error) { return s.g, nil }

type failingCalculator struct{}

func (failingCalculator) OptimalRoute(context.Context, routing.Request) (graph.Route, error) {
	return graph.Route{}, errors.New("db caída")
}
func (failingCalculator) DefaultGraph(context.Context) (graph.Graph, error) {
	return nil, errors.New("db caída")
}

type panicCalculator struct{ failingCalculator }

func (panicCalculator) OptimalRoute(context.Context, routing.Request) (graph.Route, error) {
	panic("bug")
}

func newTestServer(t *testing.T, calc RouteCalculator) (http.Handler, string) {
	t.Helper()
	authSvc := auth.NewService(auth.Config{
		Secret: []byte("test-secret-test-secret-test-secret!"), Issuer: "routes-api", Audience: "routes-clients",
		TTL: time.Hour, ClientID: "client", ClientSecret: "secret",
	})
	if calc == nil {
		calc = routing.NewService(staticProvider{g: graph.Graph{"Miraflores": {"San Isidro": 7}}})
	}
	h := NewRouter(NewHandler(calc, authSvc, 3600), authSvc, []string{"http://localhost:5173"})
	token, err := authSvc.Issue("client", "secret")
	if err != nil {
		t.Fatal(err)
	}
	return h, token
}

func do(h http.Handler, method, path, body, token string, headers ...string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(method, path, strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	for i := 0; i+1 < len(headers); i += 2 {
		req.Header.Set(headers[i], headers[i+1])
	}
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	return rec
}

func decodeErr(t *testing.T, rec *httptest.ResponseRecorder) ErrorResponse {
	t.Helper()
	var e ErrorResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &e); err != nil {
		t.Fatalf("respuesta no JSON: %s", rec.Body.String())
	}
	return e
}

func TestOptimalRoutePDFExample(t *testing.T) {
	h, token := newTestServer(t, nil)
	rec := do(h, http.MethodPost, "/v1/routes/optimal", pdfRequest, token)

	if rec.Code != http.StatusOK {
		t.Fatalf("status %d: %s", rec.Code, rec.Body.String())
	}
	want := `{"fromDepot":"Miraflores","to":"San Isidro","path":["Miraflores","San Isidro"],"distance":7}`
	if got := strings.TrimSpace(rec.Body.String()); got != want {
		t.Fatalf("got %s\nwant %s", got, want)
	}
	if rec.Header().Get("X-Request-Id") == "" || rec.Header().Get("X-Content-Type-Options") != "nosniff" {
		t.Fatal("faltan headers de trazabilidad/seguridad")
	}
}

func TestOptimalRouteUsesDefaultGraphWhenOmitted(t *testing.T) {
	h, token := newTestServer(t, nil)
	rec := do(h, http.MethodPost, "/v1/routes/optimal", `{"accidentLocation":"San Isidro","depots":["Miraflores"]}`, token)
	if rec.Code != http.StatusOK {
		t.Fatalf("status %d: %s", rec.Code, rec.Body.String())
	}
}

func TestOptimalRouteErrors(t *testing.T) {
	h, token := newTestServer(t, nil)
	cases := []struct {
		name, body, token string
		status            int
		code              string
	}{
		{"sin token", pdfRequest, "", 401, "MISSING_TOKEN"},
		{"token inválido", pdfRequest, "x.y.z", 401, "INVALID_TOKEN"},
		{"JSON roto", `{`, token, 400, "INVALID_PAYLOAD"},
		{"cuerpo vacío", ``, token, 400, "INVALID_PAYLOAD"},
		{"campo desconocido", `{"accidentLocation":"A","depots":["B"],"x":1}`, token, 400, "INVALID_PAYLOAD"},
		{"contenido extra", `{"accidentLocation":"A","depots":["B"]} {}`, token, 400, "INVALID_PAYLOAD"},
		{"sin accidentLocation", `{"depots":["A"]}`, token, 400, "INVALID_PAYLOAD"},
		{"sin depots", `{"accidentLocation":"A"}`, token, 400, "INVALID_PAYLOAD"},
		{"demasiados depots", `{"accidentLocation":"A","depots":[` + strings.Repeat(`"x",`, 100) + `"x"]}`, token, 400, "INVALID_PAYLOAD"},
		{"peso negativo", `{"accidentLocation":"B","depots":["A"],"graph":{"A":{"B":-1}}}`, token, 400, "INVALID_GRAPH"},
		{"distrito desconocido", `{"accidentLocation":"Callao","depots":["Miraflores"]}`, token, 422, "UNKNOWN_NODE"},
		{"inalcanzable", `{"accidentLocation":"Miraflores","depots":["San Isidro"]}`, token, 422, "ACCIDENT_UNREACHABLE"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			rec := do(h, http.MethodPost, "/v1/routes/optimal", tc.body, tc.token)
			e := decodeErr(t, rec)
			if rec.Code != tc.status || e.Code != tc.code || e.StatusCode != tc.status {
				t.Fatalf("got %d %+v, want %d %s", rec.Code, e, tc.status, tc.code)
			}
		})
	}
}

func TestOptimalRouteBodyTooLarge(t *testing.T) {
	h, token := newTestServer(t, nil)
	body := `{"accidentLocation":"` + strings.Repeat("a", maxBodyBytes) + `","depots":["x"]}`
	rec := do(h, http.MethodPost, "/v1/routes/optimal", body, token)
	if rec.Code != 400 || !strings.Contains(decodeErr(t, rec).Message, "supera") {
		t.Fatalf("got %d %s", rec.Code, rec.Body.String()[:100])
	}
}

func TestInsufficientScope(t *testing.T) {
	h := RequireJWT(stubVerifier{claims: &auth.Claims{Scope: []string{"otro"}}}, auth.ScopeRoutes)(http.NotFoundHandler())
	rec := do(h, http.MethodPost, "/", "", "tok")
	if rec.Code != http.StatusForbidden {
		t.Fatalf("got %d", rec.Code)
	}
}

type stubVerifier struct{ claims *auth.Claims }

func (s stubVerifier) Verify(string) (*auth.Claims, error) { return s.claims, nil }

func TestUnexpectedErrorsAreHidden(t *testing.T) {
	h, token := newTestServer(t, failingCalculator{})
	rec := do(h, http.MethodPost, "/v1/routes/optimal", pdfRequest, token)
	if e := decodeErr(t, rec); rec.Code != 500 || e.Message != "Error interno" {
		t.Fatalf("got %d %+v", rec.Code, e)
	}
	if rec := do(h, http.MethodGet, "/v1/graph", "", token); rec.Code != 500 {
		t.Fatalf("graph: got %d", rec.Code)
	}
}

func TestPanicRecovered(t *testing.T) {
	h, token := newTestServer(t, panicCalculator{})
	if rec := do(h, http.MethodPost, "/v1/routes/optimal", pdfRequest, token); rec.Code != 500 {
		t.Fatalf("got %d", rec.Code)
	}
}

func TestTokenEndpoint(t *testing.T) {
	h, _ := newTestServer(t, nil)

	rec := do(h, http.MethodPost, "/v1/auth/token", `{"clientId":"client","clientSecret":"secret"}`, "")
	var tr TokenResponse
	_ = json.Unmarshal(rec.Body.Bytes(), &tr)
	if rec.Code != 200 || tr.AccessToken == "" || tr.TokenType != "Bearer" || tr.ExpiresIn != 3600 {
		t.Fatalf("got %d %s", rec.Code, rec.Body.String())
	}

	for body, status := range map[string]int{
		`{"clientId":"client","clientSecret":"bad"}`: 401,
		`{"clientId":"client"}`:                      400,
		`nope`:                                       400,
	} {
		if rec := do(h, http.MethodPost, "/v1/auth/token", body, ""); rec.Code != status {
			t.Errorf("%s: got %d want %d", body, rec.Code, status)
		}
	}
}

func TestGraphHealthCORSAndVersioning(t *testing.T) {
	h, token := newTestServer(t, nil)

	if rec := do(h, http.MethodGet, "/health", "", ""); rec.Code != 200 {
		t.Fatalf("health %d", rec.Code)
	}

	rec := do(h, http.MethodGet, "/v1/graph", "", token)
	if rec.Code != 200 || !strings.Contains(rec.Body.String(), `"nodes":["Miraflores","San Isidro"]`) {
		t.Fatalf("graph %d %s", rec.Code, rec.Body.String())
	}

	pre := do(h, http.MethodOptions, "/v1/routes/optimal", "", "",
		"Origin", "http://localhost:5173", "Access-Control-Request-Method", "POST")
	if pre.Code != 204 || pre.Header().Get("Access-Control-Allow-Origin") != "http://localhost:5173" {
		t.Fatalf("preflight %d %v", pre.Code, pre.Header())
	}
	evil := do(h, http.MethodOptions, "/v1/routes/optimal", "", "",
		"Origin", "https://evil.com", "Access-Control-Request-Method", "POST")
	if evil.Header().Get("Access-Control-Allow-Origin") != "" {
		t.Fatal("no debe permitir orígenes no configurados")
	}

	if rec := do(h, http.MethodPost, "/routes/optimal", pdfRequest, token); rec.Code != 404 {
		t.Fatalf("ruta sin versión debería ser 404, got %d", rec.Code)
	}
	if rec := do(h, http.MethodGet, "/v1/routes/optimal", "", token); rec.Code != 405 {
		t.Fatalf("método incorrecto debería ser 405, got %d", rec.Code)
	}

	rec = do(h, http.MethodGet, "/health", "", "", "X-Request-Id", "abc-123")
	if rec.Header().Get("X-Request-Id") != "abc-123" {
		t.Fatal("debe propagar X-Request-Id")
	}
}
