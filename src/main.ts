import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { mkdir } from 'fs/promises';
import { dirname } from 'path';
import { AppModule } from './app.module';
import { databasePath } from './database/database.options';

async function bootstrap(): Promise<void> {
  await mkdir(dirname(databasePath), { recursive: true });
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  app.enableCors({ origin: process.env.UI_ORIGIN ?? 'http://localhost:5173' });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Learning Centre Scheduler')
    .setDescription('Internal API for safely coordinating tutoring lessons.')
    .setVersion('1.0')
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document, {
    customSiteTitle: 'Learning Centre Scheduler API',
  });
  await app.listen(process.env.PORT ? Number(process.env.PORT) : 3000);
}

void bootstrap();
