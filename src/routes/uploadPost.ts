import { Server } from "hyper-express";
import { tempFileMiddleware } from "../middlewares/tempFile.middleware";
import { validGroupIdCheckMiddleware } from "../middlewares/validGroupIdCheck.middleware";
import { addToWaitingList, VerificationType } from "../VerificationService";
import { Request, Response } from "hyper-express";
import { env } from "../env";
import { tempDirPath } from "../utils/Folders";
import { compressImageMiddleware } from "../middlewares/compressImage.middleware";
import { getAudioDurationInSeconds } from "get-audio-duration";
import { generateId } from "../utils/flake";
import path from "path";
import fs from "fs";
import { isImageMime, safeFilename } from "../utils/utils";
import { pipeline } from "stream/promises";

export function handleUploadRoute(server: Server) {
  server.post("/upload", route, {
    max_body_length: env.attachmentMaxBodyLength,
  });
}

const route = async (req: Request, res: Response) => {
  const image = req.query.image === "true";

  let writeStream: fs.WriteStream;
  let closed = false;
  res.on("close", () => {
    closed = true;
    if (res.statusCode && res.statusCode < 400) return;

    if (writeStream) {
      fs.promises.unlink(writeStream.path).catch(() => {});
    }
  });

  if (closed) return;

  await req
    .multipart({ limits: { files: 1, fields: 0 } }, async (field) => {
      if (!field.file) return;
      const fileId = generateId();
      const tempFilename = fileId + path.extname(field.file.name || "");
      const tempPath = path.join(tempDirPath, tempFilename);
      const isImage = isImageMime(field.mime_type);

      if (image && !isImage) {
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

      const result = await addToWaitingList({
        tempFilename,
        fileId,
        originalFilename: safeFilename(field.file.name),
        mimetype: field.mime_type,
        filesize,
        shouldCompress: isImage && filesize <= env.imageMaxBodyLength,
      }).catch((err) => {
        console.error(err);
        res.status(500).json({
          error: "Failed to upload file",
        });
      });

      if (result) {
        res.status(200).json({
          fileId,
        });
      }
    })
    .catch((error) => {
      if (error === "FILES_LIMIT_REACHED") {
        return res.status(403).send("Only one file can be uploaded at a time");
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
