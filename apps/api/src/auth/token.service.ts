import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { Env } from '../config/env.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { AccessTokenPayload } from './auth-user.js';
import type { TokenPair } from './auth.schemas.js';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Issues token pairs and rotates refresh tokens.
 *
 * - Access token: short-lived signed JWT, verified without touching the database.
 * - Refresh token: long-lived random string. Only its SHA-256 hash is stored
 *   (it has 256 bits of entropy, so a fast hash is enough; slow hashes like
 *   argon2 are for low-entropy secrets such as passwords).
 * - Rotation: every refresh revokes the token used and issues a new one in the
 *   same "family". If a revoked token is presented again, someone may have stolen
 *   it, so the whole family is revoked and the user has to sign in again.
 */
@Injectable()
export class TokenService {
  private readonly accessTtlSeconds: number;
  private readonly refreshTtlMs: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    config: ConfigService<Env, true>,
  ) {
    this.accessTtlSeconds = config.get('JWT_ACCESS_TTL_SECONDS', {
      infer: true,
    });
    this.refreshTtlMs =
      config.get('REFRESH_TOKEN_TTL_DAYS', { infer: true }) * DAY_MS;
  }

  /** Starts a new session (new refresh token family) for a user. */
  async issueTokenPair(userId: string): Promise<TokenPair> {
    const refreshToken = await this.createRefreshToken(userId, randomUUID());
    return this.buildPair(userId, refreshToken);
  }

  /** Exchanges a valid refresh token for a new token pair (rotation). */
  async rotate(refreshToken: string): Promise<TokenPair> {
    const existing = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: hashToken(refreshToken) },
    });
    if (!existing) throw invalidRefreshToken();

    if (existing.revokedAt) {
      await this.revokeFamily(existing.familyId);
      throw invalidRefreshToken();
    }
    if (existing.expiresAt <= new Date()) throw invalidRefreshToken();

    // Revoke the current token and create the next one atomically. The
    // `revokedAt: null` condition makes the revoke a compare-and-set: if two
    // requests use the same token at the same time, only one of them wins.
    const next = await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.refreshToken.updateMany({
        where: { id: existing.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      if (count === 0) return null;
      return this.createRefreshToken(existing.userId, existing.familyId, tx);
    });

    if (!next) {
      // Lost the race: the token was already used, treat it as reuse.
      await this.revokeFamily(existing.familyId);
      throw invalidRefreshToken();
    }
    return this.buildPair(existing.userId, next);
  }

  /** Signs out the session the refresh token belongs to. Unknown tokens are ignored. */
  async revoke(refreshToken: string): Promise<void> {
    const existing = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: hashToken(refreshToken) },
      select: { familyId: true },
    });
    if (existing) await this.revokeFamily(existing.familyId);
  }

  private async revokeFamily(familyId: string) {
    await this.prisma.refreshToken.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private async createRefreshToken(
    userId: string,
    familyId: string,
    db: Pick<PrismaService, 'refreshToken'> = this.prisma,
  ): Promise<string> {
    const token = randomBytes(32).toString('base64url');
    await db.refreshToken.create({
      data: {
        userId,
        familyId,
        tokenHash: hashToken(token),
        expiresAt: new Date(Date.now() + this.refreshTtlMs),
      },
    });
    return token;
  }

  private async buildPair(
    userId: string,
    refreshToken: string,
  ): Promise<TokenPair> {
    const payload: AccessTokenPayload = { sub: userId };
    const accessToken = await this.jwt.signAsync(payload, {
      expiresIn: this.accessTtlSeconds,
    });
    return {
      tokenType: 'Bearer',
      accessToken,
      expiresIn: this.accessTtlSeconds,
      refreshToken,
    };
  }
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function invalidRefreshToken() {
  return new UnauthorizedException('Invalid or expired refresh token');
}
