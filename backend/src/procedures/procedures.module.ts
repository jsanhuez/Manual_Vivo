import { Module } from '@nestjs/common';
import { ProcessesModule } from '../processes/processes.module';
import { ProceduresController, VersionsController } from './procedures.controller';
import { ProceduresService } from './procedures.service';
import { VersionsService } from './versions.service';

@Module({
  imports: [ProcessesModule],
  controllers: [ProceduresController, VersionsController],
  providers: [ProceduresService, VersionsService],
})
export class ProceduresModule {}
