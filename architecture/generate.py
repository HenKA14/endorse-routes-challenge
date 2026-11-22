"""Genera architecture/prestamos-renta-particular.drawio (AS IS + TO BE) y una
vista previa SVG de cada página a partir del mismo modelo."""
import html
import re
import sys
from xml.sax.saxutils import quoteattr

OUT_DIR = sys.argv[1]

# ---------------------------------------------------------------- estilos
C_GCP = "rounded=1;arcSize=2;whiteSpace=wrap;html=1;fillColor=#F1F8E9;strokeColor=#9CCC65;verticalAlign=top;align=left;spacingLeft=10;spacingTop=4;fontStyle=1;fontSize=13;"
C_ZONE = "rounded=1;arcSize=3;whiteSpace=wrap;html=1;fillColor=none;strokeColor=#546E7A;dashed=1;verticalAlign=top;align=left;spacingLeft=10;spacingTop=4;fontStyle=1;fontSize=12;"
C_ONPREM = "rounded=1;arcSize=2;whiteSpace=wrap;html=1;fillColor=#ECEFF1;strokeColor=#90A4AE;verticalAlign=top;align=left;spacingLeft=10;spacingTop=4;fontStyle=1;fontSize=13;"
C_VM = "rounded=1;arcSize=3;whiteSpace=wrap;html=1;fillColor=#FFEBEE;strokeColor=#EF9A9A;verticalAlign=top;align=left;spacingLeft=10;spacingTop=4;fontStyle=1;fontSize=12;"
C_SAAS = "rounded=1;arcSize=2;whiteSpace=wrap;html=1;fillColor=#E0E0E0;strokeColor=#9E9E9E;verticalAlign=top;align=left;spacingLeft=10;spacingTop=4;fontStyle=1;fontSize=13;"
C_BAND = "rounded=1;arcSize=20;whiteSpace=wrap;html=1;fillColor=#E3F2FD;strokeColor=#1E88E5;dashed=1;fontSize=12;fontStyle=1;fontColor=#0D47A1;"

N_BASE = "rounded=1;arcSize=8;whiteSpace=wrap;html=1;align=left;verticalAlign=top;spacing=8;fontSize=11;"
N_EXIST = N_BASE + "fillColor=#FFFFFF;strokeColor=#1E88E5;"
N_NEW = N_BASE + "fillColor=#E8F5E9;strokeColor=#2E7D32;strokeWidth=2;"
N_MOD = N_BASE + "fillColor=#FFF3E0;strokeColor=#EF6C00;strokeWidth=2;"
N_ACTOR = "rounded=1;arcSize=20;whiteSpace=wrap;html=1;fillColor=#DBEAFE;strokeColor=#3B82F6;fontSize=11;fontStyle=1;"
N_NOTE = "shape=note;size=14;whiteSpace=wrap;html=1;fillColor=#FFEBEE;strokeColor=#C62828;fontColor=#B71C1C;align=left;verticalAlign=top;spacing=8;fontSize=11;"
N_LEGEND = "rounded=1;arcSize=3;whiteSpace=wrap;html=1;fillColor=#FFFFFF;strokeColor=#90A4AE;align=left;verticalAlign=top;spacing=12;fontSize=12;"

E_BASE = "edgeStyle=orthogonalEdgeStyle;rounded=1;html=1;endArrow=block;endFill=1;fontSize=10;labelBackgroundColor=#FFFFFF;"
E_SYNC = E_BASE + "strokeColor=#1E88E5;strokeWidth=1.5;"
E_ASYNC = E_BASE + "strokeColor=#2E7D32;strokeWidth=2;"
E_RESP = E_BASE + "strokeColor=#546E7A;dashed=1;"
E_ERR = E_BASE + "strokeColor=#C62828;strokeWidth=2;dashed=1;fontColor=#C62828;"

STROKE = {
    N_EXIST: ("#FFFFFF", "#1E88E5"), N_NEW: ("#E8F5E9", "#2E7D32"), N_MOD: ("#FFF3E0", "#EF6C00"),
    N_ACTOR: ("#DBEAFE", "#3B82F6"), N_NOTE: ("#FFEBEE", "#C62828"), N_LEGEND: ("#FFFFFF", "#90A4AE"),
    C_GCP: ("#F1F8E9", "#9CCC65"), C_ZONE: ("none", "#546E7A"), C_ONPREM: ("#ECEFF1", "#90A4AE"),
    C_VM: ("#FFEBEE", "#EF9A9A"), C_SAAS: ("#E0E0E0", "#9E9E9E"), C_BAND: ("#E3F2FD", "#1E88E5"),
}
EDGE_COLOR = {E_SYNC: "#1E88E5", E_ASYNC: "#2E7D32", E_RESP: "#546E7A", E_ERR: "#C62828"}


def svc(name, kind, notes="", tag=""):
    tag_html = f' <font color="#2E7D32">[{tag}]</font>' if tag == "NUEVO" else (
        f' <font color="#EF6C00">[{tag}]</font>' if tag else "")
    body = f"<b>{name}</b>{tag_html}<br><i>{kind}</i>"
    if notes:
        body += "<br>" + "<br>".join(f"• {n}" for n in notes)
    return body


class Page:
    def __init__(self, name, width, height):
        self.name, self.width, self.height = name, width, height
        self.containers, self.nodes, self.edges = [], [], []

    def container(self, cid, label, x, y, w, h, style):
        self.containers.append((cid, label, x, y, w, h, style))

    def node(self, nid, label, x, y, w, h, style):
        self.nodes.append((nid, label, x, y, w, h, style))

    def edge(self, src, tgt, label, style, exit=None, entry=None, points=()):
        self.edges.append((src, tgt, label, style, exit, entry, list(points)))

    def box(self, bid):
        for b in self.containers + self.nodes:
            if b[0] == bid:
                return b[2:6]
        raise KeyError(bid)

    # ------------------------------------------------------------ draw.io
    def to_drawio(self, page_id):
        cells = ['<mxCell id="0"/>', '<mxCell id="1" parent="0"/>']
        for cid, label, x, y, w, h, style in self.containers + self.nodes:
            cells.append(
                f'<mxCell id="{cid}" value={quoteattr(label)} style="{style}" vertex="1" parent="1">'
                f'<mxGeometry x="{x}" y="{y}" width="{w}" height="{h}" as="geometry"/></mxCell>')
        for i, (src, tgt, label, style, ex, en, pts) in enumerate(self.edges):
            st = style
            if ex:
                st += f"exitX={ex[0]};exitY={ex[1]};exitDx=0;exitDy=0;"
            if en:
                st += f"entryX={en[0]};entryY={en[1]};entryDx=0;entryDy=0;"
            pts_xml = ""
            if pts:
                pts_xml = '<Array as="points">' + "".join(f'<mxPoint x="{px}" y="{py}"/>' for px, py in pts) + "</Array>"
            cells.append(
                f'<mxCell id="{page_id}-e{i}" value={quoteattr(label)} style="{st}" edge="1" parent="1" source="{src}" target="{tgt}">'
                f'<mxGeometry relative="1" as="geometry">{pts_xml}</mxGeometry></mxCell>')
        return (f'<diagram id="{page_id}" name={quoteattr(self.name)}><mxGraphModel dx="1600" dy="1000" grid="1" gridSize="10" '
                f'guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" '
                f'pageWidth="{self.width}" pageHeight="{self.height}" math="0" shadow="0"><root>'
                + "".join(cells) + "</root></mxGraphModel></diagram>")

    # ------------------------------------------------------------ SVG preview
    def to_svg(self):
        out = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {self.width} {self.height}" width="{self.width}" height="{self.height}" font-family="Helvetica, Arial, sans-serif">',
               '<defs><marker id="a" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="context-stroke"/></marker></defs>',
               f'<rect width="{self.width}" height="{self.height}" fill="#FAFAFA"/>']
        for cid, label, x, y, w, h, style in self.containers:
            fill, stroke = STROKE[style]
            dash = ' stroke-dasharray="6 4"' if "dashed=1" in style else ""
            out.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="6" fill="{fill}" stroke="{stroke}"{dash}/>')
            if style == C_BAND:
                out.append(f'<text x="{x + w / 2}" y="{y + h / 2 + 4}" font-size="12" font-weight="bold" text-anchor="middle" fill="#0D47A1">{html.escape(strip(label))}</text>')
            else:
                out.append(f'<text x="{x + 10}" y="{y + 18}" font-size="13" font-weight="bold" fill="#263238">{html.escape(strip(label))}</text>')
        for src, tgt, label, style, ex, en, pts in self.edges:
            p1 = anchor(self.box(src), ex, self.box(tgt))
            p2 = anchor(self.box(tgt), en, self.box(src))
            poly = [p1] + pts + [p2]
            color = EDGE_COLOR[style]
            dash = ' stroke-dasharray="6 4"' if "dashed=1" in style else ""
            d = " ".join(f"{px:.0f},{py:.0f}" for px, py in poly)
            out.append(f'<polyline points="{d}" fill="none" stroke="{color}" stroke-width="1.6"{dash} marker-end="url(#a)"/>')
            if label:
                segs = list(zip(poly, poly[1:]))
                a, b = max(segs, key=lambda sg: abs(sg[0][0] - sg[1][0]) + abs(sg[0][1] - sg[1][1]))
                mx, my = (a[0] + b[0]) / 2, (a[1] + b[1]) / 2
                lines = strip(label).split("\n")
                for i, ln in enumerate(lines):
                    ty = my + (i - (len(lines) - 1) / 2) * 12 + 3
                    out.append(f'<text x="{mx:.0f}" y="{ty:.0f}" font-size="10" text-anchor="middle" fill="{color}" stroke="#FAFAFA" stroke-width="3" paint-order="stroke">{html.escape(ln)}</text>')
        for nid, label, x, y, w, h, style in self.nodes:
            fill, stroke = STROKE[style]
            sw = 2 if "strokeWidth=2" in style else 1.2
            out.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="8" fill="{fill}" stroke="{stroke}" stroke-width="{sw}"/>')
            centered = style == N_ACTOR
            lines = wrap(strip(label).split("\n"), w - 16, 11)
            for i, ln in enumerate(lines):
                bold = ' font-weight="bold"' if i == 0 else ""
                if centered:
                    ty = y + h / 2 + (i - (len(lines) - 1) / 2) * 14 + 4
                    out.append(f'<text x="{x + w / 2}" y="{ty:.0f}" font-size="11"{bold} text-anchor="middle" fill="#1F2937">{html.escape(ln)}</text>')
                else:
                    ty = y + 18 + i * 14
                    if ty > y + h - 4:
                        break
                    out.append(f'<text x="{x + 8}" y="{ty}" font-size="11"{bold} fill="#1F2937">{html.escape(ln)}</text>')
        out.append("</svg>")
        return "\n".join(out)


def strip(label):
    t = re.sub(r"<br\s*/?>", "\n", label)
    t = re.sub(r"<[^>]+>", "", t)
    return html.unescape(t)


def wrap(lines, width_px, font):
    max_chars = max(8, int(width_px / (font * 0.55)))
    out = []
    for line in lines:
        indent = "  " if line.startswith("• ") else ""
        words, cur = line.split(" "), ""
        for wd in words:
            if len(cur) + len(wd) + 1 > max_chars and cur:
                out.append(cur)
                cur = indent + wd
            else:
                cur = f"{cur} {wd}" if cur else wd
        out.append(cur)
    return out


def anchor(box, frac, other):
    x, y, w, h = box
    if frac:
        return (x + w * frac[0], y + h * frac[1])
    ox, oy, ow, oh = other
    cx, cy, tx, ty = x + w / 2, y + h / 2, ox + ow / 2, oy + oh / 2
    dx, dy = tx - cx, ty - cy
    if dx == 0 and dy == 0:
        return (cx, cy)
    sx = (w / 2) / abs(dx) if dx else float("inf")
    sy = (h / 2) / abs(dy) if dy else float("inf")
    s = min(sx, sy)
    return (cx + dx * s, cy + dy * s)


# ======================================================================
# AS IS
# ======================================================================
asis = Page("AS IS - Flujo síncrono (problema)", 1640, 960)
asis.node("a-cli", "Clientes de<br>Renta Particular", 20, 190, 110, 70, N_ACTOR)
asis.node("a-ops", "Equipo de<br>Operaciones", 20, 690, 110, 70, N_ACTOR)
asis.node("a-proxy", svc("Proxy", "interseguro.pe/zona-segura"), 160, 190, 160, 70, N_EXIST)
asis.node("a-proxyops", svc("Proxy", "interseguro.pe/ADMWR"), 160, 690, 160, 70, N_EXIST)

asis.container("a-gcp", "GCP · INTERSEGURO-ZONA-PRIVADA", 350, 40, 680, 370, C_GCP)
asis.container("a-zs", "Zona Segura", 370, 80, 640, 310, C_ZONE)
asis.node("a-fe", svc("zona-segura-frontend", "Cloud Run · Vue", ["Espera la respuesta en pantalla"]), 390, 130, 200, 90, N_EXIST)
asis.node("a-be", svc("zona-segura-backend", "Cloud Run · Node", ["Llamada síncrona a INARI", "Sin idempotencia"]), 690, 130, 210, 90, N_EXIST)
asis.node("a-mongo", svc("portal-db", "MongoDB · Compute Engine"), 690, 280, 210, 70, N_EXIST)

asis.container("a-mvp", "GCP-MVP", 1060, 40, 260, 170, C_GCP)
asis.node("a-csql", svc("is-caoi-interface-ultimus", "Cloud SQL"), 1080, 90, 220, 70, N_EXIST)

asis.container("a-vce", "IS-VCE (on-premise)", 350, 460, 1000, 470, C_ONPREM)
asis.container("a-inari", "VMWARE INARI (10.49.46.79)", 370, 500, 560, 410, C_VM)
asis.node("a-pinari", svc("Proxy INARI", "Timeout corto hacia admwr"), 390, 540, 190, 70, N_EXIST)
asis.node("a-forms", svc("ADMWR", ".NET Forms"), 390, 700, 190, 70, N_EXIST)
asis.node("a-admwr", svc("admwr-api", "poolAdmwrApi", ["Procesa en segundo plano aunque el proxy ya respondió 502"]), 650, 540, 260, 100, N_EXIST)
asis.node("a-ultapi", svc("ultimus-api", "poolUltimusApi"), 650, 760, 260, 70, N_EXIST)
asis.container("a-tauro", "TAURO (10.49.46.80)", 960, 500, 370, 170, C_VM)
asis.node("a-sql", svc("admwr", "SQL Server · Compute Engine"), 980, 550, 330, 70, N_EXIST)
asis.container("a-sftp", "SFTP S42VP (10.49.46.81)", 960, 700, 370, 210, C_VM)
asis.node("a-sftpn", svc("SFTP_ASBANC", "Carpeta compartida"), 1100, 820, 200, 60, N_EXIST)

asis.container("a-ext", "EXTERNAL SAAS", 1380, 40, 240, 890, C_SAAS)
asis.node("a-ult", svc("ULTIMUS", "SaaS"), 1410, 560, 180, 60, N_EXIST)
asis.node("a-exa", svc("EXACTUS", "SaaS"), 1410, 680, 180, 60, N_EXIST)
asis.node("a-banks", svc("SFTP bancos", "BBVA · BCP · IBK · SCOTIA"), 1410, 820, 180, 60, N_EXIST)

asis.edge("a-cli", "a-proxy", "Solicitar préstamo", E_SYNC)
asis.edge("a-proxy", "a-fe", "", E_SYNC)
asis.edge("a-fe", "a-be", "Registrar préstamo", E_SYNC)
asis.edge("a-be", "a-mongo", "Guardar evento y cronograma", E_SYNC)
asis.edge("a-be", "a-pinari", "Enviar cronograma (síncrono)", E_SYNC, exit=(0, 0.8), entry=(0.75, 0), points=[(640, 202), (640, 450), (532, 450)])
asis.edge("a-pinari", "a-admwr", "", E_SYNC)
asis.edge("a-pinari", "a-be", "502 Bad Gateway", E_ERR, exit=(0.25, 0), entry=(0, 0.95), points=[(437, 430), (620, 430), (620, 215)])
asis.edge("a-admwr", "a-sql", "Guardar / consultar préstamos", E_SYNC)
asis.edge("a-admwr", "a-ultapi", "Generar incidente pago", E_SYNC)
asis.edge("a-ultapi", "a-ult", "Registrar incidente pago", E_SYNC, exit=(1, 0.3), entry=(0, 0.5), points=[(1360, 781), (1360, 590)])
asis.edge("a-ultapi", "a-sftpn", "Generar tramas ASBANC", E_SYNC, exit=(0.5, 1), entry=(0, 0.6), points=[(780, 856)])
asis.edge("a-ult", "a-exa", "", E_SYNC)
asis.edge("a-ult", "a-csql", "", E_SYNC, exit=(0.5, 0), entry=(1, 0.5))
asis.edge("a-banks", "a-sftpn", "", E_SYNC)
asis.edge("a-ops", "a-proxyops", "Consultar préstamos", E_SYNC)
asis.edge("a-proxyops", "a-forms", "", E_SYNC)
asis.edge("a-forms", "a-admwr", "", E_SYNC, exit=(1, 0.3), entry=(0.2, 1))

asis.node("a-n1", "<b>❶ Lentitud en admwr</b><br>El proxy corta por timeout y responde 502 aunque la operación sigue viva.", 150, 440, 190, 100, N_NOTE)
asis.node("a-n2", "<b>❷ Procesamiento fantasma</b><br>admwr termina y desembolsa; nadie avisa al cliente.", 390, 800, 240, 90, N_NOTE)
asis.node("a-n3", "<b>❸ Reintento del cliente</b><br>Sin éxito en pantalla, vuelve a solicitar → <b>desembolso duplicado</b>.", 150, 300, 190, 90, N_NOTE)
asis.node("a-n4", "<b>Causa raíz</b><br>• Flujo síncrono acoplado a la latencia de INARI<br>• Sin clave de idempotencia extremo a extremo<br>• Sin control de concurrencia por póliza<br>• Sin conciliación de estados inciertos", 1060, 240, 300, 150, N_NOTE)

# ======================================================================
# TO BE
# ======================================================================
tobe = Page("TO BE - Asíncrono e idempotente", 1800, 1480)
tobe.node("t-cli", "Clientes de<br>Renta Particular", 20, 250, 110, 70, N_ACTOR)
tobe.node("t-ops", "Equipo de<br>Operaciones", 20, 905, 110, 70, N_ACTOR)
tobe.node("t-armor", svc("Cloud LB + Cloud Armor", "Perímetro", ["WAF OWASP", "Rate limit por usuario/IP en /disbursements", "TLS 1.2+"], "NUEVO"), 160, 225, 180, 120, N_NEW)
tobe.node("t-pops", svc("Proxy", "interseguro.pe/ADMWR"), 160, 905, 170, 70, N_EXIST)

tobe.container("t-gcp", "GCP · INTERSEGURO-ZONA-PRIVADA", 360, 30, 900, 660, C_GCP)
tobe.container("t-zs", "Zona Segura", 380, 70, 860, 600, C_ZONE)
tobe.node("t-fe", svc("zona-segura-frontend", "Cloud Run · Vue", ["Genera Idempotency-Key (UUID) por intención y la persiste", "Botón deshabilitado al enviar", "Muestra «En proceso» y consulta estado"], "MOD"), 400, 105, 180, 140, N_MOD)
tobe.node("t-be", svc("zona-segura-backend", "Cloud Run · Node", ["POST /v1/disbursements → 202", "GET /v1/disbursements/{id}", "Clave repetida → mismo requestId", "Ya no llama a INARI"], "MOD"), 700, 105, 200, 140, N_MOD)
tobe.node("t-relay", svc("outbox-relay", "Cloud Run · Mongo Change Streams", ["Publica el outbox (at-least-once)", "Marca publicado tras ack"], "NUEVO"), 970, 105, 240, 110, N_NEW)
tobe.node("t-sec", svc("Plataforma", "Secret Manager · Cloud Logging/Monitoring/Trace", ["correlationId = idempotencyKey", "Alertas: DLQ > 0, PROCESSING > 10 min"], "NUEVO"), 400, 290, 180, 130, N_NEW)
tobe.node("t-db", svc("portal-db", "MongoDB (replica set)", ["loan_requests: UNIQUE(idempotencyKey)", "UNIQUE parcial (policyId) si estado ∈ {PENDING, PROCESSING}", "campo version (CAS)", "outbox en la misma transacción"], "MOD"), 700, 280, 200, 150, N_MOD)
tobe.node("t-topic", svc("loan-disbursement-requested", "Pub/Sub", ["orderingKey = policyId", "exactly-once delivery", "maxDeliveryAttempts = 5 → DLQ"], "NUEVO"), 970, 280, 240, 110, N_NEW)
tobe.node("t-notif", svc("disbursement-notifier", "Cloud Run · topic loan-disbursement-status", ["Email / push al cliente con el resultado"], "NUEVO"), 400, 460, 180, 110, N_NEW)
tobe.node("t-worker", svc("disbursement-worker", "Cloud Run · concurrency=1 · max-instances=3", ["CAS PENDING→PROCESSING (un solo worker)", "Circuit breaker + backoff exponencial con jitter", "Timeout/5xx: consulta estado por clave antes de reintentar"], "NUEVO"), 970, 440, 240, 140, N_NEW)
tobe.node("t-dlq", svc("loan-disbursement-dlq", "Pub/Sub · dead letter", ["Revisión manual de Operaciones"], "NUEVO"), 700, 590, 200, 70, N_NEW)

tobe.container("t-mvp", "GCP-MVP", 1290, 30, 230, 200, C_GCP)
tobe.node("t-csql", svc("is-caoi-interface-ultimus", "Cloud SQL"), 1310, 90, 190, 70, N_EXIST)
tobe.container("t-plat", "Operación", 1290, 260, 230, 430, C_GCP)
tobe.node("t-sched", svc("Cloud Scheduler", "cada 10 min / diario", [], "NUEVO"), 1310, 300, 190, 70, N_NEW)
tobe.node("t-recon", svc("reconciliation-job", "Cloud Run Job", ["PROCESSING > N min → consulta admwr por clave y corrige el estado", "Cuadre diario solicitudes vs desembolsos: alerta si hay duplicados"], "NUEVO"), 1310, 450, 190, 170, N_NEW)

tobe.node("t-band", "Serverless VPC Access → Cloud VPN / Interconnect  ·  mTLS + allowlist de IP  ·  solo el worker y el job llegan a INARI", 360, 715, 1160, 40, C_BAND)

tobe.container("t-vce", "IS-VCE (on-premise)", 360, 775, 1160, 410, C_ONPREM)
tobe.container("t-inari", "VMWARE INARI (10.49.46.79)", 380, 815, 640, 350, C_VM)
tobe.node("t-forms", svc("ADMWR", ".NET Forms"), 400, 900, 170, 70, N_EXIST)
tobe.node("t-admwr", svc("admwr-api", "poolAdmwrApi · IDEMPOTENTE", ["Header Idempotency-Key obligatorio", "INSERT disbursement_request (UNIQUE key) en la MISMA transacción que registra el préstamo", "Clave repetida → devuelve el resultado guardado, no re-ejecuta", "GET /loans/by-key/{key} para conciliación"], "MOD"), 620, 850, 400, 140, N_MOD)
tobe.node("t-ultapi", svc("ultimus-api", "poolUltimusApi"), 620, 1050, 400, 70, N_EXIST)
tobe.container("t-tauro", "TAURO (10.49.46.80)", 1040, 815, 460, 160, C_VM)
tobe.node("t-sql", svc("admwr", "SQL Server", ["préstamos + disbursement_request(idempotency_key UNIQUE, policy, status, loan_id, created_at)"], "MOD"), 1060, 855, 420, 100, N_MOD)
tobe.container("t-sftp", "SFTP S42VP (10.49.46.81)", 1040, 995, 460, 170, C_VM)
tobe.node("t-sftpn", svc("SFTP_ASBANC", "Carpeta compartida"), 1180, 1095, 200, 55, N_EXIST)

tobe.container("t-ext", "EXTERNAL SAAS", 1550, 30, 230, 1155, C_SAAS)
tobe.node("t-exa", svc("EXACTUS", "SaaS"), 1580, 905, 170, 60, N_EXIST)
tobe.node("t-ult", svc("ULTIMUS", "SaaS"), 1580, 1055, 170, 60, N_EXIST)
tobe.node("t-banks", svc("SFTP bancos", "BBVA · BCP · IBK · SCOTIA"), 1580, 1125, 170, 50, N_EXIST)

# Flujo síncrono (rápido, < 300 ms)
tobe.edge("t-cli", "t-armor", "1. Solicitar préstamo", E_SYNC)
tobe.edge("t-armor", "t-fe", "", E_SYNC)
tobe.edge("t-fe", "t-be", "2. POST\n(Idempotency-Key)", E_SYNC, exit=(1, 0.3), entry=(0, 0.3))
tobe.edge("t-be", "t-fe", "4. 202 Accepted\n11. GET estado", E_RESP, exit=(0, 0.75), entry=(1, 0.75))
tobe.edge("t-be", "t-db", "3. TX: PENDING + outbox", E_SYNC)
# Flujo asíncrono
tobe.edge("t-db", "t-relay", "5. change stream", E_ASYNC, exit=(1, 0.3), entry=(0, 0.6), points=[(935, 325), (935, 171)])
tobe.edge("t-relay", "t-topic", "6. publica", E_ASYNC)
tobe.edge("t-topic", "t-worker", "", E_ASYNC)
tobe.edge("t-worker", "t-db", "8. CAS → PROCESSING\n10. DISBURSED / FAILED", E_ASYNC, exit=(0, 0.25), entry=(0.5, 1), points=[(800, 475)])
tobe.edge("t-worker", "t-admwr", "9. POST /loans (Idempotency-Key)\ntimeout 60 s · mTLS", E_ASYNC, exit=(0.12, 1), entry=(0.97, 0))
tobe.edge("t-worker", "t-notif", "10. publica estado", E_ASYNC, exit=(0, 0.6), entry=(1, 0.5), points=[(640, 524), (640, 515)])
tobe.edge("t-notif", "t-cli", "12. Notificación\nemail / push", E_RESP, exit=(0, 0.5), entry=(0.5, 1), points=[(75, 515)])
tobe.edge("t-worker", "t-dlq", "tras 5 intentos", E_ERR, exit=(0.3, 1), entry=(1, 0.5), points=[(1042, 625)])
# Conciliación
tobe.edge("t-sched", "t-recon", "dispara", E_RESP)
tobe.edge("t-recon", "t-admwr", "GET /loans/by-key/{key}", E_RESP, exit=(0.5, 1), entry=(0.99, 0.2), points=[(1405, 700), (1530, 700), (1530, 798), (1035, 798), (1035, 878)])
tobe.edge("t-recon", "t-db", "corrige estados inciertos", E_RESP, exit=(0, 0.1), entry=(1, 0.97), points=[(1240, 467), (1240, 425)])
# Sistemas existentes
tobe.edge("t-admwr", "t-sql", "", E_SYNC)
tobe.edge("t-admwr", "t-ultapi", "Generar incidente pago", E_SYNC)
tobe.edge("t-ultapi", "t-ult", "Registrar incidente pago", E_SYNC, exit=(1, 0.5), entry=(0, 0.5))
tobe.edge("t-ultapi", "t-sftpn", "Generar tramas ASBANC", E_SYNC, exit=(0.5, 1), entry=(0, 0.6), points=[(820, 1128)])
tobe.edge("t-ult", "t-exa", "", E_SYNC)
tobe.edge("t-ult", "t-csql", "", E_SYNC, exit=(1, 0.3), entry=(1, 0.5), points=[(1765, 1073), (1765, 125)])
tobe.edge("t-banks", "t-sftpn", "", E_SYNC, exit=(0, 0.5), entry=(1, 0.55))
tobe.edge("t-ops", "t-pops", "Consultar préstamos", E_SYNC)
tobe.edge("t-pops", "t-forms", "", E_SYNC)
tobe.edge("t-forms", "t-admwr", "", E_SYNC, exit=(1, 0.5), entry=(0, 0.6))

tobe.node("t-legend", (
    "<b>Cómo se elimina la duplicidad (defensa en profundidad)</b><br>"
    "• <b>Capa 1 · Frontend:</b> una Idempotency-Key por intención de préstamo, persistida (sessionStorage); reintentos y refresh reutilizan la misma clave.<br>"
    "• <b>Capa 2 · portal-db:</b> índice UNIQUE sobre la clave (misma clave = misma solicitud) + índice UNIQUE parcial por póliza activa (doble pestaña o doble clic con claves distintas → 409 con la solicitud vigente).<br>"
    "• <b>Capa 3 · admwr (TAURO):</b> UNIQUE(idempotency_key) en la misma transacción que el préstamo. Aunque el worker reintente o Pub/Sub entregue dos veces, SQL Server rechaza el segundo insert.<br>"
    "• <b>Reintentos seguros:</b> ante timeout el worker primero consulta GET /loans/by-key; solo reintenta si el préstamo no existe. Los estados inciertos los cierra el job de conciliación.<br>"
    "• <b>Concurrencia:</b> CAS sobre version (PENDING→PROCESSING), orderingKey por póliza y worker con concurrency=1 / max-instances=3 → como máximo 3 llamadas simultáneas a INARI (protege su latencia).<br>"
    "• <b>Experiencia:</b> el cliente recibe 202 en &lt; 300 ms con «Solicitud recibida, en proceso»; ya no ve 502. El resultado llega por la pantalla de estado y por email/push.<br><br>"
    "<b>Leyenda:</b> <font color=\"#2E7D32\">■ NUEVO</font> &nbsp; <font color=\"#EF6C00\">■ MODIFICADO</font> &nbsp; <font color=\"#1E88E5\">■ existente</font> &nbsp; "
    "<font color=\"#1E88E5\">→ síncrono</font> &nbsp; <font color=\"#2E7D32\">→ asíncrono</font> &nbsp; <font color=\"#546E7A\">⇢ respuesta/consulta</font> &nbsp; <font color=\"#C62828\">⇢ error</font>"
), 20, 1215, 1760, 245, N_LEGEND)

pages = [asis, tobe]
xml = ('<mxfile host="app.diagrams.net" type="device">'
       + "".join(p.to_drawio(f"p{i}") for i, p in enumerate(pages)) + "</mxfile>")
with open(f"{OUT_DIR}/prestamos-renta-particular.drawio", "w", encoding="utf-8") as f:
    f.write(xml)
for p, name in zip(pages, ["as-is", "to-be"]):
    with open(f"{OUT_DIR}/{name}.svg", "w", encoding="utf-8") as f:
        f.write(p.to_svg())
print("ok")
