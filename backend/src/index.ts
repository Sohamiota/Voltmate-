import app from './app';
import { startAutoAbsentJob } from './jobs/autoAbsent';
import { startServiceMonitorJob } from './jobs/serviceMonitor';
import { startDailyTargetWhatsAppJob } from './jobs/dailyTargetWhatsApp';

const port = parseInt(process.env.PORT || '8081', 10);
app.listen(port, () => {
  console.log(`server listening on ${port}`);
  startAutoAbsentJob();
  startServiceMonitorJob();
  startDailyTargetWhatsAppJob();
});

