import { Controller, Get } from '@nestjs/common';
import { AuthUser } from '../common/auth-user';
import { CurrentUser, Roles } from '../common/decorators';
import { TrackingService } from './tracking.service';

@Roles('EDITOR', 'ADMIN')
@Controller('tracking')
export class TrackingController {
  constructor(private readonly tracking: TrackingService) {}

  @Get('routes')
  routes(@CurrentUser() user: AuthUser) {
    return this.tracking.routes(user);
  }

  @Get('coverage')
  coverage(@CurrentUser() user: AuthUser) {
    return this.tracking.coverage(user);
  }
}
