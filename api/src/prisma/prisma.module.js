import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

/**
 * Global so every feature module can @Inject(PrismaService) without
 * re-importing PrismaModule everywhere — PostgreSQL is the single source
 * of truth per the architecture doc, so nearly every module needs it.
 */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
