import { Request, Response, MiddlewareNext, Server } from "hyper-express";
import fs, { stat, WriteStream } from "fs";
import { generateId } from "../utils/flake";
import path from "path";
import { tempDirPath } from "../utils/Folders";
import { pipeline } from "stream/promises";
import { bytesToMb } from "../utils/bytes";
import { env } from "../env";
import { isImageMime, safeFilename } from "../utils/utils";
import { AltQueue } from "@nerimity/mimiqueue";
import { redisClient } from "../utils/redis";

const authQueue = new AltQueue({
  name: "cdn",
  prefix: "cdn",
  redisClient,
});

export const tempFileMiddleware = (opts?: { image?: boolean }) => {
  return async (req: Request, res: Response) => {
    let done: () => Promise<void> | undefined;
    let writeStream: fs.WriteStream;
    let closed = false;
    res.on("close", () => {
      closed = true;
      done?.();
      if (res.statusCode && res.statusCode < 400) return;

      if (writeStream) {
        fs.promises.unlink(writeStream.path).catch(() => { });
        if (req.file?.compressedFilename) {
          fs.promises.unlink(req.file.compressedFilename).catch(() => { });
        }
      }
    });

    const userIP = (
      req.headers["cf-connecting-ip"] || req.headers["x-forwarded-for"] || req.ip
    )?.toString();

    done = await authQueue.start({ groupName: userIP });
    if (closed) return;

    await req
      .multipart({ limits: { files: 1, fields: 0 } }, async (field) => {
        if (!field.file) return;
        const fileId = generateId();
        const tempFilename = fileId + path.extname(field.file.name || "");
        const tempPath = path.join(tempDirPath, tempFilename);
        const isImage = isImageMime(field.mime_type);

        if (opts?.image && !isImage) {
          field.file.stream.on("readable", () => {
            res.status(400).json({
              error: "Invalid image mime type",
            });
          });
          return;
        }

        // Use this to rate limit.
        // limit_rate_after 500k;
        // or limit_rate 20k;
        // https://www.tecmint.com/nginx-bandwidth-limit/#:~:text=a%20location%20block%E2%80%9D.-,limit_rate_after%20500k%3B,-Here%20is%20an
        writeStream = fs.createWriteStream(tempPath);
        const status = await pipeline(field.file.stream, writeStream).catch(
          () => null
        );
        if (status === null) {
          res.status(500).json({
            error: "Failed to upload file",
          });
          return;
        }

        const filesize = (await fs.promises.stat(tempPath)).size;
        req.file = {
          tempPath,
          tempFilename,
          fileId,
          originalFilename: safeFilename(field.file.name),
          mimetype: field.mime_type,
          animated: false,
          filesize,
          shouldCompress: isImage && filesize <= env.imageMaxBodyLength,
        };
      })
      .catch((error) => {
        if (error === "FILES_LIMIT_REACHED") {
          return res
            .status(403)
            .send("Only one file can be uploaded at a time");
        } else if (error === "FIELDS_LIMIT_REACHED") {
          return res
            .status(403)
            .send("There should be no fields in the request.");
        } else {
          const text = typeof error === "string" ? error : "";
          console.log(error);
          return res
            .status(500)
            .send("Oops! An uncaught error occurred on our end. " + text);
        }
      });
  };
};
