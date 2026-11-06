import { Body, Controller, Get, Param, Patch, Post, Put, Query } from '@nestjs/common';
import { AuthUser } from '../common/auth-user';
import { ClientIp, CurrentUser, Roles } from '../common/decorators';
import { IdPipe } from '../common/pipes';
import { ListProcessesQueryDto, ProcessDto, StatusDto } from './dto/process.dto';
import { ProcessesService } from './processes.service';

@Controller('processes')
export class ProcessesController {
  constructor(private readonly processes: ProcessesService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query() query: ListProcessesQueryDto) {
    return this.processes.listVisible(user, query);
  }

  @Roles('EDITOR', 'ADMIN')
  @Get('manage')
  manage(@CurrentUser() user: AuthUser) {
    return this.processes.listManageable(user);
  }

  @Get(':id')
  get(@Param('id', IdPipe) id: number, @CurrentUser() user: AuthUser, @ClientIp() ip: string | null) {
    return this.processes.getVisible(user, id, ip);
  }

  @Roles('EDITOR', 'ADMIN')
  @Get(':id/edit')
  edit(@Param('id', IdPipe) id: number, @CurrentUser() user: AuthUser) {
    return this.processes.getForEdit(user, id);
  }

  @Roles('EDITOR', 'ADMIN')
  @Post()
  create(@Body() dto: ProcessDto, @CurrentUser() user: AuthUser, @ClientIp() ip: string | null) {
    return this.processes.create(user, dto, ip);
  }

  @Roles('EDITOR', 'ADMIN')
  @Put(':id')
  update(
    @Param('id', IdPipe) id: number,
    @Body() dto: ProcessDto,
    @CurrentUser() user: AuthUser,
    @ClientIp() ip: string | null,
  ) {
    return this.processes.update(user, id, dto, ip);
  }

  @Roles('EDITOR', 'ADMIN')
  @Patch(':id/status')
  setStatus(
    @Param('id', IdPipe) id: number,
    @Body() dto: StatusDto,
    @CurrentUser() user: AuthUser,
    @ClientIp() ip: string | null,
  ) {
    return this.processes.setStatus(user, id, dto, ip);
  }
}
