import { Controller, Get } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { AuthUser } from '../auth/auth-user.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { jsonSchema } from '../common/json-schema.js';
import { publicUserResponseSchema } from './users.schemas.js';
import { UsersService } from './users.service.js';

@ApiTags('users')
@ApiBearerAuth()
@Controller()
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('me')
  @ApiOkResponse({
    description: 'The signed-in user',
    schema: jsonSchema(publicUserResponseSchema),
  })
  @ApiUnauthorizedResponse({
    description: 'Missing, invalid or expired access token',
  })
  me(@CurrentUser() user: AuthUser) {
    return this.users.findById(user.id);
  }
}
