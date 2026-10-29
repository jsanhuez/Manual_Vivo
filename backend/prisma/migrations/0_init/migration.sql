-- Manual Vivo · Migracion inicial
-- Orden: tipos -> catálogos -> usuarios -> gestión documental -> onboarding
-- -> auditoría -> índices -> funciones y triggers -> vistas -> RLS

-- 1. Tipos enumerados
CREATE TYPE record_status  AS ENUM ('ACTIVE', 'ARCHIVED');
CREATE TYPE version_status AS ENUM ('DRAFT', 'IN_REVIEW', 'PUBLISHED', 'REJECTED');
CREATE TYPE relation_type  AS ENUM ('INFORMATION_HANDOFF', 'TRIGGERS', 'DEPENDS_ON');

-- 2. Catalogos de seguridad y organizacion
CREATE TABLE roles (
    id          SMALLINT GENERATED ALWAYS AS IDENTITY,
    name        VARCHAR(30)  NOT NULL,
    description VARCHAR(150),
    CONSTRAINT pk_roles PRIMARY KEY (id),
    CONSTRAINT uq_roles_name UNIQUE (name),
    CONSTRAINT ck_roles_name CHECK (name IN ('COLLABORATOR', 'EDITOR', 'ADMIN'))
);

CREATE TABLE access_levels (
    id          SMALLINT GENERATED ALWAYS AS IDENTITY,
    name        VARCHAR(40)  NOT NULL,
    level       SMALLINT     NOT NULL,
    description VARCHAR(150),
    CONSTRAINT pk_access_levels PRIMARY KEY (id),
    CONSTRAINT uq_access_levels_name UNIQUE (name),
    CONSTRAINT uq_access_levels_level UNIQUE (level),
    CONSTRAINT ck_access_levels_level CHECK (level BETWEEN 1 AND 9)
);

CREATE TABLE areas (
    id          SMALLINT GENERATED ALWAYS AS IDENTITY,
    name        VARCHAR(60)  NOT NULL,
    description VARCHAR(200),
    is_active   BOOLEAN      NOT NULL DEFAULT true,
    CONSTRAINT pk_areas PRIMARY KEY (id),
    CONSTRAINT uq_areas_name UNIQUE (name)
);

-- 3. Usuarios
CREATE TABLE users (
    id              UUID         NOT NULL DEFAULT gen_random_uuid(),
    area_id         SMALLINT     NOT NULL,
    role_id         SMALLINT     NOT NULL,
    access_level_id SMALLINT     NOT NULL,
    first_name      VARCHAR(60)  NOT NULL,
    last_name       VARCHAR(60)  NOT NULL,
    email           VARCHAR(120) NOT NULL,
    password_hash   VARCHAR(255),
    job_title       VARCHAR(80),
    hire_date       DATE         NOT NULL,
    is_active       BOOLEAN      NOT NULL DEFAULT true,
    last_login_at   TIMESTAMPTZ,
    CONSTRAINT pk_users PRIMARY KEY (id),
    CONSTRAINT uq_users_email UNIQUE (email),
    CONSTRAINT ck_users_email CHECK (email ~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$'),
    CONSTRAINT fk_users_area FOREIGN KEY (area_id) REFERENCES areas (id),
    CONSTRAINT fk_users_role FOREIGN KEY (role_id) REFERENCES roles (id),
    CONSTRAINT fk_users_access_level FOREIGN KEY (access_level_id) REFERENCES access_levels (id)
);

-- 4. Gestión documental
CREATE TABLE processes (
    id              INTEGER GENERATED ALWAYS AS IDENTITY,
    area_id         SMALLINT      NOT NULL,
    owner_id        UUID          NOT NULL,
    access_level_id SMALLINT      NOT NULL,
    code            VARCHAR(15)   NOT NULL,
    name            VARCHAR(120)  NOT NULL,
    objective       TEXT          NOT NULL,
    scope           TEXT,
    is_cross_area   BOOLEAN       NOT NULL DEFAULT false,
    status          record_status NOT NULL DEFAULT 'ACTIVE',
    created_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
    CONSTRAINT pk_processes PRIMARY KEY (id),
    CONSTRAINT uq_processes_code UNIQUE (code),
    CONSTRAINT fk_processes_area FOREIGN KEY (area_id) REFERENCES areas (id),
    CONSTRAINT fk_processes_owner FOREIGN KEY (owner_id) REFERENCES users (id),
    CONSTRAINT fk_processes_access_level FOREIGN KEY (access_level_id) REFERENCES access_levels (id)
);

CREATE TABLE process_visibility (
    process_id INTEGER     NOT NULL,
    area_id    SMALLINT    NOT NULL,
    granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT pk_process_visibility PRIMARY KEY (process_id, area_id),
    CONSTRAINT fk_process_visibility_process FOREIGN KEY (process_id) REFERENCES processes (id) ON DELETE CASCADE,
    CONSTRAINT fk_process_visibility_area FOREIGN KEY (area_id) REFERENCES areas (id)
);

CREATE TABLE process_relations (
    id                INTEGER GENERATED ALWAYS AS IDENTITY,
    source_process_id INTEGER       NOT NULL,
    target_process_id INTEGER       NOT NULL,
    relation_type     relation_type NOT NULL,
    description       VARCHAR(250),
    CONSTRAINT pk_process_relations PRIMARY KEY (id),
    CONSTRAINT uq_process_relations UNIQUE (source_process_id, target_process_id, relation_type),
    CONSTRAINT ck_process_relations_not_self CHECK (source_process_id <> target_process_id),
    CONSTRAINT fk_process_relations_source FOREIGN KEY (source_process_id) REFERENCES processes (id) ON DELETE CASCADE,
    CONSTRAINT fk_process_relations_target FOREIGN KEY (target_process_id) REFERENCES processes (id) ON DELETE CASCADE
);

CREATE TABLE procedures (
    id              INTEGER GENERATED ALWAYS AS IDENTITY,
    process_id      INTEGER       NOT NULL,
    access_level_id SMALLINT      NOT NULL,
    code            VARCHAR(20)   NOT NULL,
    title           VARCHAR(150)  NOT NULL,
    sort_order      SMALLINT      NOT NULL,
    status          record_status NOT NULL DEFAULT 'ACTIVE',
    created_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
    CONSTRAINT pk_procedures PRIMARY KEY (id),
    CONSTRAINT uq_procedures_code UNIQUE (code),
    CONSTRAINT ck_procedures_sort_order CHECK (sort_order > 0),
    CONSTRAINT fk_procedures_process FOREIGN KEY (process_id) REFERENCES processes (id),
    CONSTRAINT fk_procedures_access_level FOREIGN KEY (access_level_id) REFERENCES access_levels (id)
);

CREATE TABLE procedure_versions (
    id             INTEGER GENERATED ALWAYS AS IDENTITY,
    procedure_id   INTEGER        NOT NULL,
    author_id      UUID           NOT NULL,
    reviewer_id    UUID,
    version_number SMALLINT       NOT NULL,
    content        TEXT           NOT NULL,
    change_summary VARCHAR(300)   NOT NULL,
    status         version_status NOT NULL DEFAULT 'DRAFT',
    review_notes   VARCHAR(500),
    created_at     TIMESTAMPTZ    NOT NULL DEFAULT now(),
    published_at   TIMESTAMPTZ,
    CONSTRAINT pk_procedure_versions PRIMARY KEY (id),
    CONSTRAINT uq_procedure_versions_number UNIQUE (procedure_id, version_number),
    CONSTRAINT ck_procedure_versions_number CHECK (version_number > 0),
    CONSTRAINT ck_procedure_versions_rejected_notes CHECK (status <> 'REJECTED' OR review_notes IS NOT NULL),
    CONSTRAINT ck_procedure_versions_published_at CHECK (status <> 'PUBLISHED' OR published_at IS NOT NULL),
    CONSTRAINT fk_procedure_versions_procedure FOREIGN KEY (procedure_id) REFERENCES procedures (id),
    CONSTRAINT fk_procedure_versions_author FOREIGN KEY (author_id) REFERENCES users (id),
    CONSTRAINT fk_procedure_versions_reviewer FOREIGN KEY (reviewer_id) REFERENCES users (id)
);

-- 5. Onboarding
CREATE TABLE onboarding_routes (
    id          INTEGER GENERATED ALWAYS AS IDENTITY,
    area_id     SMALLINT,
    created_by  UUID         NOT NULL,
    name        VARCHAR(100) NOT NULL,
    description VARCHAR(300),
    is_active   BOOLEAN      NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT pk_onboarding_routes PRIMARY KEY (id),
    CONSTRAINT uq_onboarding_routes_name UNIQUE (name),
    CONSTRAINT fk_onboarding_routes_area FOREIGN KEY (area_id) REFERENCES areas (id),
    CONSTRAINT fk_onboarding_routes_creator FOREIGN KEY (created_by) REFERENCES users (id)
);

CREATE TABLE route_steps (
    route_id     INTEGER  NOT NULL,
    procedure_id INTEGER  NOT NULL,
    step_order   SMALLINT NOT NULL,
    is_required  BOOLEAN  NOT NULL DEFAULT true,
    CONSTRAINT pk_route_steps PRIMARY KEY (route_id, procedure_id),
    CONSTRAINT uq_route_steps_order UNIQUE (route_id, step_order),
    CONSTRAINT ck_route_steps_order CHECK (step_order > 0),
    CONSTRAINT fk_route_steps_route FOREIGN KEY (route_id) REFERENCES onboarding_routes (id) ON DELETE CASCADE,
    CONSTRAINT fk_route_steps_procedure FOREIGN KEY (procedure_id) REFERENCES procedures (id)
);

CREATE TABLE route_assignments (
    route_id    INTEGER NOT NULL,
    user_id     UUID    NOT NULL,
    assigned_at DATE    NOT NULL DEFAULT current_date,
    due_date    DATE,
    CONSTRAINT pk_route_assignments PRIMARY KEY (route_id, user_id),
    CONSTRAINT ck_route_assignments_due CHECK (due_date IS NULL OR due_date >= assigned_at),
    CONSTRAINT fk_route_assignments_route FOREIGN KEY (route_id) REFERENCES onboarding_routes (id),
    CONSTRAINT fk_route_assignments_user FOREIGN KEY (user_id) REFERENCES users (id)
);

CREATE TABLE read_confirmations (
    user_id      UUID        NOT NULL,
    version_id   INTEGER     NOT NULL,
    confirmed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT pk_read_confirmations PRIMARY KEY (user_id, version_id),
    CONSTRAINT fk_read_confirmations_user FOREIGN KEY (user_id) REFERENCES users (id),
    CONSTRAINT fk_read_confirmations_version FOREIGN KEY (version_id) REFERENCES procedure_versions (id)
);

-- 6. Auditoria
CREATE TABLE audit_logs (
    id         BIGINT GENERATED ALWAYS AS IDENTITY,
    user_id    UUID,
    action     VARCHAR(40) NOT NULL,
    entity     VARCHAR(40) NOT NULL,
    entity_id  VARCHAR(40),
    details    JSONB,
    ip_address INET,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT pk_audit_logs PRIMARY KEY (id),
    CONSTRAINT fk_audit_logs_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL
);

-- 7. Indices
CREATE INDEX ix_users_area              ON users (area_id);
CREATE INDEX ix_processes_area          ON processes (area_id);
CREATE INDEX ix_process_visibility_area ON process_visibility (area_id);
CREATE INDEX ix_process_relations_target ON process_relations (target_process_id);
CREATE INDEX ix_procedures_process      ON procedures (process_id, sort_order);
CREATE INDEX ix_versions_procedure_status ON procedure_versions (procedure_id, status, version_number DESC);
CREATE INDEX ix_route_steps_procedure   ON route_steps (procedure_id);
CREATE INDEX ix_route_assignments_user  ON route_assignments (user_id);
CREATE INDEX ix_read_confirmations_version ON read_confirmations (version_id);
CREATE INDEX ix_audit_logs_created_at   ON audit_logs (created_at DESC);
CREATE INDEX ix_audit_logs_user         ON audit_logs (user_id, created_at DESC);

-- Búsqueda de texto completo en español (RF-11)
CREATE INDEX ix_versions_content_fts ON procedure_versions USING GIN (to_tsvector('spanish', content));
CREATE INDEX ix_procedures_title_fts ON procedures USING GIN (to_tsvector('spanish', title));

-- Regla de negocio: a lo más una versión abierta (borrador o en revisión) por procedimiento
CREATE UNIQUE INDEX uq_versions_one_open ON procedure_versions (procedure_id)
    WHERE status IN ('DRAFT', 'IN_REVIEW');

-- 8. Funciones y triggers
-- 8.1 Mantiene updated_at en processes
CREATE FUNCTION fn_set_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_processes_updated_at
    BEFORE UPDATE ON processes
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- 8.2 Una version publicada es inmutable
CREATE FUNCTION fn_protect_published_version() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        IF OLD.status = 'PUBLISHED' THEN
            RAISE EXCEPTION 'La versión % está publicada y no puede eliminarse', OLD.id
                USING ERRCODE = 'check_violation';
        END IF;
        RETURN OLD;
    END IF;
    IF OLD.status = 'PUBLISHED' THEN
        RAISE EXCEPTION 'La versión % está publicada y es inmutable. Cree una nueva versión', OLD.id
            USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_versions_immutable
    BEFORE UPDATE OR DELETE ON procedure_versions
    FOR EACH ROW EXECUTE FUNCTION fn_protect_published_version();

-- 9. Vistas (valores derivados que no se almacenan, según 3FN). security_invoker hace
--    que la vista respete los permisos y RLS de quien consulta.
-- 9.1 Versión vigente: la última versión publicada de cada procedimiento
CREATE VIEW v_current_versions WITH (security_invoker = true) AS
SELECT DISTINCT ON (pv.procedure_id)
       pv.procedure_id,
       pv.id AS version_id,
       pv.version_number,
       pv.published_at
FROM procedure_versions pv
WHERE pv.status = 'PUBLISHED'
ORDER BY pv.procedure_id, pv.version_number DESC;

-- 9.2 Regla de visibilidad por área, rol y nivel (RF-10)
CREATE VIEW v_procedure_access WITH (security_invoker = true) AS
SELECT u.id  AS user_id,
       pr.id AS procedure_id
FROM users u
JOIN roles r          ON r.id  = u.role_id
JOIN access_levels ul ON ul.id = u.access_level_id
CROSS JOIN procedures pr
JOIN processes p          ON p.id  = pr.process_id
JOIN access_levels pl     ON pl.id = p.access_level_id
JOIN access_levels prl    ON prl.id = pr.access_level_id
WHERE u.is_active
  AND pr.status = 'ACTIVE'
  AND p.status  = 'ACTIVE'
  AND (
        r.name = 'ADMIN'
        OR (
             ul.level >= pl.level
         AND ul.level >= prl.level
         AND (    p.area_id = u.area_id
               OR p.is_cross_area
               OR EXISTS (SELECT 1 FROM process_visibility v
                          WHERE v.process_id = p.id AND v.area_id = u.area_id))
        )
      );

-- 9.3 Lecturas pendientes de reconfirmar (RF-16): el usuario tiene acceso, confirmó una
--     versión anterior o tiene el procedimiento en una ruta asignada, y no confirmó la vigente
CREATE VIEW v_pending_reconfirmations WITH (security_invoker = true) AS
SELECT a.user_id,
       cv.procedure_id,
       cv.version_id AS current_version_id,
       cv.version_number
FROM v_procedure_access a
JOIN v_current_versions cv ON cv.procedure_id = a.procedure_id
WHERE NOT EXISTS (SELECT 1 FROM read_confirmations rc
                  WHERE rc.user_id = a.user_id AND rc.version_id = cv.version_id)
  AND (
        EXISTS (SELECT 1 FROM read_confirmations rc
                JOIN procedure_versions old ON old.id = rc.version_id
                WHERE rc.user_id = a.user_id AND old.procedure_id = cv.procedure_id)
     OR EXISTS (SELECT 1 FROM route_assignments ra
                JOIN route_steps rs ON rs.route_id = ra.route_id
                WHERE ra.user_id = a.user_id AND rs.procedure_id = cv.procedure_id)
      );

-- 9.4 Avance de cada ruta asignada (RF-14): pasos obligatorios con la versión vigente confirmada
CREATE VIEW v_route_progress WITH (security_invoker = true) AS
SELECT ra.route_id,
       ra.user_id,
       ra.due_date,
       COUNT(*) FILTER (WHERE rs.is_required)                               AS required_steps,
       COUNT(*) FILTER (WHERE rs.is_required AND rc.version_id IS NOT NULL) AS completed_steps,
       ROUND(100.0 * COUNT(*) FILTER (WHERE rs.is_required AND rc.version_id IS NOT NULL)
             / NULLIF(COUNT(*) FILTER (WHERE rs.is_required), 0), 1)        AS progress_pct
FROM route_assignments ra
JOIN route_steps rs              ON rs.route_id = ra.route_id
LEFT JOIN v_current_versions cv  ON cv.procedure_id = rs.procedure_id
LEFT JOIN read_confirmations rc  ON rc.user_id = ra.user_id AND rc.version_id = cv.version_id
GROUP BY ra.route_id, ra.user_id, ra.due_date;

-- 10. Seguridad a nivel de fila: sin políticas, se bloquea el acceso directo de los
--     roles públicos de Supabase. Solo la API lee y escribe.
ALTER TABLE roles              ENABLE ROW LEVEL SECURITY;
ALTER TABLE access_levels      ENABLE ROW LEVEL SECURITY;
ALTER TABLE areas              ENABLE ROW LEVEL SECURITY;
ALTER TABLE users              ENABLE ROW LEVEL SECURITY;
ALTER TABLE processes          ENABLE ROW LEVEL SECURITY;
ALTER TABLE process_visibility ENABLE ROW LEVEL SECURITY;
ALTER TABLE process_relations  ENABLE ROW LEVEL SECURITY;
ALTER TABLE procedures         ENABLE ROW LEVEL SECURITY;
ALTER TABLE procedure_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE onboarding_routes  ENABLE ROW LEVEL SECURITY;
ALTER TABLE route_steps        ENABLE ROW LEVEL SECURITY;
ALTER TABLE route_assignments  ENABLE ROW LEVEL SECURITY;
ALTER TABLE read_confirmations ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs         ENABLE ROW LEVEL SECURITY;
