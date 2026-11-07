import { Controller, Get, Query } from '@nestjs/common';
import { AuthUser } from '../common/auth-user';
import { CurrentUser } from '../common/decorators';
import { SearchQueryDto } from './search-query.dto';
import { SearchService } from './search.service';

@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  search(@CurrentUser() user: AuthUser, @Query() query: SearchQueryDto) {
    return this.searchService.search(user, query);
  }
}
