-- Verificación de la base de Manual Vivo: crea datos propios, ejecuta 25 pruebas y deshace todos los cambios
-- Solo devuelve la tabla final, por eso funciona igual en psql y en el editor SQL de Supabase

CREATE OR REPLACE FUNCTION pg_temp.expect_error(p_id text, p_req text, p_desc text, p_sql text, p_state text)
RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE
    v_state text;
    v_msg   text;
BEGIN
    BEGIN
        EXECUTE p_sql;
        -- Si la sentencia no falla se fuerza un error para deshacerla igual
        RAISE EXCEPTION '__NO_ERROR__';
    EXCEPTION WHEN OTHERS THEN
        GET STACKED DIAGNOSTICS v_state = RETURNED_SQLSTATE, v_msg = MESSAGE_TEXT;
    END;
    RETURN jsonb_build_object(
        'id', p_id, 'req', p_req, 'description', p_desc,
        'expected', 'Rechazo ' || p_state,
        'obtained', CASE WHEN v_msg = '__NO_ERROR__' THEN 'Aceptada' ELSE 'Rechazo ' || v_state END,
        'result', CASE WHEN v_msg <> '__NO_ERROR__' AND v_state = p_state THEN 'APROBADO' ELSE 'FALLIDO' END);
END;
$$;

CREATE OR REPLACE FUNCTION pg_temp.expect_value(p_id text, p_req text, p_desc text, p_sql text, p_expected text)
RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE
    v_value text;
BEGIN
    EXECUTE p_sql INTO v_value;
    RETURN jsonb_build_object(
        'id', p_id, 'req', p_req, 'description', p_desc,
        'expected', p_expected, 'obtained', coalesce(v_value, 'NULL'),
        'result', CASE WHEN v_value IS NOT DISTINCT FROM p_expected THEN 'APROBADO' ELSE 'FALLIDO' END);
END;
$$;

CREATE OR REPLACE FUNCTION pg_temp.verify_database()
RETURNS TABLE (n int, id text, req text, description text, expected text, obtained text, result text)
LANGUAGE plpgsql AS $$
#variable_conflict use_column
DECLARE
    r       jsonb := '[]'::jsonb;
    v_col   smallint;
    v_edi   smallint;
    v_lvl1  smallint;
    v_lvl2  smallint;
    v_a     smallint;
    v_b     smallint;
    v_ucol  uuid;
    v_uedi  uuid;
    v_p1    int;
    v_p2    int;
    v_p3    int;
    v_route int;
BEGIN
    -- Las variables conservan los resultados aunque el bloque interno se deshaga al final
    BEGIN
        INSERT INTO roles (name) VALUES ('COLLABORATOR'), ('EDITOR'), ('ADMIN') ON CONFLICT DO NOTHING;
        INSERT INTO access_levels (name, level) VALUES ('General', 1), ('Área', 2), ('Restringido', 3) ON CONFLICT DO NOTHING;
        SELECT id INTO v_col FROM roles WHERE name = 'COLLABORATOR';
        SELECT id INTO v_edi FROM roles WHERE name = 'EDITOR';
        SELECT id INTO v_lvl1 FROM access_levels WHERE level = 1;
        SELECT id INTO v_lvl2 FROM access_levels WHERE level = 2;

        INSERT INTO areas (name) VALUES ('Área de prueba A') RETURNING areas.id INTO v_a;
        INSERT INTO areas (name) VALUES ('Área de prueba B') RETURNING areas.id INTO v_b;

        INSERT INTO users (area_id, role_id, access_level_id, first_name, last_name, email, hire_date)
        VALUES (v_a, v_col, v_lvl1, 'Colaborador', 'Prueba', 'colaborador.prueba@empresa.test', current_date)
        RETURNING users.id INTO v_ucol;
        INSERT INTO users (area_id, role_id, access_level_id, first_name, last_name, email, hire_date)
        VALUES (v_a, v_edi, v_lvl2, 'Editor', 'Prueba', 'editor.prueba@empresa.test', current_date)
        RETURNING users.id INTO v_uedi;

        -- TST-P01 es del área A, TST-P02 de otra área y TST-P03 es transversal
        INSERT INTO processes (area_id, owner_id, access_level_id, code, name, objective)
        VALUES (v_a, v_uedi, v_lvl1, 'TST-P01', 'Proceso de prueba A', 'Prueba') RETURNING processes.id INTO v_p1;
        INSERT INTO processes (area_id, owner_id, access_level_id, code, name, objective)
        VALUES (v_b, v_uedi, v_lvl1, 'TST-P02', 'Proceso de prueba B', 'Prueba') RETURNING processes.id INTO v_p2;
        INSERT INTO processes (area_id, owner_id, access_level_id, code, name, objective, is_cross_area)
        VALUES (v_b, v_uedi, v_lvl1, 'TST-P03', 'Proceso transversal de prueba', 'Prueba', true) RETURNING processes.id INTO v_p3;

        INSERT INTO procedures (process_id, access_level_id, code, title, sort_order) VALUES
            (v_p1, v_lvl1, 'TST-P01-01', 'Programar un retiro de prueba', 1),
            (v_p1, v_lvl2, 'TST-P01-02', 'Retiro fallido de prueba', 2),
            (v_p2, v_lvl1, 'TST-P02-01', 'Retiro de otra área', 1),
            (v_p3, v_lvl1, 'TST-P03-01', 'Uso de la plataforma', 1);

        INSERT INTO procedure_versions (procedure_id, author_id, version_number, content, change_summary, status, published_at)
        SELECT p.id, v_uedi, x.num, x.content, 'Prueba', x.st::version_status, x.published
        FROM (VALUES
            ('TST-P01-01', 1, 'Coordinar el retiro con el gestor',               'PUBLISHED', now() - interval '2 days'),
            ('TST-P01-01', 2, 'Coordinar el retiro con el gestor y avisar',      'PUBLISHED', now() - interval '1 day'),
            ('TST-P01-02', 1, 'Registrar la causa del retiro fallido',           'PUBLISHED', now() - interval '2 days'),
            ('TST-P01-02', 2, 'Registrar la causa del retiro fallido con fotos', 'IN_REVIEW', NULL),
            ('TST-P02-01', 1, 'Retiro coordinado por otra área',                 'PUBLISHED', now() - interval '2 days'),
            ('TST-P03-01', 1, 'Buscar y leer procedimientos vigentes',           'PUBLISHED', now() - interval '2 days')
        ) AS x(code, num, content, st, published)
        JOIN procedures p ON p.code = x.code;

        INSERT INTO process_relations (source_process_id, target_process_id, relation_type)
        VALUES (v_p1, v_p2, 'INFORMATION_HANDOFF');

        INSERT INTO onboarding_routes (area_id, created_by, name) VALUES (v_a, v_uedi, 'Ruta de prueba')
        RETURNING onboarding_routes.id INTO v_route;
        INSERT INTO route_steps (route_id, procedure_id, step_order)
        SELECT v_route, p.id, x.ord FROM (VALUES ('TST-P03-01', 1), ('TST-P01-01', 2)) AS x(code, ord)
        JOIN procedures p ON p.code = x.code;
        INSERT INTO route_assignments (route_id, user_id, due_date) VALUES (v_route, v_ucol, current_date + 14);

        -- Ambos usuarios leyeron la versión 1 de TST-P01-01 antes de que se publicara la versión 2
        INSERT INTO read_confirmations (user_id, version_id)
        SELECT x.uid, v.id FROM (VALUES (v_ucol, 'TST-P03-01', 1), (v_ucol, 'TST-P01-01', 1), (v_uedi, 'TST-P01-01', 1)) AS x(uid, code, num)
        JOIN procedures p ON p.code = x.code
        JOIN procedure_versions v ON v.procedure_id = p.id AND v.version_number = x.num;

        r := r || pg_temp.expect_value('V01', 'OE3', 'Tablas creadas en el esquema public',
            $q$SELECT count(*)::text FROM information_schema.tables WHERE table_schema = 'public'
               AND table_type = 'BASE TABLE' AND table_name <> '_prisma_migrations'$q$, '14');
        r := r || pg_temp.expect_value('V02', 'RNF-03', 'Tablas con seguridad a nivel de fila (RLS)',
            $q$SELECT count(*)::text FROM pg_class c JOIN pg_namespace s ON s.oid = c.relnamespace
               WHERE s.nspname = 'public' AND c.relkind = 'r' AND c.relrowsecurity$q$, '14');

        r := r || pg_temp.expect_error('V03', 'RF-04 / CP-06', 'Crear usuario con correo ya registrado',
            $q$INSERT INTO users (area_id, role_id, access_level_id, first_name, last_name, email, hire_date)
               SELECT area_id, role_id, access_level_id, 'Copia', 'Duplicada', email, current_date
               FROM users WHERE email = 'colaborador.prueba@empresa.test'$q$, '23505');
        r := r || pg_temp.expect_error('V04', 'RF-04', 'Crear usuario con correo de formato inválido',
            $q$INSERT INTO users (area_id, role_id, access_level_id, first_name, last_name, email, hire_date)
               SELECT area_id, role_id, access_level_id, 'Correo', 'Malo', 'correo-sin-arroba', current_date
               FROM users WHERE email = 'colaborador.prueba@empresa.test'$q$, '23514');
        r := r || pg_temp.expect_error('V05', 'RF-05', 'Crear rol fuera del dominio permitido',
            $q$INSERT INTO roles (name) VALUES ('SUPERUSER')$q$, '23514');
        r := r || pg_temp.expect_error('V06', 'RF-05', 'Crear nivel de acceso fuera del rango 1 a 9',
            $q$INSERT INTO access_levels (name, level) VALUES ('Secreto', 10)$q$, '23514');
        r := r || pg_temp.expect_error('V07', 'RF-07 / CP-09', 'Crear procedimiento con código duplicado',
            $q$INSERT INTO procedures (process_id, access_level_id, code, title, sort_order)
               SELECT process_id, access_level_id, code, 'Duplicado', 9 FROM procedures WHERE code = 'TST-P01-01'$q$, '23505');

        r := r || pg_temp.expect_error('V08', 'RF-04', 'Crear usuario en un área inexistente',
            $q$INSERT INTO users (area_id, role_id, access_level_id, first_name, last_name, email, hire_date)
               SELECT -1, role_id, access_level_id, 'Sin', 'Área', 'sin.area@empresa.test', current_date
               FROM users WHERE email = 'colaborador.prueba@empresa.test'$q$, '23503');
        r := r || pg_temp.expect_error('V09', 'RF-05 / CP-07', 'Eliminar un área que tiene usuarios',
            $q$DELETE FROM areas WHERE name = 'Área de prueba A'$q$, '23503');

        r := r || pg_temp.expect_error('V10', 'RF-08', 'Repetir el número de versión de un procedimiento',
            $q$INSERT INTO procedure_versions (procedure_id, author_id, version_number, content, change_summary)
               SELECT procedure_id, author_id, 1, 'x', 'x' FROM procedure_versions v
               JOIN procedures p ON p.id = v.procedure_id WHERE p.code = 'TST-P03-01'$q$, '23505');
        r := r || pg_temp.expect_error('V11', 'RF-09 / CP-11', 'Rechazar una versión sin observación',
            $q$INSERT INTO procedure_versions (procedure_id, author_id, version_number, content, change_summary, status)
               SELECT procedure_id, author_id, 9, 'x', 'x', 'REJECTED' FROM procedure_versions v
               JOIN procedures p ON p.id = v.procedure_id WHERE p.code = 'TST-P03-01'$q$, '23514');
        r := r || pg_temp.expect_error('V12', 'RF-09', 'Publicar una versión sin fecha de publicación',
            $q$INSERT INTO procedure_versions (procedure_id, author_id, version_number, content, change_summary, status)
               SELECT procedure_id, author_id, 9, 'x', 'x', 'PUBLISHED' FROM procedure_versions v
               JOIN procedures p ON p.id = v.procedure_id WHERE p.code = 'TST-P03-01'$q$, '23514');
        r := r || pg_temp.expect_error('V13', 'RNF-10 / CP-12', 'Editar el contenido de una versión publicada',
            $q$UPDATE procedure_versions SET content = 'cambio directo'
               WHERE procedure_id = (SELECT id FROM procedures WHERE code = 'TST-P01-01') AND version_number = 2$q$, '23514');
        r := r || pg_temp.expect_error('V14', 'RNF-10', 'Eliminar una versión publicada',
            $q$DELETE FROM procedure_versions
               WHERE procedure_id = (SELECT id FROM procedures WHERE code = 'TST-P01-01') AND version_number = 1$q$, '23514');
        r := r || pg_temp.expect_error('V15', 'RF-08 / CU-11', 'Abrir un borrador con otra versión en revisión',
            $q$INSERT INTO procedure_versions (procedure_id, author_id, version_number, content, change_summary)
               SELECT procedure_id, author_id, 3, 'x', 'otro borrador' FROM procedure_versions v
               JOIN procedures p ON p.id = v.procedure_id WHERE p.code = 'TST-P01-02' AND v.version_number = 2$q$, '23505');

        r := r || pg_temp.expect_error('V16', 'RF-12 / CP-16', 'Relacionar un proceso consigo mismo',
            $q$INSERT INTO process_relations (source_process_id, target_process_id, relation_type)
               SELECT id, id, 'TRIGGERS' FROM processes WHERE code = 'TST-P01'$q$, '23514');
        r := r || pg_temp.expect_error('V17', 'RF-12', 'Repetir una relación del mismo tipo entre dos procesos',
            $q$INSERT INTO process_relations (source_process_id, target_process_id, relation_type)
               SELECT s.id, t.id, 'INFORMATION_HANDOFF' FROM processes s, processes t
               WHERE s.code = 'TST-P01' AND t.code = 'TST-P02'$q$, '23505');
        r := r || pg_temp.expect_error('V18', 'RF-13 / CP-17', 'Asignar una ruta con fecha límite anterior a la asignación',
            $q$INSERT INTO route_assignments (route_id, user_id, assigned_at, due_date)
               SELECT r.id, u.id, DATE '2026-11-10', DATE '2026-11-01' FROM onboarding_routes r, users u
               WHERE r.name = 'Ruta de prueba' AND u.email = 'editor.prueba@empresa.test'$q$, '23514');
        r := r || pg_temp.expect_error('V19', 'RF-13', 'Repetir la posición de un paso dentro de la ruta',
            $q$INSERT INTO route_steps (route_id, procedure_id, step_order)
               SELECT r.id, p.id, 1 FROM onboarding_routes r, procedures p
               WHERE r.name = 'Ruta de prueba' AND p.code = 'TST-P01-02'$q$, '23505');
        r := r || pg_temp.expect_error('V20', 'RF-15', 'Confirmar dos veces la misma versión',
            $q$INSERT INTO read_confirmations (user_id, version_id)
               SELECT rc.user_id, rc.version_id FROM read_confirmations rc
               JOIN users u ON u.id = rc.user_id WHERE u.email = 'colaborador.prueba@empresa.test' LIMIT 1$q$, '23505');

        r := r || pg_temp.expect_value('V21', 'RF-10 / CP-13', 'Colaborador no ve contenido de nivel superior ni de otra área',
            $q$SELECT count(*)::text FROM v_procedure_access a
               JOIN users u ON u.id = a.user_id JOIN procedures p ON p.id = a.procedure_id
               WHERE u.email = 'colaborador.prueba@empresa.test' AND p.code IN ('TST-P01-02', 'TST-P02-01')$q$, '0');
        r := r || pg_temp.expect_value('V22', 'RF-10 / CP-14', 'Proceso transversal visible para todos los usuarios activos',
            $q$SELECT (count(*) = (SELECT count(*) FROM users WHERE is_active))::text FROM v_procedure_access a
               JOIN procedures p ON p.id = a.procedure_id WHERE p.code = 'TST-P03-01'$q$, 'true');
        r := r || pg_temp.expect_value('V23', 'RF-11 / CP-15', 'Búsqueda de «retiro» solo entrega procedimientos visibles',
            $q$SELECT string_agg(p.code, ', ' ORDER BY p.code) FROM v_current_versions cv
               JOIN procedure_versions pv ON pv.id = cv.version_id
               JOIN procedures p ON p.id = cv.procedure_id
               JOIN v_procedure_access a ON a.procedure_id = p.id
               JOIN users u ON u.id = a.user_id
               WHERE u.email = 'colaborador.prueba@empresa.test' AND p.code LIKE 'TST-%'
                 AND to_tsvector('spanish', pv.content) @@ websearch_to_tsquery('spanish', 'retiro')$q$, 'TST-P01-01');
        r := r || pg_temp.expect_value('V24', 'RF-16 / CP-19', 'Pendientes de reconfirmar TST-P01-01 tras publicar la versión 2',
            $q$SELECT string_agg(split_part(u.email, '@', 1), ', ' ORDER BY u.email) FROM v_pending_reconfirmations x
               JOIN users u ON u.id = x.user_id JOIN procedures p ON p.id = x.procedure_id
               WHERE p.code = 'TST-P01-01'$q$, 'colaborador.prueba, editor.prueba');
        r := r || pg_temp.expect_value('V25', 'RF-14 / CP-18', 'Avance de la ruta tras el cambio de versión (1 de 2 pasos)',
            $q$SELECT progress_pct::text FROM v_route_progress x JOIN users u ON u.id = x.user_id
               WHERE u.email = 'colaborador.prueba@empresa.test'$q$, '50.0');

        RAISE EXCEPTION '__ROLLBACK__';
    EXCEPTION WHEN raise_exception THEN
        IF SQLERRM <> '__ROLLBACK__' THEN
            RAISE;
        END IF;
    END;

    RETURN QUERY
    SELECT t.ord::int, t.e->>'id', t.e->>'req', t.e->>'description', t.e->>'expected', t.e->>'obtained', t.e->>'result'
    FROM jsonb_array_elements(r) WITH ORDINALITY AS t(e, ord)
    UNION ALL
    SELECT jsonb_array_length(r) + 1, 'Total', '', 'Pruebas aprobadas', jsonb_array_length(r)::text,
           count(*) FILTER (WHERE x->>'result' = 'APROBADO')::text,
           CASE WHEN bool_and(x->>'result' = 'APROBADO') THEN 'APROBADO' ELSE 'FALLIDO' END
    FROM jsonb_array_elements(r) AS x
    ORDER BY 1;
END;
$$;

SELECT n AS "N", id AS "ID", req AS "Req.", description AS "Prueba", expected AS "Esperado",
       obtained AS "Obtenido", result AS "Resultado"
FROM pg_temp.verify_database();
