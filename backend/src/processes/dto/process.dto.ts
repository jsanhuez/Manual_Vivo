import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { ToBoolean, ToInt, ToUpperCase, Trim, TrimOrNull } from '../../common/transforms';

export const CODE_RULE = /^[A-Z0-9]+(-[A-Z0-9]+)*$/;
export const CODE_MESSAGE = 'El código solo admite mayúsculas, números y guiones, por ejemplo OPE-P02';
export const RELATION_TYPES = ['INFORMATION_HANDOFF', 'TRIGGERS', 'DEPENDS_ON'] as const;

export class ProcessRelationDto {
  @IsInt({ message: 'Selecciona el proceso relacionado' })
  @Min(1, { message: 'Selecciona el proceso relacionado' })
  targetProcessId: number;

  @IsIn(RELATION_TYPES, { message: 'El tipo de relación no es válido' })
  relationType: (typeof RELATION_TYPES)[number];

  @TrimOrNull()
  @IsOptional()
  @IsString({ message: 'La descripción de la relación no es válida' })
  @MaxLength(250, { message: 'La descripción de la relación admite hasta 250 caracteres' })
  description?: string | null;
}

export class ProcessDto {
  @ToUpperCase()
  @IsString({ message: 'Ingresa el código' })
  @Length(3, 15, { message: 'El código debe tener entre 3 y 15 caracteres' })
  @Matches(CODE_RULE, { message: CODE_MESSAGE })
  code: string;

  @Trim()
  @IsString({ message: 'Ingresa el nombre del proceso' })
  @Length(3, 120, { message: 'El nombre debe tener entre 3 y 120 caracteres' })
  name: string;

  @Trim()
  @IsString({ message: 'Ingresa el objetivo' })
  @Length(3, 2000, { message: 'El objetivo debe tener entre 3 y 2.000 caracteres' })
  objective: string;

  @TrimOrNull()
  @IsOptional()
  @IsString({ message: 'El alcance no es válido' })
  @MaxLength(2000, { message: 'El alcance admite hasta 2.000 caracteres' })
  scope?: string | null;

  @IsInt({ message: 'Selecciona el área dueña' })
  @Min(1, { message: 'Selecciona el área dueña' })
  areaId: number;

  @IsUUID('all', { message: 'Selecciona el responsable' })
  ownerId: string;

  @IsInt({ message: 'Selecciona el nivel de acceso' })
  @Min(1, { message: 'Selecciona el nivel de acceso' })
  accessLevelId: number;

  @IsBoolean({ message: 'Indica si el proceso es transversal' })
  isCrossArea: boolean;

  @IsArray({ message: 'Las áreas adicionales no son válidas' })
  @ArrayMaxSize(50, { message: 'Las áreas adicionales no son válidas' })
  @IsInt({ each: true, message: 'Las áreas adicionales no son válidas' })
  visibleAreaIds: number[];

  @IsOptional()
  @IsArray({ message: 'Las relaciones no son válidas' })
  @ArrayMaxSize(20, { message: 'Un proceso admite hasta 20 relaciones' })
  @ValidateNested({ each: true })
  @Type(() => ProcessRelationDto)
  relations?: ProcessRelationDto[];
}

export class StatusDto {
  @IsIn(['ACTIVE', 'ARCHIVED'], { message: 'El estado debe ser ACTIVE o ARCHIVED' })
  status: 'ACTIVE' | 'ARCHIVED';
}

export class ListProcessesQueryDto {
  @ToInt()
  @IsOptional()
  @IsInt({ message: 'El área no es válida' })
  areaId?: number;

  @ToBoolean()
  @IsOptional()
  @IsBoolean({ message: 'El filtro de transversales no es válido' })
  crossArea?: boolean;
}
