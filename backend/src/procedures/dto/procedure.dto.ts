import { IsInt, IsNotEmpty, IsOptional, IsString, Length, Matches, Max, MaxLength, Min } from 'class-validator';
import { ToInt, ToUpperCase, Trim } from '../../common/transforms';
import { CODE_MESSAGE, CODE_RULE } from '../../processes/dto/process.dto';

export class ProcedureMetaDto {
  @ToUpperCase()
  @IsString({ message: 'Ingresa el código' })
  @Length(3, 20, { message: 'El código debe tener entre 3 y 20 caracteres' })
  @Matches(CODE_RULE, { message: CODE_MESSAGE })
  code: string;

  @Trim()
  @IsString({ message: 'Ingresa el título' })
  @Length(3, 150, { message: 'El título debe tener entre 3 y 150 caracteres' })
  title: string;

  @IsInt({ message: 'El orden debe ser un número entero' })
  @Min(1, { message: 'El orden debe ser mayor que 0' })
  @Max(32767, { message: 'El orden no es válido' })
  sortOrder: number;

  @IsInt({ message: 'Selecciona el nivel de acceso' })
  @Min(1, { message: 'Selecciona el nivel de acceso' })
  accessLevelId: number;
}

export class VersionContentDto {
  @IsString({ message: 'Ingresa el contenido' })
  @IsNotEmpty({ message: 'El contenido no puede estar vacío' })
  @MaxLength(100000, { message: 'El contenido admite hasta 100.000 caracteres' })
  content: string;

  @Trim()
  @IsString({ message: 'Ingresa el resumen de cambios' })
  @Length(5, 300, { message: 'El resumen de cambios debe tener entre 5 y 300 caracteres' })
  changeSummary: string;
}

export class CreateProcedureDto extends ProcedureMetaDto {
  @IsInt({ message: 'Selecciona el proceso' })
  @Min(1, { message: 'Selecciona el proceso' })
  processId: number;

  @IsString({ message: 'Ingresa el contenido' })
  @IsNotEmpty({ message: 'El contenido no puede estar vacío' })
  @MaxLength(100000, { message: 'El contenido admite hasta 100.000 caracteres' })
  content: string;

  @Trim()
  @IsString({ message: 'Ingresa el resumen de cambios' })
  @Length(5, 300, { message: 'El resumen de cambios debe tener entre 5 y 300 caracteres' })
  changeSummary: string;
}

export class ManageProceduresQueryDto {
  @ToInt()
  @IsOptional()
  @IsInt({ message: 'El proceso no es válido' })
  processId?: number;
}
