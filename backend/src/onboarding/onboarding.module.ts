import { Module } from '@nestjs/common';
import { OnboardingController, RoutesController } from './onboarding.controller';
import { OnboardingService } from './onboarding.service';

@Module({
  controllers: [RoutesController, OnboardingController],
  providers: [OnboardingService],
  exports: [OnboardingService],
})
export class OnboardingModule {}
