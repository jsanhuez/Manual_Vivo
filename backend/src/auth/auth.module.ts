import { Module } from '@nestjs/common';
import { AccountTokenService } from './account-token.service';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

@Module({
  controllers: [AuthController],
  providers: [AuthService, AccountTokenService],
  exports: [AccountTokenService],
})
export class AuthModule {}
