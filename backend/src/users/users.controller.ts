import { Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, Post, Put, Query } from '@nestjs/common';
import { AuthUser } from '../common/auth-user';
import { ClientIp, CurrentUser, Roles } from '../common/decorators';
import { UuidPipe } from '../common/pipes';
import {
  ChangePasswordDto,
  CreateUserDto,
  ListUsersQueryDto,
  UpdateProfileDto,
  UpdateUserDto,
  UserOptionsQueryDto,
} from './dto/user.dto';
import { UsersService } from './users.service';

// Las rutas /me se declaran antes que /:id para que Express no las confunda
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return this.users.getProfile(user.id);
  }

  @Patch('me')
  updateMe(@CurrentUser() user: AuthUser, @Body() dto: UpdateProfileDto, @ClientIp() ip: string | null) {
    return this.users.updateProfile(user, dto, ip);
  }

  @Patch('me/password')
  @HttpCode(HttpStatus.NO_CONTENT)
  changePassword(@CurrentUser() user: AuthUser, @Body() dto: ChangePasswordDto, @ClientIp() ip: string | null) {
    return this.users.changePassword(user, dto, ip);
  }

  @Roles('EDITOR', 'ADMIN')
  @Get('options')
  options(@CurrentUser() user: AuthUser, @Query() query: UserOptionsQueryDto) {
    return this.users.options(user, query.areaId);
  }

  @Roles('ADMIN')
  @Get()
  list(@Query() query: ListUsersQueryDto) {
    return this.users.list(query);
  }

  @Roles('ADMIN')
  @Get(':id')
  get(@Param('id', UuidPipe) id: string) {
    return this.users.get(id);
  }

  @Roles('ADMIN')
  @Post()
  create(@Body() dto: CreateUserDto, @CurrentUser() actor: AuthUser, @ClientIp() ip: string | null) {
    return this.users.create(dto, actor, ip);
  }

  @Roles('ADMIN')
  @Put(':id')
  update(
    @Param('id', UuidPipe) id: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser() actor: AuthUser,
    @ClientIp() ip: string | null,
  ) {
    return this.users.update(id, dto, actor, ip);
  }

  @Roles('ADMIN')
  @Post(':id/invitation')
  @HttpCode(HttpStatus.ACCEPTED)
  resendInvitation(@Param('id', UuidPipe) id: string, @CurrentUser() actor: AuthUser, @ClientIp() ip: string | null) {
    return this.users.resendInvitation(id, actor, ip);
  }
}
