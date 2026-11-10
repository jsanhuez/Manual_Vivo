import { IsInt, IsISO8601, IsOptional, IsUUID, Matches, Min } from 'class-validator';
import { ToInt } from '../common/transforms';

export class AuditQueryDto {
  @IsOptional()
  @IsUUID('all', { message: 'El usuario no es válido' })
  userId?: string;

  @IsOptional()
  @Matches(/^[A-Z_]{2,40}$/, { message: 'La acción no es válida' })
  action?: string;

  @IsOptional()
  @IsISO8601({ strict: true }, { message: 'La fecha desde no es válida' })
  from?: string;

  @IsOptional()
  @IsISO8601({ strict: true }, { message: 'La fecha hasta no es válida' })
  to?: string;

  @ToInt()
  @IsOptional()
  @IsInt({ message: 'La página no es válida' })
  @Min(1, { message: 'La página no es válida' })
  page?: number;
}
