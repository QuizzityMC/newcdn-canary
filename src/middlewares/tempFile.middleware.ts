import { Request, Response, MiddlewareNext, Server } from "hyper-express";
import fs, { stat, WriteStream } from "fs";
import { generateId } from "../utils/flake";
import path from "path";
import { tempDirPath } from "../utils/Folders";
import { pipeline } from "stream/promises";
import { bytesToMb } from "../utils/bytes";
import { env } from "../env";
import { isImageMime, safeFilename } from "../utils/utils";
import { redisClient } from "../utils/redis";
import { prisma } from "../db";

export const tempFileMiddleware = (opts?: { image?: boolean }) => {
  return async (req: Request, res: Response) => {
    res.on("close", () => {
      if (res.statusCode && res.statusCode < 400) return;

      if (req.file?.compressedFilename) {
        fs.promises.unlink(req.file.compressedFilename).catch(() => {});
      }
    });

    const fileId = req.params.fileId;

    const verifyItem = await prisma.waitingVerification.findUnique({
      where: {
        fileId,
        type: null,
      },
    });

    if (!verifyItem) {
      res.status(404).json({
        error: "File not found",
      });
      return;
    }

    req.file = {
      tempPath: path.join(tempDirPath, verifyItem.tempFilename),
      tempFilename: verifyItem.tempFilename,
      fileId: verifyItem.fileId,
      originalFilename: verifyItem.originalFilename,
      mimetype: verifyItem.mimetype,
      animated: verifyItem.animated || false,
      filesize: verifyItem.filesize,
      shouldCompress: verifyItem.shouldCompress || false,
    };
  };
};
