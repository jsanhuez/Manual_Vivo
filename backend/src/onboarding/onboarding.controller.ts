import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Put } from '@nestjs/common';
import { AuthUser } from '../common/auth-user';
import { ClientIp, CurrentUser, Roles } from '../common/decorators';
import { IdPipe } from '../common/pipes';
import { AssignRouteDto, RouteDto } from './dto/onboarding.dto';
import { OnboardingService } from './onboarding.service';

@Roles('EDITOR', 'ADMIN')
@Controller('routes')
export class RoutesController {
  constructor(private readonly onboarding: OnboardingService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.onboarding.listRoutes(user);
  }

  @Get('procedures')
  procedures(@CurrentUser() user: AuthUser) {
    return this.onboarding.procedureOptions(user);
  }

  @Get(':id')
  get(@Param('id', IdPipe) id: number, @CurrentUser() user: AuthUser) {
    return this.onboarding.getRoute(user, id);
  }

  @Post()
  create(@Body() dto: RouteDto, @CurrentUser() user: AuthUser, @ClientIp() ip: string | null) {
    return this.onboarding.createRoute(user, dto, ip);
  }

  @Put(':id')
  update(@Param('id', IdPipe) id: number, @Body() dto: RouteDto, @CurrentUser() user: AuthUser, @ClientIp() ip: string | null) {
    return this.onboarding.updateRoute(user, id, dto, ip);
  }

  @Post(':id/assign')
  @HttpCode(HttpStatus.OK)
  assign(@Param('id', IdPipe) id: number, @Body() dto: AssignRouteDto, @CurrentUser() user: AuthUser, @ClientIp() ip: string | null) {
    return this.onboarding.assign(user, id, dto, ip);
  }
}

@Controller()
export class OnboardingController {
  constructor(private readonly onboarding: OnboardingService) {}

  @Get('me/onboarding')
  mine(@CurrentUser() user: AuthUser) {
    return this.onboarding.myOnboarding(user);
  }

  @Post('versions/:id/confirm')
  @HttpCode(HttpStatus.OK)
  confirm(@Param('id', IdPipe) id: number, @CurrentUser() user: AuthUser, @ClientIp() ip: string | null) {
    return this.onboarding.confirmRead(user, id, ip);
  }
}
