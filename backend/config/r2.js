const { S3Client, PutObjectCommand, DeleteObjectCommand, ListObjectsV2Command } = require('@aws-sdk/client-s3');

// Cloudflare R2 is S3-compatible, so the regular AWS S3 client works against
// R2's endpoint without any special SDK. Files are uploaded here instead of
// to local disk because Render's filesystem is wiped on every deploy.
const client = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

const BUCKET = process.env.R2_BUCKET_NAME;
// Public base URL for serving files back out (r2.dev subdomain or a custom domain bound to the bucket).
const PUBLIC_URL = (process.env.R2_PUBLIC_URL || '').replace(/\/$/, '');

async function uploadToR2(key, buffer, contentType, contentDisposition) {
  await client.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: buffer,
    ContentType: contentType,
    ...(contentDisposition ? { ContentDisposition: contentDisposition } : {}),
  }));
  return `${PUBLIC_URL}/${key}`;
}

async function deleteFromR2(key) {
  await client.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
}

// Given a stored public URL, recover the object key so it can be deleted later.
function keyFromUrl(url) {
  if (!url || !url.startsWith(PUBLIC_URL)) return null;
  return url.slice(PUBLIC_URL.length + 1);
}

// Separate, non-public bucket for DB backups - these contain password hashes
// and personal data, so they must never be reachable through a public URL
// the way the uploads bucket is.
const BACKUP_BUCKET = process.env.R2_BACKUP_BUCKET_NAME;

async function uploadBackup(key, buffer, contentType) {
  await client.send(new PutObjectCommand({
    Bucket: BACKUP_BUCKET,
    Key: key,
    Body: buffer,
    ContentType: contentType,
  }));
}

async function listBackups(prefix) {
  const out = await client.send(new ListObjectsV2Command({ Bucket: BACKUP_BUCKET, Prefix: prefix }));
  return out.Contents || [];
}

async function deleteBackup(key) {
  await client.send(new DeleteObjectCommand({ Bucket: BACKUP_BUCKET, Key: key }));
}

module.exports = { uploadToR2, deleteFromR2, keyFromUrl, uploadBackup, listBackups, deleteBackup };
