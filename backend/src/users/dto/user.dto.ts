import {
  IsBoolean,
  IsDateString,
  IsEmail,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';
import { PASSWORD_MESSAGE, PASSWORD_RULE } from '../../auth/password.policy';
import { ToInt, ToLowerCase, Trim, TrimOrNull } from '../../common/transforms';

const DATE_FORMAT = /^\d{4}-\d{2}-\d{2}$/;

export class UpdateProfileDto {
  @Trim()
  @IsString({ message: 'Ingresa el nombre' })
  @Length(1, 60, { message: 'El nombre debe tener entre 1 y 60 caracteres' })
  firstName: string;

  @Trim()
  @IsString({ message: 'Ingresa el apellido' })
  @Length(1, 60, { message: 'El apellido debe tener entre 1 y 60 caracteres' })
  lastName: string;

  @TrimOrNull()
  @IsOptional()
  @IsString({ message: 'El cargo no es válido' })
  @MaxLength(80, { message: 'El cargo admite hasta 80 caracteres' })
  jobTitle?: string | null;
}

export class ChangePasswordDto {
  @IsString({ message: 'Ingresa tu contraseña actual' })
  @IsNotEmpty({ message: 'Ingresa tu contraseña actual' })
  @MaxLength(72, { message: 'La contraseña admite hasta 72 caracteres' })
  currentPassword: string;

  @IsString({ message: PASSWORD_MESSAGE })
  @Matches(PASSWORD_RULE, { message: PASSWORD_MESSAGE })
  newPassword: string;
}

export class CreateUserDto extends UpdateProfileDto {
  @ToLowerCase()
  @IsEmail({}, { message: 'Ingresa un correo válido' })
  @MaxLength(120, { message: 'El correo admite hasta 120 caracteres' })
  email: string;

  @Matches(DATE_FORMAT, { message: 'La fecha de ingreso debe tener el formato AAAA-MM-DD' })
  @IsDateString({ strict: true }, { message: 'La fecha de ingreso no es válida' })
  hireDate: string;

  @IsInt({ message: 'Selecciona un área' })
  @Min(1, { message: 'Selecciona un área' })
  areaId: number;

  @IsInt({ message: 'Selecciona un rol' })
  @Min(1, { message: 'Selecciona un rol' })
  roleId: number;

  @IsInt({ message: 'Selecciona un nivel de acceso' })
  @Min(1, { message: 'Selecciona un nivel de acceso' })
  accessLevelId: number;
}

export class UpdateUserDto extends CreateUserDto {
  @IsOptional()
  @IsBoolean({ message: 'El estado no es válido' })
  isActive?: boolean;
}

export class ListUsersQueryDto {
  @Trim()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @ToInt()
  @IsOptional()
  @IsInt({ message: 'El área no es válida' })
  areaId?: number;

  @ToInt()
  @IsOptional()
  @IsInt({ message: 'El rol no es válido' })
  roleId?: number;

  @IsOptional()
  @IsIn(['active', 'inactive', 'pending'], { message: 'El estado no es válido' })
  status?: 'active' | 'inactive' | 'pending';
}

export class UserOptionsQueryDto {
  @ToInt()
  @IsOptional()
  @IsInt({ message: 'El área no es válida' })
  areaId?: number;
}
