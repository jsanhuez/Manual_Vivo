-- Prueba de volumen de Manual Vivo (apoyo a RNF-04): carga 1.000 procedimientos, mide las consultas clave y deshace todo
-- Solo devuelve la tabla final, por eso funciona igual en psql y en el editor SQL de Supabase

CREATE OR REPLACE FUNCTION pg_temp.explain_json(p_sql text)
RETURNS json LANGUAGE plpgsql AS $$
DECLARE
    v_plan json;
BEGIN
    EXECUTE 'EXPLAIN (ANALYZE, FORMAT JSON) ' || p_sql INTO v_plan;
    RETURN v_plan;
END;
$$;

CREATE OR REPLACE FUNCTION pg_temp.measure(p_name text, p_sql text, p_runs int)
RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE
    v_plan  json;
    v_times numeric[] := '{}';
BEGIN
    FOR i IN 1..p_runs LOOP
        v_plan := pg_temp.explain_json(p_sql);
        v_times := v_times || (v_plan->0->>'Execution Time')::numeric;
    END LOOP;
    RETURN jsonb_build_object(
        'query', p_name,
        'rows', (v_plan->0->'Plan'->>'Actual Rows') || CASE WHEN v_plan->0->'Plan'->>'Actual Rows' = '1' THEN ' fila' ELSE ' filas' END,
        'min_ms', round((SELECT min(t) FROM unnest(v_times) t), 3),
        'max_ms', round((SELECT max(t) FROM unnest(v_times) t), 3),
        'gin', CASE WHEN v_plan::text LIKE '%ix_versions_content_fts%' THEN 'Sí' ELSE 'No' END);
END;
$$;

CREATE OR REPLACE FUNCTION pg_temp.volume_test()
RETURNS TABLE (n int, query text, rows text, min_ms numeric, max_ms numeric, gin_index text)
LANGUAGE plpgsql AS $$
#variable_conflict use_column
DECLARE
    r        jsonb := '[]'::jsonb;
    v_author uuid;
    v_user   uuid;
    v_search text;
BEGIN
    BEGIN
        INSERT INTO roles (name) VALUES ('COLLABORATOR'), ('EDITOR'), ('ADMIN') ON CONFLICT DO NOTHING;
        INSERT INTO access_levels (name, level) VALUES ('General', 1), ('Área', 2), ('Restringido', 3) ON CONFLICT DO NOTHING;
        INSERT INTO areas (name) VALUES ('Carga A'), ('Carga B'), ('Carga C');

        INSERT INTO users (area_id, role_id, access_level_id, first_name, last_name, email, hire_date)
        SELECT a.id, (SELECT x.id FROM roles x WHERE x.name = 'EDITOR'), (SELECT x.id FROM access_levels x WHERE x.level = 3),
               'Autor', 'Carga', 'autor.carga@empresa.test', current_date
        FROM areas a WHERE a.name = 'Carga A'
        RETURNING users.id INTO v_author;

        -- 50 colaboradores repartidos en tres áreas con niveles 1 y 2
        INSERT INTO users (area_id, role_id, access_level_id, first_name, last_name, email, hire_date)
        SELECT a.id, (SELECT x.id FROM roles x WHERE x.name = 'COLLABORATOR'), (SELECT x.id FROM access_levels x WHERE x.level = 1 + (g % 2)),
               'Usuario', 'Carga ' || g, 'carga' || g || '@empresa.test', current_date
        FROM generate_series(1, 50) g
        JOIN areas a ON a.name = (ARRAY['Carga A', 'Carga B', 'Carga C'])[1 + g % 3];

        INSERT INTO processes (area_id, owner_id, access_level_id, code, name, objective)
        SELECT a.id, v_author, (SELECT x.id FROM access_levels x WHERE x.level = 1), 'CARGA-P' || i, 'Proceso de carga ' || i, 'Carga'
        FROM (VALUES ('Carga A', 1), ('Carga B', 2), ('Carga C', 3)) AS p(area, i)
        JOIN areas a ON a.name = p.area;

        INSERT INTO procedures (process_id, access_level_id, code, title, sort_order)
        SELECT p.id, (SELECT x.id FROM access_levels x WHERE x.level = 1 + (g % 3)),
               'CARGA-' || lpad(g::text, 4, '0'), 'Procedimiento de carga ' || g, g
        FROM generate_series(1, 1000) g
        JOIN processes p ON p.code = 'CARGA-P' || (1 + g % 3);

        INSERT INTO procedure_versions (procedure_id, author_id, reviewer_id, version_number, content, change_summary, status, published_at)
        SELECT pr.id, v_author, v_author, v,
               'Paso ' || v || ' del procedimiento ' || pr.code || '. ' ||
               (ARRAY['Coordinar el retiro con el gestor y registrar la guía.',
                      'Emitir el estado de pago y enviarlo al cliente.',
                      'Registrar la ficha del cliente y sus sucursales.',
                      'Conciliar los pagos con la cartola bancaria.'])[1 + (pr.id % 4)],
               'Carga de volumen', 'PUBLISHED', now()
        FROM procedures pr
        CROSS JOIN generate_series(1, 2) v
        WHERE pr.code LIKE 'CARGA-%';

        ANALYZE users;
        ANALYZE procedures;
        ANALYZE procedure_versions;

        SELECT u.id INTO v_user FROM users u WHERE u.email = 'carga7@empresa.test';

        r := r || jsonb_build_object('query', 'Datos de la prueba',
            'rows', (SELECT count(*) FROM procedures) || ' procedimientos, ' || (SELECT count(*) FROM procedure_versions)
                    || ' versiones y ' || (SELECT count(*) FROM users) || ' usuarios');

        -- Es la misma consulta que usa la API en GET /api/search
        v_search := format($q$
            SELECT p.code, p.title
            FROM v_procedure_access a
            JOIN procedures p          ON p.id = a.procedure_id
            JOIN v_current_versions cv ON cv.procedure_id = p.id
            JOIN procedure_versions pv ON pv.id = cv.version_id
            CROSS JOIN websearch_to_tsquery('spanish', 'retiro') q
            WHERE a.user_id = %L
              AND (to_tsvector('spanish', pv.content) @@ q OR to_tsvector('spanish', p.title) @@ q)$q$, v_user);
        r := r || pg_temp.measure('Búsqueda de «retiro» filtrada por permisos (RF-11)', v_search, 7);

        r := r || pg_temp.measure('Base de conocimiento filtrada por permisos (RF-10)', format($q$
            SELECT p.code, p.title FROM v_procedure_access a
            JOIN procedures p ON p.id = a.procedure_id
            WHERE a.user_id = %L ORDER BY p.code$q$, v_user), 7);

        -- Con pocos datos el planificador puede preferir un recorrido secuencial, por eso se fuerza el uso de índices
        SET LOCAL enable_seqscan = off;
        r := r || pg_temp.measure('Texto completo forzando índices (disponibilidad del GIN)', $q$
            SELECT count(*) FROM procedure_versions
            WHERE to_tsvector('spanish', content) @@ websearch_to_tsquery('spanish', 'retiro')$q$, 7);

        RAISE EXCEPTION '__ROLLBACK__';
    EXCEPTION WHEN raise_exception THEN
        IF SQLERRM <> '__ROLLBACK__' THEN
            RAISE;
        END IF;
    END;

    RETURN QUERY
    SELECT t.ord::int, t.e->>'query', t.e->>'rows', (t.e->>'min_ms')::numeric, (t.e->>'max_ms')::numeric, t.e->>'gin'
    FROM jsonb_array_elements(r) WITH ORDINALITY AS t(e, ord)
    ORDER BY 1;
END;
$$;

SELECT n AS "N", query AS "Consulta", rows AS "Resultado", min_ms AS "Mínimo (ms)", max_ms AS "Máximo (ms)",
       gin_index AS "Usa índice GIN"
FROM pg_temp.volume_test();
