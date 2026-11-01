import { BadRequestException, ParseIntPipe, ParseUUIDPipe } from '@nestjs/common';

export const IdPipe = new ParseIntPipe({
  exceptionFactory: () => new BadRequestException('El identificador no es válido'),
});

export const UuidPipe = new ParseUUIDPipe({
  exceptionFactory: () => new BadRequestException('El identificador no es válido'),
});
