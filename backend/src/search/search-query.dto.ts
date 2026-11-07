import { IsInt, IsOptional, IsString, Length } from 'class-validator';
import { ToInt, Trim } from '../common/transforms';

export class SearchQueryDto {
  @Trim()
  @IsString({ message: 'Ingresa un texto para buscar' })
  @Length(2, 100, { message: 'La búsqueda debe tener entre 2 y 100 caracteres' })
  q: string;

  @ToInt()
  @IsOptional()
  @IsInt({ message: 'El área no es válida' })
  areaId?: number;

  @ToInt()
  @IsOptional()
  @IsInt({ message: 'El proceso no es válido' })
  processId?: number;
}
