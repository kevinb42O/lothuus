import { randomUUID } from 'node:crypto';
import { S3Client, PutObjectCommand, GetObjectCommand, ListObjectsV2Command, DeleteObjectsCommand } from '@aws-sdk/client-s3';
import { cloudMode, serverDatabase } from '../backend/cloud';
import { checksum, validateBackup } from './backup-format';

async function rpc(name: string, args?: Record<string, unknown>) {
  const result = await serverDatabase().rpc(name, args);
  if (result.error) throw new Error(`Maintenance database error: ${result.error.code}`);
  return result.data;
}
export async function dailyCloudBackup() {
  if (!cloudMode()) return { skipped: true };
  const id = randomUUID();
  if (!await rpc('lothuus_maintenance_claim', { job_name: 'backup', job_id: id })) return { skipped: true };
  let completed = false, stage = 'configuration', failure = 'Unknown';
  try {
    const bucket = process.env.R2_BACKUP_BUCKET || 'lothuus-backups';
    if (bucket === process.env.R2_BUCKET) throw new Error('Backup bucket must be separate from media');
    const accessKeyId = process.env.R2_BACKUP_ACCESS_KEY_ID || process.env.R2_ACCESS_KEY_ID;
    const secretAccessKey = process.env.R2_BACKUP_SECRET_ACCESS_KEY || process.env.R2_SECRET_ACCESS_KEY;
    if (!process.env.R2_ENDPOINT || !accessKeyId || !secretAccessKey) throw new Error('Backup storage configuration missing');
    const s3 = new S3Client({ region: 'auto', endpoint: process.env.R2_ENDPOINT, credentials: { accessKeyId, secretAccessKey }, maxAttempts: 2 });
    stage = 'snapshot';
    const backup = validateBackup(await rpc('lothuus_backup_state'));
    const body = Buffer.from(JSON.stringify(backup)), digest = checksum(body);
    const key = `database/${backup.createdAt.replaceAll(':', '-')}-${id.slice(0, 8)}.json`;
    stage = 'upload';
    await s3.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: 'application/json' }), { abortSignal: AbortSignal.timeout(20000) });
    // Verify the stored object before promoting the latest pointer.
    stage = 'readback';
    const stored = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }), { abortSignal: AbortSignal.timeout(20000) });
    if (!stored.Body || checksum(await stored.Body.transformToByteArray()) !== digest) throw new Error('Stored backup checksum mismatch');
    stage = 'promotion';
    await s3.send(new PutObjectCommand({ Bucket: bucket, Key: 'database/latest.json', Body: JSON.stringify({ key, sha256: digest, schemaVersion: 2, createdAt: backup.createdAt }), ContentType: 'application/json' }), { abortSignal: AbortSignal.timeout(15000) });
    // Retention only touches dated snapshots under this dedicated prefix.
    stage = 'retention';
    const cutoff = Date.now() - 45 * 86400000;
    let cursor: string | undefined;
    for (let page = 0; page < 10; page++) {
      const listed = await s3.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: 'database/', ContinuationToken: cursor, MaxKeys: 1000 }), { abortSignal: AbortSignal.timeout(15000) });
      const expired = (listed.Contents || []).filter(o => o.Key !== key && /^database\/\d{4}-\d{2}-\d{2}T[^/]+\.json$/.test(o.Key || '') && o.LastModified && o.LastModified.getTime() < cutoff).map(o => ({ Key: o.Key! }));
      if (expired.length) { const removed = await s3.send(new DeleteObjectsCommand({ Bucket: bucket, Delete: { Objects: expired, Quiet: true } }), { abortSignal: AbortSignal.timeout(15000) }); if (removed.Errors?.length) throw new Error('Backup retention incomplete'); }
      if (!listed.IsTruncated) break;
      if (!listed.NextContinuationToken || page === 9) throw new Error('Backup retention pagination incomplete');
      cursor = listed.NextContinuationToken;
    }
    await rpc('lothuus_maintenance_finish', { job_name: 'backup', job_id: id, succeeded: true, metadata: { schemaVersion: 2, bytes: body.byteLength, sha256: digest, tables: Object.keys(backup.tables).length } });
    completed = true;
    return { completed: true, bytes: body.byteLength };
  } catch (error) {
    const name = error instanceof Error ? error.name : '';
    failure = ['AccessDenied', 'NoSuchBucket', 'InvalidAccessKeyId', 'SignatureDoesNotMatch', 'TimeoutError', 'AbortError'].includes(name) ? name : 'MaintenanceError';
    console.error('[backup] maintenance failed', { stage, code: failure });
    throw error;
  } finally {
    if (!completed) await rpc('lothuus_maintenance_finish', { job_name: 'backup', job_id: id, succeeded: false, metadata: { error: 'Backup or retention did not complete', stage, code: failure } });
  }
}
