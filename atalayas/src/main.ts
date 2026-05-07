import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module'; // (Añade .js si sigues en modo estricto ESM)
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  //app.setGlobalPrefix('api');

  // 1. Configuración de validaciones globales
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: false,
      transform: true,
    }),
  );

  // 2. Configuración de CORS para el frontend
  app.enableCors({
    origin: 'http://localhost:5173',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  // 3. Configuración de Swagger
  const config = new DocumentBuilder()
    .setTitle('API de Atalayas')
    .setDescription('Documentación de los endpoints del proyecto')
    .setVersion('1.0')
    .addBearerAuth() // Añadimos esto para poder meter el token JWT de Supabase en la UI
    .build();

  const document = SwaggerModule.createDocument(app, config);

  // Montamos Swagger en la ruta '/swagger'
  SwaggerModule.setup('swagger', app, document);

  await app.listen(3000);
}
void bootstrap();
