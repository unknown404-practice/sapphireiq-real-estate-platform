import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'path';
import fs from 'fs';
import { Property } from '../src/models/Property';
import { User } from '../src/models/User';
import { OrphanedUpload } from '../src/models/OrphanedUpload';
import { reconcileDiskOrphans, retryOrphanedUploadCleanups } from '../src/services/imageService';

describe('STORAGE-02: Scheduled Directory Orphan Sweeper & Upload Lifecycle Protection', () => {
  const uploadsDir = path.resolve(__dirname, '../uploads');
  let testUserId: string;

  beforeEach(async () => {
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const user = await User.create({
      name: 'Sweeper User',
      email: `sweeper_${Date.now()}@sapphireiq.local`,
      password: 'Password123!',
      role: 'user',
    });
    testUserId = user._id.toString();
  });

  it('preserves files referenced by active properties', async () => {
    const activeFileName = `active_${Date.now()}.jpg`;
    const activeFilePath = path.join(uploadsDir, activeFileName);
    await fs.promises.writeFile(activeFilePath, 'dummy-active-content');

    await Property.create({
      title: 'Active Property With Image',
      description: 'A genuine listed property',
      price: 1500000,
      propertyType: 'apartment',
      listingType: 'sale',
      city: 'Delhi',
      state: 'Delhi',
      owner: testUserId,
      images: [
        {
          url: `/uploads/${activeFileName}`,
          fileId: activeFileName,
          caption: 'Living room',
        },
      ],
    });

    // Run sweeper with 0 grace period and auto-discovered references
    const result = await reconcileDiskOrphans(undefined, 0);
    expect(fs.existsSync(activeFilePath)).toBe(true);
    expect(result.skippedActive).toBeGreaterThanOrEqual(1);

    // Cleanup
    if (fs.existsSync(activeFilePath)) {
      await fs.promises.unlink(activeFilePath);
    }
  });

  it('removes stranded unreferenced files older than grace period', async () => {
    const strandedFileName = `stranded_${Date.now()}.jpg`;
    const strandedFilePath = path.join(uploadsDir, strandedFileName);
    await fs.promises.writeFile(strandedFilePath, 'dummy-stranded-content');

    // Run sweeper with 0ms grace period so stranded file is considered expired
    const result = await reconcileDiskOrphans(undefined, 0);

    expect(result.purged).toBeGreaterThanOrEqual(1);
    expect(fs.existsSync(strandedFilePath)).toBe(false);
  });

  it('protects recent in-progress uploads within grace period', async () => {
    const recentFileName = `recent_in_progress_${Date.now()}.jpg`;
    const recentFilePath = path.join(uploadsDir, recentFileName);
    await fs.promises.writeFile(recentFilePath, 'dummy-recent-content');

    // Run sweeper with 1 hour grace period
    const result = await reconcileDiskOrphans(undefined, 3600 * 1000);

    expect(fs.existsSync(recentFilePath)).toBe(true);
    expect(result.skippedRecent).toBeGreaterThanOrEqual(1);

    // Cleanup
    if (fs.existsSync(recentFilePath)) {
      await fs.promises.unlink(recentFilePath);
    }
  });

  it('reconciles queue-based orphaned uploads safely', async () => {
    const queueFileName = `queue_orphan_${Date.now()}.jpg`;
    const queueFilePath = path.join(uploadsDir, queueFileName);
    await fs.promises.writeFile(queueFilePath, 'dummy-queue-content');

    await OrphanedUpload.create({
      fileId: queueFileName,
      url: `/uploads/${queueFileName}`,
      errorReason: 'Simulated failure during multi-image rollback',
      status: 'pending',
      retryCount: 0,
      lastAttemptAt: new Date(Date.now() - 10000),
    });

    const result = await retryOrphanedUploadCleanups();
    expect(result.processed).toBeGreaterThanOrEqual(1);
    expect(result.resolved).toBeGreaterThanOrEqual(1);
    expect(fs.existsSync(queueFilePath)).toBe(false);
  });
});
