import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, Put } from '@nestjs/common';
import { AuthUser } from '../common/auth-user';
import { ClientIp, CurrentUser, Roles } from '../common/decorators';
import { IdPipe } from '../common/pipes';
import { CatalogService } from './catalog.service';
import { AccessLevelDto, AreaDto } from './dto/catalog.dto';

@Controller()
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get('roles')
  roles() {
    return this.catalog.listRoles();
  }

  @Get('areas')
  areas() {
    return this.catalog.listAreas();
  }

  @Roles('ADMIN')
  @Post('areas')
  createArea(@Body() dto: AreaDto, @CurrentUser() actor: AuthUser, @ClientIp() ip: string | null) {
    return this.catalog.createArea(dto, actor, ip);
  }

  @Roles('ADMIN')
  @Put('areas/:id')
  updateArea(
    @Param('id', IdPipe) id: number,
    @Body() dto: AreaDto,
    @CurrentUser() actor: AuthUser,
    @ClientIp() ip: string | null,
  ) {
    return this.catalog.updateArea(id, dto, actor, ip);
  }

  @Get('access-levels')
  accessLevels() {
    return this.catalog.listAccessLevels();
  }

  @Roles('ADMIN')
  @Post('access-levels')
  createAccessLevel(@Body() dto: AccessLevelDto, @CurrentUser() actor: AuthUser, @ClientIp() ip: string | null) {
    return this.catalog.createAccessLevel(dto, actor, ip);
  }

  @Roles('ADMIN')
  @Put('access-levels/:id')
  updateAccessLevel(
    @Param('id', IdPipe) id: number,
    @Body() dto: AccessLevelDto,
    @CurrentUser() actor: AuthUser,
    @ClientIp() ip: string | null,
  ) {
    return this.catalog.updateAccessLevel(id, dto, actor, ip);
  }

  @Roles('ADMIN')
  @Delete('access-levels/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteAccessLevel(@Param('id', IdPipe) id: number, @CurrentUser() actor: AuthUser, @ClientIp() ip: string | null) {
    return this.catalog.deleteAccessLevel(id, actor, ip);
  }
}
