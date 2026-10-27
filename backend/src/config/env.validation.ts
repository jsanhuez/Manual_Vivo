const REQUIRED = ['DATABASE_URL', 'JWT_SECRET', 'FRONTEND_URL'];

export function validateEnv(config: Record<string, unknown>): Record<string, unknown> {
  for (const key of REQUIRED) {
    if (!config[key]) {
      throw new Error(`Falta la variable de entorno ${key}`);
    }
  }
  if (String(config.JWT_SECRET).length < 32) {
    throw new Error('JWT_SECRET debe tener al menos 32 caracteres');
  }
  return config;
}

export function allowedOrigins(frontendUrl: string): string[] {
  return frontendUrl
    .split(',')
    .map((origin) => origin.trim().replace(/\/$/, ''))
    .filter(Boolean);
}
