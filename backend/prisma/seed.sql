-- Datos semilla de Manual Vivo: catálogos, tres áreas piloto, un usuario por perfil y contenido mínimo de cada funcionalidad
-- Se puede ejecutar de nuevo sobre una base con datos, solo agrega lo que falta
BEGIN;

INSERT INTO roles (name, description) VALUES
 ('COLLABORATOR', 'Consulta contenidos, realiza su ruta de onboarding y confirma lecturas'),
 ('EDITOR',       'Además, mantiene procesos, procedimientos y rutas de su área'),
 ('ADMIN',        'Además, publica versiones y administra usuarios, áreas, niveles y auditoría')
ON CONFLICT DO NOTHING;

INSERT INTO access_levels (name, level, description) VALUES
 ('General',     1, 'Contenido visible para todo colaborador con acceso al proceso'),
 ('Área',        2, 'Contenido operativo de detalle para personas del área'),
 ('Restringido', 3, 'Información sensible, por ejemplo financiera o comercial')
ON CONFLICT DO NOTHING;

INSERT INTO areas (name, description) VALUES
 ('Operaciones',               'Coordinación de retiros y trazabilidad con gestores'),
 ('Comercial',                 'Venta, propuestas y traspaso de clientes nuevos'),
 ('Administración y Finanzas', 'Estados de pago, facturación y cobranza')
ON CONFLICT DO NOTHING;

-- Personas ficticias con la contraseña de prueba ManualVivo2026! (hash bcrypt de costo 10)
INSERT INTO users (area_id, role_id, access_level_id, first_name, last_name, email, password_hash, job_title, hire_date)
SELECT a.id, r.id, l.id, u.first_name, u.last_name, u.email,
       '$2a$10$eIRTzCLkmbREvPRxHaMkKumB.AO1lQf92J0mMgGc/tzEhX67OBmWu', u.job_title, u.hire_date::date
FROM (VALUES
 ('Administración y Finanzas', 'ADMIN',        'Restringido', 'Valentina', 'Soto',  'valentina.soto@empresa.test', 'Líder de procesos',       '2024-03-04'),
 ('Operaciones',               'EDITOR',       'Área',        'Diego',     'Muñoz', 'diego.munoz@empresa.test',    'Jefe de Operaciones',     '2023-08-01'),
 ('Operaciones',               'COLLABORATOR', 'General',     'Ignacia',   'Pérez', 'ignacia.perez@empresa.test',  'Analista de Operaciones', '2026-11-02')
) AS u(area, role, lvl, first_name, last_name, email, job_title, hire_date)
JOIN areas a         ON a.name = u.area
JOIN roles r         ON r.name = u.role
JOIN access_levels l ON l.name = u.lvl
ORDER BY u.email
ON CONFLICT DO NOTHING;

-- Las fechas acompañan a las de las versiones para que la consulta muestre actualizaciones coherentes
INSERT INTO processes (area_id, owner_id, access_level_id, code, name, objective, scope, is_cross_area, created_at, updated_at)
SELECT a.id, u.id, l.id, x.code, x.name, x.objective, x.scope, x.cross_area, x.created::timestamptz, x.created::timestamptz
FROM (VALUES
 ('OPE-P02', 'Coordinación de retiros con gestores del ecosistema', 'Operaciones', 'diego.munoz@empresa.test', 'General',
  'Programar y registrar los retiros de residuos con gestores autorizados.',
  'Desde la solicitud del cliente hasta el registro de trazabilidad del retiro.', false, '2026-10-28 08:30-03'),
 ('COM-P01', 'Traspaso de cliente nuevo a Operaciones', 'Comercial', 'valentina.soto@empresa.test', 'General',
  'Entregar a Operaciones toda la información necesaria para iniciar el servicio de un cliente nuevo.',
  'Desde la firma de la propuesta hasta la aceptación del traspaso por Operaciones.', false, '2026-10-27 10:30-03'),
 ('AYF-P01', 'Preparación mensual de estados de pago', 'Administración y Finanzas', 'valentina.soto@empresa.test', 'Restringido',
  'Calcular y emitir el estado de pago mensual de cada cliente.',
  'Desde el cierre de retiros del mes hasta el envío del estado de pago.', false, '2026-10-29 08:30-03'),
 ('GEN-P01', 'Uso de Manual Vivo', 'Administración y Finanzas', 'valentina.soto@empresa.test', 'General',
  'Explicar cómo consultar procedimientos y mantenerse al día con sus cambios.',
  'Aplica a todas las personas de Recylink.', true, '2026-10-27 08:30-03')
) AS x(code, name, area, owner, lvl, objective, scope, cross_area, created)
JOIN areas a         ON a.name = x.area
JOIN users u         ON u.email = x.owner
JOIN access_levels l ON l.name = x.lvl
ORDER BY x.code
ON CONFLICT DO NOTHING;

-- Operaciones recibe el traspaso, por eso consulta el proceso comercial
INSERT INTO process_visibility (process_id, area_id)
SELECT p.id, a.id
FROM processes p
JOIN areas a ON a.name = 'Operaciones'
WHERE p.code = 'COM-P01'
ON CONFLICT DO NOTHING;

-- Traspasos de información que forman el mapa de procesos
INSERT INTO process_relations (source_process_id, target_process_id, relation_type, description)
SELECT s.id, t.id, 'INFORMATION_HANDOFF', x.description
FROM (VALUES
 ('COM-P01', 'OPE-P02', 'Cliente nuevo listo para operar'),
 ('OPE-P02', 'AYF-P01', 'Retiros realizados en el mes')
) AS x(source, target, description)
JOIN processes s ON s.code = x.source
JOIN processes t ON t.code = x.target
ON CONFLICT DO NOTHING;

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
ORDER BY x.code
ON CONFLICT DO NOTHING;

-- OPE-P02-01 muestra el historial, OPE-P02-02 deja una versión en revisión y GEN-P01-01 v2 es el manual de usuario
INSERT INTO procedure_versions (procedure_id, author_id, reviewer_id, version_number, content, change_summary, status, created_at, published_at)
SELECT pr.id, au.id, rv.id, x.num, x.content, x.summary, x.st::version_status, x.created::timestamptz, x.published::timestamptz
FROM (VALUES
 ('OPE-P02-01', 'diego.munoz@empresa.test', 'valentina.soto@empresa.test', 1,
  E'## Objetivo\nProgramar cada retiro solicitado con un gestor autorizado para el residuo.\n\n## Pasos\n1. Revisar la solicitud de retiro del cliente.\n2. Elegir un gestor autorizado para el residuo.\n3. Confirmar la fecha y la hora del retiro con el gestor.',
  'Versión inicial', 'PUBLISHED', '2026-10-28 09:00-03', '2026-10-29 10:00-03'),
 ('OPE-P02-01', 'diego.munoz@empresa.test', 'valentina.soto@empresa.test', 2,
  E'## Objetivo\nProgramar cada retiro solicitado con un gestor autorizado para el residuo.\n\n## Pasos\n1. Revisar la solicitud de retiro del cliente con al menos **72 horas hábiles** de anticipación.\n2. Elegir un gestor autorizado para el residuo y verificar que su resolución sanitaria esté vigente.\n3. Confirmar la fecha y la hora del retiro con el gestor.\n4. Avisar al cliente la ventana horaria del retiro.\n\n## Registros\n- Solicitud de retiro\n- Confirmación del gestor',
  'Se agrega la verificación de la resolución sanitaria y el aviso al cliente', 'PUBLISHED', '2026-11-06 16:00-03', '2026-11-07 12:00-03'),
 ('OPE-P02-02', 'diego.munoz@empresa.test', 'valentina.soto@empresa.test', 1,
  E'## Objetivo\nRecuperar un retiro que no se realizó en la fecha acordada.\n\n## Pasos\n1. Registrar la causa del retiro fallido.\n2. Reprogramar el retiro con el gestor.\n3. Avisar al cliente la nueva fecha.',
  'Versión inicial', 'PUBLISHED', '2026-10-28 11:00-03', '2026-10-29 10:20-03'),
 ('OPE-P02-02', 'diego.munoz@empresa.test', NULL, 2,
  E'## Objetivo\nRecuperar un retiro que no se realizó en la fecha acordada.\n\n## Pasos\n1. Registrar la causa del retiro fallido y adjuntar la evidencia del gestor.\n2. Reprogramar el retiro con el gestor dentro de 48 horas.\n3. Avisar al cliente la nueva fecha.',
  'Se exige evidencia del gestor y un plazo de reprogramación de 48 horas', 'IN_REVIEW', '2026-11-08 17:00-03', NULL),
 ('COM-P01-01', 'valentina.soto@empresa.test', 'valentina.soto@empresa.test', 1,
  E'## Objetivo\nEntregar a Operaciones un cliente nuevo listo para operar.\n\n## Pasos\n1. Verificar que la ficha del cliente tenga razón social, RUT y sucursales.\n2. Indicar los residuos y la frecuencia de retiro acordada en la propuesta.\n3. Crear la tarea de traspaso para Operaciones con el contacto de cada sucursal.',
  'Versión inicial', 'PUBLISHED', '2026-10-27 11:00-03', '2026-10-28 09:10-03'),
 ('AYF-P01-01', 'valentina.soto@empresa.test', 'valentina.soto@empresa.test', 1,
  E'## Objetivo\nValorizar los servicios del mes de cada cliente.\n\n## Pasos\n1. Consolidar los servicios del mes por cliente.\n2. Valorizarlos según la tarifa del contrato vigente.\n3. Revisar descuentos y emitir el estado de pago.',
  'Versión inicial', 'PUBLISHED', '2026-10-29 09:00-03', '2026-10-30 09:00-03'),
 ('GEN-P01-01', 'valentina.soto@empresa.test', 'valentina.soto@empresa.test', 1,
  E'## Objetivo\nConocer cómo encontrar la forma vigente de hacer el trabajo.\n\n## Pasos\n1. Busca un procedimiento por palabra clave o navega la base de conocimiento.\n2. Lee la versión vigente y revisa su historial de cambios.\n3. Si eres editor, guarda tus cambios como borrador y envíalos a revisión.',
  'Versión inicial', 'PUBLISHED', '2026-10-27 09:00-03', '2026-10-27 18:00-03'),
 ('GEN-P01-01', 'valentina.soto@empresa.test', 'valentina.soto@empresa.test', 2,
  E'## Objetivo\nConocer cómo encontrar la forma vigente de hacer el trabajo y mantenerse al día con sus cambios.\n\n## Todas las personas\n1. **Inicio** muestra tus lecturas pendientes, tu avance de onboarding y las últimas actualizaciones.\n2. **Base de conocimiento**, **Buscar** y **Mapa de procesos** muestran solo lo habilitado para tu área, rol y nivel.\n3. En cada procedimiento lee la versión vigente y presiona **Confirmar lectura**. Si cambia, recibirás un aviso para volver a confirmarla.\n4. **Mi onboarding** muestra los pasos de tu ruta y tu avance.\n\n## Editores\n1. En **Procesos** y **Procedimientos** registra el contenido de tu área. Cada cambio queda como borrador hasta que lo envías a revisión.\n2. En **Rutas de onboarding** arma la secuencia de lectura y asígnala con una fecha límite.\n3. En **Seguimiento** revisa el avance de las rutas y la cobertura de lectura, y exporta los datos a CSV.\n\n## Administradores\n1. En **Revisiones** aprueba y publica o rechaza con una observación las versiones enviadas.\n2. En **Usuarios** y **Áreas y niveles** administra las cuentas y los permisos.\n3. En **Auditoría** consulta las acciones registradas.',
  'Se agrega el manual de uso por perfil', 'PUBLISHED', '2026-11-16 10:00-03', '2026-11-16 12:00-03')
) AS x(proc, author, reviewer, num, content, summary, st, created, published)
JOIN procedures pr ON pr.code = x.proc
JOIN users au      ON au.email = x.author
LEFT JOIN users rv ON rv.email = x.reviewer
ORDER BY x.proc, x.num
ON CONFLICT DO NOTHING;

INSERT INTO onboarding_routes (area_id, created_by, name, description, created_at)
SELECT a.id, u.id, 'Onboarding Operaciones', 'Lecturas iniciales para quienes ingresan al área de Operaciones', '2026-11-02 09:00-03'
FROM areas a
JOIN users u ON u.email = 'diego.munoz@empresa.test'
WHERE a.name = 'Operaciones'
ON CONFLICT DO NOTHING;

INSERT INTO route_steps (route_id, procedure_id, step_order, is_required)
SELECT r.id, pr.id, x.ord, true
FROM (VALUES ('GEN-P01-01', 1), ('COM-P01-01', 2), ('OPE-P02-01', 3)) AS x(code, ord)
JOIN procedures pr       ON pr.code = x.code
JOIN onboarding_routes r ON r.name = 'Onboarding Operaciones'
ON CONFLICT DO NOTHING;

INSERT INTO route_assignments (route_id, user_id, assigned_at, due_date)
SELECT r.id, u.id, '2026-11-02', '2026-11-30'
FROM onboarding_routes r
JOIN users u ON u.email = 'ignacia.perez@empresa.test'
WHERE r.name = 'Onboarding Operaciones'
ON CONFLICT DO NOTHING;

-- Ignacia leyó OPE-P02-01 v1 antes de la v2, por eso debe reconfirmarlo
INSERT INTO read_confirmations (user_id, version_id, confirmed_at)
SELECT u.id, pv.id, x.confirmed::timestamptz
FROM (VALUES
 ('ignacia.perez@empresa.test', 'GEN-P01-01', 2, '2026-11-17 09:30-03'),
 ('ignacia.perez@empresa.test', 'OPE-P02-01', 1, '2026-11-04 10:00-03'),
 ('diego.munoz@empresa.test',   'OPE-P02-01', 2, '2026-11-08 08:45-03')
) AS x(email, code, num, confirmed)
JOIN users u               ON u.email = x.email
JOIN procedures pr         ON pr.code = x.code
JOIN procedure_versions pv ON pv.procedure_id = pr.id AND pv.version_number = x.num
ON CONFLICT DO NOTHING;

COMMIT;
