import type { ActivitySnapshot } from '@/services/ActivityService';
import { Banner, DemoDataBanner } from './StateViews';

/** Non-blocking notices shared by the data screens: demo provider, sync problems. */
export function SnapshotNotices({ snapshot }: { snapshot: ActivitySnapshot }) {
  const { sync, provider } = snapshot;
  return (
    <>
      {provider === 'mock' ? <DemoDataBanner /> : null}
      {sync.status === 'failed' ? (
        <Banner
          testID="banner-sync-failed"
          tone="warning"
          message="Couldn't refresh from Health. Showing the most recent data saved on this device. Pull down to try again."
        />
      ) : null}
      {sync.status === 'synced' && sync.failedMetrics.length > 0 ? (
        <Banner
          testID="banner-partial-sync"
          tone="warning"
          message={`Some data couldn't be read (${sync.failedMetrics.join(', ')}). Other metrics are up to date.`}
        />
      ) : null}
      {sync.status === 'unavailable' ? (
        <Banner tone="warning" testID="banner-unavailable" message="Health data isn't available on this device." />
      ) : null}
    </>
  );
}
