import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { Trim, TrimOrNull } from '../../common/transforms';
import { DATE_FORMAT } from '../../users/dto/user.dto';

export class RouteStepDto {
  @IsInt({ message: 'Selecciona el procedimiento del paso' })
  @Min(1, { message: 'Selecciona el procedimiento del paso' })
  procedureId: number;

  @IsBoolean({ message: 'Indica si el paso es obligatorio' })
  isRequired: boolean;
}

export class RouteDto {
  @Trim()
  @IsString({ message: 'Ingresa el nombre de la ruta' })
  @Length(3, 100, { message: 'El nombre debe tener entre 3 y 100 caracteres' })
  name: string;

  @TrimOrNull()
  @IsOptional()
  @IsString({ message: 'La descripción no es válida' })
  @MaxLength(300, { message: 'La descripción admite hasta 300 caracteres' })
  description?: string | null;

  // null indica una ruta transversal
  @ValidateIf((dto: RouteDto) => dto.areaId !== null)
  @IsInt({ message: 'Selecciona el área de la ruta' })
  @Min(1, { message: 'Selecciona el área de la ruta' })
  areaId: number | null;

  @IsBoolean({ message: 'Indica si la ruta está activa' })
  isActive: boolean;

  @IsArray({ message: 'Los pasos no son válidos' })
  @ArrayMinSize(1, { message: 'Agrega al menos un procedimiento a la ruta' })
  @ArrayMaxSize(50, { message: 'Una ruta admite hasta 50 pasos' })
  @ValidateNested({ each: true })
  @Type(() => RouteStepDto)
  steps: RouteStepDto[];
}

export class AssignRouteDto {
  @IsUUID('all', { message: 'Selecciona a la persona' })
  userId: string;

  @ValidateIf((dto: AssignRouteDto) => dto.dueDate != null)
  @Matches(DATE_FORMAT, { message: 'La fecha límite debe tener el formato AAAA-MM-DD' })
  @IsDateString({ strict: true }, { message: 'La fecha límite no es válida' })
  dueDate?: string | null;
}
