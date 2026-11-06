import { Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, Post, Put, Query } from '@nestjs/common';
import { AuthUser } from '../common/auth-user';
import { ClientIp, CurrentUser, Roles } from '../common/decorators';
import { IdPipe } from '../common/pipes';
import { StatusDto } from '../processes/dto/process.dto';
import { CreateProcedureDto, ManageProceduresQueryDto, ProcedureMetaDto, VersionContentDto } from './dto/procedure.dto';
import { ProceduresService } from './procedures.service';
import { VersionsService } from './versions.service';

@Controller('procedures')
export class ProceduresController {
  constructor(
    private readonly procedures: ProceduresService,
    private readonly versions: VersionsService,
  ) {}

  @Roles('EDITOR', 'ADMIN')
  @Get('manage')
  manage(@CurrentUser() user: AuthUser, @Query() query: ManageProceduresQueryDto) {
    return this.procedures.listManageable(user, query);
  }

  @Get(':id')
  get(@Param('id', IdPipe) id: number, @CurrentUser() user: AuthUser, @ClientIp() ip: string | null) {
    return this.procedures.getVisible(user, id, ip);
  }

  @Get(':id/versions/:number')
  version(
    @Param('id', IdPipe) id: number,
    @Param('number', IdPipe) versionNumber: number,
    @CurrentUser() user: AuthUser,
    @ClientIp() ip: string | null,
  ) {
    return this.procedures.getVersion(user, id, versionNumber, ip);
  }

  @Roles('EDITOR', 'ADMIN')
  @Get(':id/edit')
  edit(@Param('id', IdPipe) id: number, @CurrentUser() user: AuthUser) {
    return this.procedures.getForEdit(user, id);
  }

  @Roles('EDITOR', 'ADMIN')
  @Post()
  create(@Body() dto: CreateProcedureDto, @CurrentUser() user: AuthUser, @ClientIp() ip: string | null) {
    return this.procedures.create(user, dto, ip);
  }

  @Roles('EDITOR', 'ADMIN')
  @Put(':id')
  update(
    @Param('id', IdPipe) id: number,
    @Body() dto: ProcedureMetaDto,
    @CurrentUser() user: AuthUser,
    @ClientIp() ip: string | null,
  ) {
    return this.procedures.updateMeta(user, id, dto, ip);
  }

  @Roles('EDITOR', 'ADMIN')
  @Patch(':id/status')
  setStatus(
    @Param('id', IdPipe) id: number,
    @Body() dto: StatusDto,
    @CurrentUser() user: AuthUser,
    @ClientIp() ip: string | null,
  ) {
    return this.procedures.setStatus(user, id, dto, ip);
  }

  @Roles('EDITOR', 'ADMIN')
  @Post(':id/versions')
  saveDraft(
    @Param('id', IdPipe) id: number,
    @Body() dto: VersionContentDto,
    @CurrentUser() user: AuthUser,
    @ClientIp() ip: string | null,
  ) {
    return this.versions.saveDraft(user, id, dto, ip);
  }
}

@Controller('versions')
export class VersionsController {
  constructor(private readonly versions: VersionsService) {}

  @Roles('EDITOR', 'ADMIN')
  @Post(':id/submit')
  @HttpCode(HttpStatus.OK)
  submit(@Param('id', IdPipe) id: number, @CurrentUser() user: AuthUser, @ClientIp() ip: string | null) {
    return this.versions.submit(user, id, ip);
  }
}
