import path from "path";
import { prisma } from "./db";
import { tempDirPath } from "./utils/Folders";

export enum VerificationType {
  ATTACHMENT = "ATTACHMENT",
  AVATAR = "AVATAR",
  BANNER = "BANNER",
  EMOJI = "EMOJI",
}

interface Opts {
  fileId: string;
  groupId?: string;

  tempFilename: string;
  originalFilename: string;
  type?: VerificationType;

  animated?: boolean;
  filesize: number;
  mimetype: string;

  width?: number;
  height?: number;

  duration?: number

  compressed?: boolean;

  shouldCompress?: boolean;
}

export const addToWaitingList = async (opts: Opts, update?: boolean) => {
  if (update) {
    return prisma.waitingVerification.update({
      where: {
        fileId: opts.fileId
      },
      data: {
        type: opts.type,
        originalFilename: opts.originalFilename,
        tempFilename: opts.tempFilename,
        compressed: opts.compressed || false,
        groupId: opts.groupId,
        animated: opts.animated,
        filesize: opts.filesize,
        duration: opts.duration,
        mimetype: opts.mimetype,

        shouldCompress: opts.shouldCompress,

        width: opts.width,
        height: opts.height,
      },
    });
  }
  return prisma.waitingVerification.create({
    data: {
      fileId: opts.fileId,
      type: opts.type,
      originalFilename: opts.originalFilename,
      tempFilename: opts.tempFilename,
      compressed: opts.compressed || false,
      groupId: opts.groupId,
      animated: opts.animated,
      filesize: opts.filesize,
      duration: opts.duration,
      mimetype: opts.mimetype,

      shouldCompress: opts.shouldCompress,

      width: opts.width,
      height: opts.height,
    },
  });
};

export const removeExpiredVerifications = async () => {
  // 5 minutes
  const expired = new Date(Date.now() - 5 * 60 * 1000);

  const results = await prisma.waitingVerification.findMany({
    take: 1000,
    where: {
      createdAt: {
        lt: expired,
      },
    },
  });
  const fileIds = results.map((r) => r.fileId);

  await prisma.waitingVerification.deleteMany({
    where: {
      fileId: {
        in: fileIds,
      },
    },
  });

  return results;
};

export const findAndDeleteWaitingVerification = async (
  fileId: string,
  groupId: string | undefined,
  type: VerificationType,
  imageOnly?: boolean
) => {
  return prisma.waitingVerification
    .delete({
      where: {
        fileId,
        groupId,
        type,
        compressed: imageOnly
      },
    })
    .catch(() => undefined);
};
