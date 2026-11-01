import { isIP } from 'node:net';
import type { Request } from 'express';

// req.ip ya considera X-Forwarded-For porque la aplicación confía en el proxy de Render
export function clientIp(request: Request): string | null {
  const ip = (request.ip ?? '').replace(/^::ffff:/, '');
  return isIP(ip) ? ip : null;
}
