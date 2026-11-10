import { Controller, Get, Query } from '@nestjs/common';
import { Roles } from '../common/decorators';
import { AuditQueryDto } from './audit-query.dto';
import { AuditService } from './audit.service';

@Roles('ADMIN')
@Controller('audit')
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  list(@Query() query: AuditQueryDto) {
    return this.audit.list(query);
  }
}
