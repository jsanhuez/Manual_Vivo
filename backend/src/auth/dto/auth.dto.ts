import { IsEmail, IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator';
import { ToLowerCase } from '../../common/transforms';
import { PASSWORD_MESSAGE, PASSWORD_RULE } from '../password.policy';

export class LoginDto {
  @ToLowerCase()
  @IsEmail({}, { message: 'Ingresa un correo válido' })
  @MaxLength(120, { message: 'El correo admite hasta 120 caracteres' })
  email: string;

  @IsString({ message: 'Ingresa tu contraseña' })
  @IsNotEmpty({ message: 'Ingresa tu contraseña' })
  @MaxLength(72, { message: 'La contraseña admite hasta 72 caracteres' })
  password: string;
}

export class ForgotPasswordDto {
  @ToLowerCase()
  @IsEmail({}, { message: 'Ingresa un correo válido' })
  @MaxLength(120, { message: 'El correo admite hasta 120 caracteres' })
  email: string;
}

export class TokenDto {
  @IsString({ message: 'El enlace no es válido' })
  @IsNotEmpty({ message: 'El enlace no es válido' })
  @MaxLength(2048, { message: 'El enlace no es válido' })
  token: string;
}

export class ResetPasswordDto extends TokenDto {
  @IsString({ message: PASSWORD_MESSAGE })
  @Matches(PASSWORD_RULE, { message: PASSWORD_MESSAGE })
  password: string;
}
