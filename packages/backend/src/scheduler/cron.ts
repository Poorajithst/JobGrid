import cron from 'node-cron';

export function startScheduler(
  triggerScrape: () => Promise<void>,
  triggerDiscovery?: () => Promise<void>
) {
  cron.schedule('0 2 * * *', async () => {
    console.log(`[${new Date().toISOString()}] Nightly scrape started`);
    try {
      await triggerScrape();
      console.log(`[${new Date().toISOString()}] Nightly scrape completed`);
    } catch (err) {
      console.error(`[${new Date().toISOString()}] Nightly scrape failed:`, err);
    }
  });
  console.log('Scheduler registered: nightly scrape at 2:00 AM');

  if (triggerDiscovery) {
    cron.schedule('0 4 * * 0', async () => {
      console.log(`[${new Date().toISOString()}] Weekly company discovery started`);
      try {
        await triggerDiscovery();
        console.log(`[${new Date().toISOString()}] Weekly company discovery completed`);
      } catch (err) {
        console.error(`[${new Date().toISOString()}] Weekly company discovery failed:`, err);
      }
    });
    console.log('Scheduler registered: weekly company discovery at 4:00 AM Sunday');
  }
}
