import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Response } from 'express';

type PrismaError = Prisma.PrismaClientKnownRequestError | Prisma.PrismaClientUnknownRequestError;

const UNIQUE_MESSAGES: Record<string, string> = {
  email: 'El correo ya está registrado',
  code: 'El código ya está en uso',
  name: 'El nombre ya está en uso',
  level: 'Ya existe un nivel de acceso con ese valor',
  procedure_id: 'El procedimiento ya tiene una versión en borrador o en revisión',
};

export function mapPrismaError(error: PrismaError): { status: number; message: string } {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') {
      const target = (error.meta?.target as string[] | undefined) ?? [];
      const field = target.find((name) => UNIQUE_MESSAGES[name]);
      return { status: HttpStatus.CONFLICT, message: field ? UNIQUE_MESSAGES[field] : 'Ya existe un registro con esos datos' };
    }
    if (error.code === 'P2003') {
      return { status: HttpStatus.UNPROCESSABLE_ENTITY, message: 'El registro está relacionado con datos inexistentes o en uso' };
    }
    if (error.code === 'P2025') {
      return { status: HttpStatus.NOT_FOUND, message: 'El registro solicitado no existe' };
    }
  }
  // Prisma no clasifica los CHECK ni los errores de triggers, por eso se lee el SQLSTATE del mensaje
  const sqlState = /code: "(\w{5})"/.exec(error.message)?.[1];
  const dbMessage = /message: "([^"]+)"/.exec(error.message)?.[1];
  if (sqlState === '23505') {
    return { status: HttpStatus.CONFLICT, message: 'Ya existe un registro con esos datos' };
  }
  if (sqlState === '23503') {
    return { status: HttpStatus.UNPROCESSABLE_ENTITY, message: 'El registro está relacionado con datos inexistentes o en uso' };
  }
  if (sqlState === '23514') {
    const custom = dbMessage && !dbMessage.startsWith('new row') ? dbMessage : undefined;
    return {
      status: HttpStatus.UNPROCESSABLE_ENTITY,
      message: custom ?? 'Los datos no cumplen una regla de integridad de la base de datos',
    };
  }
  return { status: HttpStatus.INTERNAL_SERVER_ERROR, message: 'Ocurrió un error inesperado' };
}

@Catch(Prisma.PrismaClientKnownRequestError, Prisma.PrismaClientUnknownRequestError)
export class PrismaExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(PrismaExceptionFilter.name);

  catch(exception: PrismaError, host: ArgumentsHost): void {
    const { status, message } = mapPrismaError(exception);
    if (status === HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(exception.message);
    }
    host.switchToHttp().getResponse<Response>().status(status).json({ statusCode: status, message });
  }
}
