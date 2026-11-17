const REQUIRED = [
  'DATABASE_URL',
  'JWT_SECRET',
  'FRONTEND_URL',
  'PORT',
  'THROTTLE_LIMIT',
  'AUTH_THROTTLE_LIMIT',
  'BREVO_API_URL',
  'MAIL_FROM_NAME',
];
const NUMERIC = ['PORT', 'THROTTLE_LIMIT', 'AUTH_THROTTLE_LIMIT'];

export function validateEnv(config: Record<string, unknown>): Record<string, unknown> {
  for (const key of REQUIRED) {
    if (!config[key]) {
      throw new Error(`Falta la variable de entorno ${key}`);
    }
  }
  for (const key of NUMERIC) {
    if (!Number.isInteger(Number(config[key])) || Number(config[key]) <= 0) {
      throw new Error(`La variable de entorno ${key} debe ser un número entero positivo`);
    }
  }
  if (String(config.JWT_SECRET).length < 32) {
    throw new Error('JWT_SECRET debe tener al menos 32 caracteres');
  }
  // Sin BREVO_API_KEY los correos quedan en el log
  if (config.BREVO_API_KEY && !config.MAIL_FROM) {
    throw new Error('Falta la variable de entorno MAIL_FROM, necesaria para enviar correos con Brevo');
  }
  return config;
}

export function allowedOrigins(frontendUrl: string): string[] {
  return frontendUrl
    .split(',')
    .map((origin) => origin.trim().replace(/\/$/, ''))
    .filter(Boolean);
}
