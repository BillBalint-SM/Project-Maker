import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module';
import { validateCorsOrigin } from './cors-origin';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const corsOrigin = validateCorsOrigin(process.env['CORS_ORIGIN']);

  app.enableCors({ origin: corsOrigin });
  await app.listen(3000, '0.0.0.0');
}

void bootstrap();
