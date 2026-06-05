import { Injectable, OnModuleInit } from '@nestjs/common';
import * as Minio from 'minio';

@Injectable()
export class StorageService implements OnModuleInit {
  private client: Minio.Client;
  private bucket: string;

  constructor() {
    this.client = new Minio.Client({
      endPoint: process.env.MINIO_ENDPOINT ?? 'localhost',
      port: Number(process.env.MINIO_PORT ?? 9000),
      useSSL: process.env.MINIO_USE_SSL === 'true',
      accessKey: process.env.MINIO_ACCESS_KEY!,
      secretKey: process.env.MINIO_SECRET_KEY!,
    });
    this.bucket = process.env.MINIO_BUCKET ?? 'thesis-documents';
  }

  async onModuleInit() {
    const exists = await this.client.bucketExists(this.bucket);
    if (exists) return;

    try {
      await this.client.makeBucket(this.bucket, 'us-east-1');
      await this.client.setBucketPolicy(
        this.bucket,
        JSON.stringify({
          Version: '2012-10-17',
          Statement: [{ Effect: 'Deny', Principal: '*', Action: 's3:GetObject', Resource: `arn:aws:s3:::${this.bucket}/*` }],
        }),
      );
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code;
      if (code !== 'BucketAlreadyOwnedByYou' && code !== 'BucketAlreadyExists') {
        throw err;
      }
    }
  }

  async upload(key: string, buffer: Buffer, contentType: string): Promise<void> {
    await this.client.putObject(this.bucket, key, buffer, buffer.length, {
      'Content-Type': contentType,
    });
  }

  async download(key: string): Promise<Buffer> {
    const stream = await this.client.getObject(this.bucket, key);
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      stream.on('data', (chunk) => chunks.push(chunk));
      stream.on('end', () => resolve(Buffer.concat(chunks)));
      stream.on('error', reject);
    });
  }

  async getPresignedUrl(key: string, expirySeconds = 3600): Promise<string> {
    // Generamos la URL firmada.
    // Usamos un objeto vacío para params para evitar que se incluyan metadatos innecesarios 
    // que causen el error "MetadataTooLarge".
    const url = await this.client.presignedGetObject(this.bucket, key, expirySeconds);
    
    // Reemplazo de hostname para acceso desde el navegador (fuera de Docker)
    const internalHost = process.env.MINIO_ENDPOINT ?? 'minio';
    if (url.includes(`://${internalHost}:`)) {
      return url.replace(`://${internalHost}:`, '://localhost:');
    }
    
    return url;
  }

  async delete(key: string): Promise<void> {
    await this.client.removeObject(this.bucket, key);
  }
}
