-- Tabla tecnica de seguridad para registrar intentos de login (rate limit,
-- bloqueo temporal y auditoria). No usa correlativo_sistema: id tecnico
-- autoincremental, no es un identificador de negocio.
CREATE TABLE IF NOT EXISTS aceros.login_attempt (
  id_login_attempt BIGSERIAL PRIMARY KEY,
  correo_normalizado VARCHAR(180) NOT NULL,
  ip_hash VARCHAR(64),
  user_agent_hash VARCHAR(64),
  resultado VARCHAR(30) NOT NULL,
  motivo VARCHAR(80),
  fecha_intento TIMESTAMPTZ(6) NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_login_attempt_correo_fecha
  ON aceros.login_attempt (correo_normalizado, fecha_intento);

CREATE INDEX IF NOT EXISTS idx_login_attempt_ip_fecha
  ON aceros.login_attempt (ip_hash, fecha_intento);

CREATE INDEX IF NOT EXISTS idx_login_attempt_resultado_fecha
  ON aceros.login_attempt (resultado, fecha_intento);

CREATE INDEX IF NOT EXISTS idx_login_attempt_fecha
  ON aceros.login_attempt (fecha_intento);
