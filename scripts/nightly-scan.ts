// Run the nightly scan from a scheduler job (e.g. Cloud Run Job) instead of HTTP.
import { prisma } from "../lib/db";
import { runAllWatchlists } from "../lib/scan";

runAllWatchlists()
  .then((r) => console.log(JSON.stringify(r)))
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
