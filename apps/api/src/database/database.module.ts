import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule, type TypeOrmModuleOptions } from '@nestjs/typeorm';

import {
  createDatabaseConfiguration,
  createDatabaseDataSourceOptions,
} from '../config/database.config';

function createTypeOrmModuleOptions(configService: ConfigService): TypeOrmModuleOptions {
  return {
    ...createDatabaseDataSourceOptions(
      createDatabaseConfiguration(configService.get<string>('DATABASE_URL'))
    ),
    autoLoadEntities: true,
  };
}

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: createTypeOrmModuleOptions,
    }),
  ],
})
export class DatabaseModule {}
