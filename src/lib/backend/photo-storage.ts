import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { BusinessError } from './service';
import { PhotoByteCache } from './photo-byte-cache';

let current: {
  endpoint: string | undefined; bucket: string | undefined; accessKeyId: string; secretAccessKey: string;
  client: S3Client; bytes: PhotoByteCache;
} | undefined;

/** Reuse connections and immutable bytes within a warm function, never authorization. */
export async function readStoredPhoto(id: string, size: string) {
  const { R2_ENDPOINT: endpoint, R2_BUCKET: bucket, R2_ACCESS_KEY_ID: accessKeyId, R2_SECRET_ACCESS_KEY: secretAccessKey } = process.env;
  if (!accessKeyId || !secretAccessKey) throw new BusinessError('Foto-opslag niet beschikbaar.', 503);
  if (!current || current.endpoint !== endpoint || current.bucket !== bucket || current.accessKeyId !== accessKeyId || current.secretAccessKey !== secretAccessKey) {
    // A configuration change must never reuse bytes from a different bucket/account.
    // Do not destroy the old client: concurrent reads may still be using it.
    current = { endpoint, bucket, accessKeyId, secretAccessKey,
      client: new S3Client({ region: 'auto', endpoint, credentials: { accessKeyId, secretAccessKey } }),
      bytes: new PhotoByteCache() };
  }
  const storage = current;
  const key = `variants/${id}-${size}.webp`;
  return storage.bytes.read(key, async () => {
    const object = await storage.client.send(new GetObjectCommand({ Bucket: storage.bucket, Key: key }));
    return object.Body ? new Uint8Array(await object.Body.transformToByteArray()) : null;
  });
}
