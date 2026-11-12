import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { OnboardingModule } from '../onboarding/onboarding.module';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [AuthModule, OnboardingModule],
  controllers: [UsersController],
  providers: [UsersService],
})
export class UsersModule {}
