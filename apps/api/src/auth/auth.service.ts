import { randomUUID } from 'node:crypto';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { hash, verify } from '@node-rs/argon2';
import { UsersService } from '../users/users.service.js';
import type { LoginDto, RegisterDto, TokenPair } from './auth.schemas.js';
import { TokenService } from './token.service.js';

@Injectable()
export class AuthService {
  /**
   * Hash of a random password, verified when the email doesn't exist so a failed
   * sign-in takes the same time either way (prevents guessing which emails exist).
   */
  private dummyHash?: Promise<string>;

  constructor(
    private readonly users: UsersService,
    private readonly tokens: TokenService,
  ) {}

  async register(dto: RegisterDto): Promise<TokenPair> {
    const user = await this.users.create({
      email: dto.email,
      name: dto.name,
      passwordHash: await hash(dto.password),
    });
    return this.tokens.issueTokenPair(user.id);
  }

  async login(dto: LoginDto): Promise<TokenPair> {
    const user = await this.users.findByEmailWithPassword(dto.email);
    const passwordHash = user?.passwordHash ?? (await this.getDummyHash());
    const valid = await verify(passwordHash, dto.password);

    // Same message whether the email or the password is wrong.
    if (!user || !valid)
      throw new UnauthorizedException('Invalid email or password');
    return this.tokens.issueTokenPair(user.id);
  }

  refresh(refreshToken: string): Promise<TokenPair> {
    return this.tokens.rotate(refreshToken);
  }

  logout(refreshToken: string): Promise<void> {
    return this.tokens.revoke(refreshToken);
  }

  private getDummyHash() {
    this.dummyHash ??= hash(randomUUID());
    return this.dummyHash;
  }
}
