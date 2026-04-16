import app from './app';
import { startAutoAbsentJob } from './jobs/autoAbsent';

const port = parseInt(process.env.PORT || '8081', 10);
app.listen(port, () => {
  console.log(`server listening on ${port}`);
  startAutoAbsentJob();
});

