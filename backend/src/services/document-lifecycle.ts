import cron from 'node-cron';
import { Logger } from '../utils/logger';

const logger = new Logger('DocumentLifecycle');
const AGE_24H_MS = 24 * 60 * 60 * 1000;

const localPending = new Map<string, { deleteAt: number; onDelete: () => void | Promise<void> }>();

export function scheduleDocumentImageDeletion(
  documentId: string,
  onDelete: () => void | Promise<void>,
  uploadedAt: Date = new Date()
): void {
  localPending.set(documentId, {
    deleteAt: uploadedAt.getTime() + AGE_24H_MS,
    onDelete,
  });
}

export async function runAzureBlobCleanup(): Promise<number> {
  const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
  if (!connectionString) return 0;

  try {
    const { BlobServiceClient } = await import('@azure/storage-blob');
    const client = BlobServiceClient.fromConnectionString(connectionString);
    const containerClient = client.getContainerClient('document-uploads');
    let deletedCount = 0;
    const now = Date.now();

    for await (const blob of containerClient.listBlobsFlat()) {
      if (!blob.name.endsWith('.original.jpg')) continue;
      const blobClient = containerClient.getBlockBlobClient(blob.name);
      const props = await blobClient.getProperties();
      const blobAge = now - (props.createdOn?.getTime() ?? 0);
      if (blobAge > AGE_24H_MS) {
        await blobClient.delete();
        deletedCount += 1;
        logger.info(`Deleted original image: ${blob.name}`);
      }
    }
    return deletedCount;
  } catch (err) {
    logger.error('Azure blob cleanup failed', err);
    return 0;
  }
}

async function runLocalCleanup(): Promise<number> {
  const now = Date.now();
  let deleted = 0;
  for (const [id, entry] of localPending) {
    if (entry.deleteAt <= now) {
      await entry.onDelete();
      localPending.delete(id);
      deleted += 1;
    }
  }
  return deleted;
}

export async function triggerDocumentLifecycleCleanup(): Promise<number> {
  const azure = await runAzureBlobCleanup();
  const local = await runLocalCleanup();
  return azure + local;
}

export function initializeDocumentLifecycle(): void {
  cron.schedule('0 */6 * * *', () => {
    void triggerDocumentLifecycleCleanup();
  });
  logger.info('Document lifecycle initialized (24h auto-delete every 6 hours)');
}

export function getPendingDeletionCount(): number {
  return localPending.size;
}
