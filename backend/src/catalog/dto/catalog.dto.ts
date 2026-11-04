import { IsBoolean, IsInt, IsOptional, IsString, Length, Max, MaxLength, Min } from 'class-validator';
import { Trim, TrimOrNull } from '../../common/transforms';

export class AreaDto {
  @Trim()
  @IsString({ message: 'Ingresa el nombre del área' })
  @Length(2, 60, { message: 'El nombre del área debe tener entre 2 y 60 caracteres' })
  name: string;

  @TrimOrNull()
  @IsOptional()
  @IsString({ message: 'La descripción no es válida' })
  @MaxLength(200, { message: 'La descripción admite hasta 200 caracteres' })
  description?: string | null;

  @IsOptional()
  @IsBoolean({ message: 'El estado no es válido' })
  isActive?: boolean;
}

export class AccessLevelDto {
  @Trim()
  @IsString({ message: 'Ingresa el nombre del nivel' })
  @Length(2, 40, { message: 'El nombre del nivel debe tener entre 2 y 40 caracteres' })
  name: string;

  @IsInt({ message: 'El valor del nivel debe ser un número entero' })
  @Min(1, { message: 'El valor del nivel debe estar entre 1 y 9' })
  @Max(9, { message: 'El valor del nivel debe estar entre 1 y 9' })
  level: number;

  @TrimOrNull()
  @IsOptional()
  @IsString({ message: 'La descripción no es válida' })
  @MaxLength(150, { message: 'La descripción admite hasta 150 caracteres' })
  description?: string | null;
}
