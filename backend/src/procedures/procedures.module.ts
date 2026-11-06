import { Module } from '@nestjs/common';
import { ProceduresController, VersionsController } from './procedures.controller';
import { ProceduresService } from './procedures.service';
import { VersionsService } from './versions.service';

@Module({
  controllers: [ProceduresController, VersionsController],
  providers: [ProceduresService, VersionsService],
})
export class ProceduresModule {}
