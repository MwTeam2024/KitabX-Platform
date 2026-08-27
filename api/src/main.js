import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  const config = app.get(ConfigService);
  const prefix = config.get('API_PREFIX') || 'api/v1';
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

  app.setGlobalPrefix(prefix);
  app.use(cookieParser());
  app.enableCors({
    origin: frontendUrl,
    credentials: true,
    // §44: lets the browser skip a repeat preflight for the same
    // endpoint+method within this window — meaningful here since the app
    // hits the same ~15 endpoints again on every safety-net poll tick and
    // every client-side route change (e.g. the notification bell refetching
    // on each navigation), not just once at load.
    maxAge: 600,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
    }),
  );

  const port = process.env.PORT || 3001;
  await app.listen(port);
  Logger.log(`KitabX API listening on http://localhost:${port}/${prefix}`, 'Bootstrap');
}

bootstrap();
