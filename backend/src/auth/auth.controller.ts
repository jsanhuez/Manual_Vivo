import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthUser } from '../common/auth-user';
import { ClientIp, CurrentUser, Public } from '../common/decorators';
import { AuthService } from './auth.service';
import { ForgotPasswordDto, LoginDto, ResetPasswordDto, TokenDto } from './dto/auth.dto';

// Límite por IP que complementa el bloqueo por cuenta del servicio
const AUTH_THROTTLE = { default: { limit: () => Number(process.env.AUTH_THROTTLE_LIMIT ?? 20), ttl: 60_000 } };

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Throttle(AUTH_THROTTLE)
  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: LoginDto, @ClientIp() ip: string | null) {
    return this.auth.login(dto, ip);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  logout(@CurrentUser() user: AuthUser, @ClientIp() ip: string | null) {
    return this.auth.logout(user, ip);
  }

  @Public()
  @Throttle(AUTH_THROTTLE)
  @Post('forgot-password')
  @HttpCode(HttpStatus.ACCEPTED)
  forgotPassword(@Body() dto: ForgotPasswordDto, @ClientIp() ip: string | null) {
    return this.auth.forgotPassword(dto.email, ip);
  }

  @Public()
  @Throttle(AUTH_THROTTLE)
  @Post('verify-token')
  @HttpCode(HttpStatus.OK)
  verifyToken(@Body() dto: TokenDto) {
    return this.auth.verifyAccountToken(dto.token);
  }

  @Public()
  @Throttle(AUTH_THROTTLE)
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  resetPassword(@Body() dto: ResetPasswordDto, @ClientIp() ip: string | null) {
    return this.auth.resetPassword(dto, ip);
  }
}
