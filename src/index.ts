import os from "os";
import cluster from "cluster";
import { createFolders, tempDirPath } from "./utils/Folders";
import { removeExpiredVerifications } from "./VerificationService";
import { setTimeout } from "timers/promises";
import path from "path";
import fs from "fs";
import { env } from "./env";
import { removeExpiredFiles } from "./ExpireFileService";
const cpus = env.devMode ? 1 : os.cpus().length;


['log', 'warn', 'error'].forEach((methodName) => {
  const originalMethod = console[methodName];
  console[methodName] = (...args) => {
    let initiator = 'unknown place';
    try {
      throw new Error();
    } catch (e) {
      if (typeof e.stack === 'string') {
        let isFirst = true;
        for (const line of e.stack.split('\n')) {
          const matches = line.match(/^\s+at\s+(.*)/);
          if (matches) {
            if (!isFirst) { // first line - current function
              // second line - caller (what we are looking for)
              initiator = matches[1];
              break;
            }
            isFirst = false;
          }
        }
      }
    }
    originalMethod.apply(console, [...args, '\n', `  at ${initiator}`]);
  };
});



if (cluster.isPrimary) {

  createFolders();
  removeExpiredVerificationsAtInterval();
  removeExpiredFilesAtInterval();
  for (let i = 0; i < cpus; i++) {
    cluster.fork({
      cpu: i,
    });
  }

  cluster.on('exit', (worker, code, signal) => {
    console.error(`Worker process ${worker.process.pid} died.`);
    // have to just restart all clusters because of redis cache issues with socket.io online users.
    process.exit(code);
  });
} else {
  import("./worker");
}

// 2 minutes
const removeExpiredVerificationsInterval = 2 * 60 * 1000;
async function removeExpiredVerificationsAtInterval() {
  const results = await removeExpiredVerifications().catch((err) => {
    console.error(err);
  });

  if (results && results.length) {
    for (let i = 0; i < results.length; i++) {
      const item = results[i];
      if (!item) continue;
      const filePath = path.join(tempDirPath, item.tempFilename);
      fs.promises.unlink(filePath).catch(() => { });
    }

    console.log("Removed", results.length, "expired temp files.");
  }
  await setTimeout(removeExpiredVerificationsInterval);
  removeExpiredVerificationsAtInterval();
}

// 2 minutes
const removeExpiredFilesInterval = 2 * 60 * 1000;
async function removeExpiredFilesAtInterval() {
  const results = await removeExpiredFiles().catch((err) => {
    console.error(err);
  });
  if (results && results.length) {
    console.log("Removed", results.length, "expired files.");
  }

  await setTimeout(removeExpiredFilesInterval);
  removeExpiredFilesAtInterval();
}
