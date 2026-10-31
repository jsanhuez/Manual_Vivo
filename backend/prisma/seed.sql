-- Datos semilla de Manual Vivo hasta el Sprint 4: catálogos, tres áreas piloto, un usuario por perfil y contenido mínimo
-- Se ejecuta una sola vez sobre la base recién migrada
BEGIN;

INSERT INTO roles (name, description) VALUES
 ('COLLABORATOR', 'Consulta contenidos, realiza su ruta de onboarding y confirma lecturas'),
 ('EDITOR',       'Además, mantiene procesos, procedimientos y rutas de su área'),
 ('ADMIN',        'Además, publica versiones y administra usuarios, áreas, niveles y auditoría');

INSERT INTO access_levels (name, level, description) VALUES
 ('General',     1, 'Contenido visible para todo colaborador con acceso al proceso'),
 ('Área',        2, 'Contenido operativo de detalle para personas del área'),
 ('Restringido', 3, 'Información sensible, por ejemplo financiera o comercial');

INSERT INTO areas (name, description) VALUES
 ('Operaciones',               'Coordinación de retiros y trazabilidad con gestores'),
 ('Comercial',                 'Venta, propuestas y traspaso de clientes nuevos'),
 ('Administración y Finanzas', 'Estados de pago, facturación y cobranza');

-- Personas ficticias con la contraseña de prueba ManualVivo2026! (hash bcrypt de costo 10)
INSERT INTO users (area_id, role_id, access_level_id, first_name, last_name, email, password_hash, job_title, hire_date)
SELECT a.id, r.id, l.id, u.first_name, u.last_name, u.email,
       '$2a$10$eIRTzCLkmbREvPRxHaMkKumB.AO1lQf92J0mMgGc/tzEhX67OBmWu', u.job_title, u.hire_date::date
FROM (VALUES
 ('Administración y Finanzas', 'ADMIN',        'Restringido', 'Valentina', 'Soto',  'valentina.soto@recylink.test', 'Líder de procesos',       '2024-03-04'),
 ('Operaciones',               'EDITOR',       'Área',        'Diego',     'Muñoz', 'diego.munoz@recylink.test',    'Jefe de Operaciones',     '2023-08-01'),
 ('Operaciones',               'COLLABORATOR', 'General',     'Ignacia',   'Pérez', 'ignacia.perez@recylink.test',  'Analista de Operaciones', '2026-11-02')
) AS u(area, role, lvl, first_name, last_name, email, job_title, hire_date)
JOIN areas a         ON a.name = u.area
JOIN roles r         ON r.name = u.role
JOIN access_levels l ON l.name = u.lvl
ORDER BY u.email;

-- Las fechas acompañan a las de las versiones para que la consulta muestre actualizaciones coherentes
INSERT INTO processes (area_id, owner_id, access_level_id, code, name, objective, scope, is_cross_area, created_at, updated_at)
SELECT a.id, u.id, l.id, x.code, x.name, x.objective, x.scope, x.cross_area, x.created::timestamptz, x.created::timestamptz
FROM (VALUES
 ('OPE-P02', 'Coordinación de retiros con gestores del ecosistema', 'Operaciones', 'diego.munoz@recylink.test', 'General',
  'Programar y registrar los retiros de residuos con gestores autorizados.',
  'Desde la solicitud del cliente hasta el registro de trazabilidad del retiro.', false, '2026-10-28 08:30-03'),
 ('COM-P01', 'Traspaso de cliente nuevo a Operaciones', 'Comercial', 'valentina.soto@recylink.test', 'General',
  'Entregar a Operaciones toda la información necesaria para iniciar el servicio de un cliente nuevo.',
  'Desde la firma de la propuesta hasta la aceptación del traspaso por Operaciones.', false, '2026-10-27 10:30-03'),
 ('AYF-P01', 'Preparación mensual de estados de pago', 'Administración y Finanzas', 'valentina.soto@recylink.test', 'Restringido',
  'Calcular y emitir el estado de pago mensual de cada cliente.',
  'Desde el cierre de retiros del mes hasta el envío del estado de pago.', false, '2026-10-29 08:30-03'),
 ('GEN-P01', 'Uso de Manual Vivo', 'Administración y Finanzas', 'valentina.soto@recylink.test', 'General',
  'Explicar cómo consultar procedimientos y mantenerse al día con sus cambios.',
  'Aplica a todas las personas de Recylink.', true, '2026-10-27 08:30-03')
) AS x(code, name, area, owner, lvl, objective, scope, cross_area, created)
JOIN areas a         ON a.name = x.area
JOIN users u         ON u.email = x.owner
JOIN access_levels l ON l.name = x.lvl
ORDER BY x.code;

-- Operaciones recibe el traspaso, por eso consulta el proceso comercial
INSERT INTO process_visibility (process_id, area_id)
SELECT p.id, a.id
FROM processes p
JOIN areas a ON a.name = 'Operaciones'
WHERE p.code = 'COM-P01';

INSERT INTO procedures (process_id, access_level_id, code, title, sort_order, created_at)
SELECT p.id, l.id, x.code, x.title, x.ord, x.created::timestamptz
FROM (VALUES
 ('OPE-P02', 'OPE-P02-01', 'Programar un retiro con un gestor',  'General',     1, '2026-10-28 09:00-03'),
 ('OPE-P02', 'OPE-P02-02', 'Gestionar un retiro fallido',        'Área',        2, '2026-10-28 11:00-03'),
 ('COM-P01', 'COM-P01-01', 'Enviar el traspaso a Operaciones',   'General',     1, '2026-10-27 11:00-03'),
 ('AYF-P01', 'AYF-P01-01', 'Calcular el estado de pago mensual', 'Restringido', 1, '2026-10-29 09:00-03'),
 ('GEN-P01', 'GEN-P01-01', 'Cómo usar Manual Vivo',              'General',     1, '2026-10-27 09:00-03')
) AS x(proc, code, title, lvl, ord, created)
JOIN processes p     ON p.code = x.proc
JOIN access_levels l ON l.name = x.lvl
ORDER BY x.code;

-- OPE-P02-01 muestra el historial y OPE-P02-02 deja una versión en revisión para el Sprint 5
INSERT INTO procedure_versions (procedure_id, author_id, reviewer_id, version_number, content, change_summary, status, created_at, published_at)
SELECT pr.id, au.id, rv.id, x.num, x.content, x.summary, x.st::version_status, x.created::timestamptz, x.published::timestamptz
FROM (VALUES
 ('OPE-P02-01', 'diego.munoz@recylink.test', 'valentina.soto@recylink.test', 1,
  E'## Objetivo\nProgramar cada retiro solicitado con un gestor autorizado para el residuo.\n\n## Pasos\n1. Revisar la solicitud de retiro del cliente.\n2. Elegir un gestor autorizado para el residuo.\n3. Confirmar la fecha y la hora del retiro con el gestor.',
  'Versión inicial', 'PUBLISHED', '2026-10-28 09:00-03', '2026-10-29 10:00-03'),
 ('OPE-P02-01', 'diego.munoz@recylink.test', 'valentina.soto@recylink.test', 2,
  E'## Objetivo\nProgramar cada retiro solicitado con un gestor autorizado para el residuo.\n\n## Pasos\n1. Revisar la solicitud de retiro del cliente con al menos **72 horas hábiles** de anticipación.\n2. Elegir un gestor autorizado para el residuo y verificar que su resolución sanitaria esté vigente.\n3. Confirmar la fecha y la hora del retiro con el gestor.\n4. Avisar al cliente la ventana horaria del retiro.\n\n## Registros\n- Solicitud de retiro\n- Confirmación del gestor',
  'Se agrega la verificación de la resolución sanitaria y el aviso al cliente', 'PUBLISHED', '2026-11-06 16:00-03', '2026-11-07 12:00-03'),
 ('OPE-P02-02', 'diego.munoz@recylink.test', 'valentina.soto@recylink.test', 1,
  E'## Objetivo\nRecuperar un retiro que no se realizó en la fecha acordada.\n\n## Pasos\n1. Registrar la causa del retiro fallido.\n2. Reprogramar el retiro con el gestor.\n3. Avisar al cliente la nueva fecha.',
  'Versión inicial', 'PUBLISHED', '2026-10-28 11:00-03', '2026-10-29 10:20-03'),
 ('OPE-P02-02', 'diego.munoz@recylink.test', NULL, 2,
  E'## Objetivo\nRecuperar un retiro que no se realizó en la fecha acordada.\n\n## Pasos\n1. Registrar la causa del retiro fallido y adjuntar la evidencia del gestor.\n2. Reprogramar el retiro con el gestor dentro de 48 horas.\n3. Avisar al cliente la nueva fecha.',
  'Se exige evidencia del gestor y un plazo de reprogramación de 48 horas', 'IN_REVIEW', '2026-11-08 17:00-03', NULL),
 ('COM-P01-01', 'valentina.soto@recylink.test', 'valentina.soto@recylink.test', 1,
  E'## Objetivo\nEntregar a Operaciones un cliente nuevo listo para operar.\n\n## Pasos\n1. Verificar que la ficha del cliente tenga razón social, RUT y sucursales.\n2. Indicar los residuos y la frecuencia de retiro acordada en la propuesta.\n3. Crear la tarea de traspaso para Operaciones con el contacto de cada sucursal.',
  'Versión inicial', 'PUBLISHED', '2026-10-27 11:00-03', '2026-10-28 09:10-03'),
 ('AYF-P01-01', 'valentina.soto@recylink.test', 'valentina.soto@recylink.test', 1,
  E'## Objetivo\nValorizar los servicios del mes de cada cliente.\n\n## Pasos\n1. Consolidar los servicios del mes por cliente.\n2. Valorizarlos según la tarifa del contrato vigente.\n3. Revisar descuentos y emitir el estado de pago.',
  'Versión inicial', 'PUBLISHED', '2026-10-29 09:00-03', '2026-10-30 09:00-03'),
 ('GEN-P01-01', 'valentina.soto@recylink.test', 'valentina.soto@recylink.test', 1,
  E'## Objetivo\nConocer cómo encontrar la forma vigente de hacer el trabajo.\n\n## Pasos\n1. Busca un procedimiento por palabra clave o navega la base de conocimiento.\n2. Lee la versión vigente y revisa su historial de cambios.\n3. Si eres editor, guarda tus cambios como borrador y envíalos a revisión.',
  'Versión inicial', 'PUBLISHED', '2026-10-27 09:00-03', '2026-10-27 18:00-03')
) AS x(proc, author, reviewer, num, content, summary, st, created, published)
JOIN procedures pr ON pr.code = x.proc
JOIN users au      ON au.email = x.author
LEFT JOIN users rv ON rv.email = x.reviewer
ORDER BY x.proc, x.num;

COMMIT;
