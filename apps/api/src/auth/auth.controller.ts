import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ThrottlerGuard } from '@nestjs/throttler';
import { jsonSchema } from '../common/json-schema.js';
import {
  loginSchema,
  refreshTokenSchema,
  registerSchema,
  tokenPairSchema,
  type LoginDto,
  type RefreshTokenDto,
  type RegisterDto,
} from './auth.schemas.js';
import { AuthService } from './auth.service.js';
import { Public } from './public.decorator.js';

const tokenPairDocs = jsonSchema(tokenPairSchema);

@ApiTags('auth')
@ApiBadRequestResponse({ description: 'Invalid request body' })
@ApiTooManyRequestsResponse({
  description: 'Too many requests from this IP, try again later',
})
@Public()
@UseGuards(ThrottlerGuard)
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  @ApiCreatedResponse({
    description: 'Account created and signed in',
    schema: tokenPairDocs,
  })
  @ApiConflictResponse({ description: 'Email is already registered' })
  register(@Body({ schema: registerSchema }) dto: RegisterDto) {
    return this.auth.register(dto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ description: 'Signed in', schema: tokenPairDocs })
  @ApiUnauthorizedResponse({ description: 'Invalid email or password' })
  login(@Body({ schema: loginSchema }) dto: LoginDto) {
    return this.auth.login(dto);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({
    description: 'New token pair; the refresh token sent is revoked',
    schema: tokenPairDocs,
  })
  @ApiUnauthorizedResponse({
    description: 'Invalid, expired or already used refresh token',
  })
  refresh(@Body({ schema: refreshTokenSchema }) dto: RefreshTokenDto) {
    return this.auth.refresh(dto.refreshToken);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse({ description: 'Session revoked' })
  logout(@Body({ schema: refreshTokenSchema }) dto: RefreshTokenDto) {
    return this.auth.logout(dto.refreshToken);
  }
}
