import { Server } from "hyper-express";
import { tempFileMiddleware } from "../middlewares/tempFile.middleware";
import { validGroupIdCheckMiddleware } from "../middlewares/validGroupIdCheck.middleware";
import { addToWaitingList, VerificationType } from "../VerificationService";
import { Request, Response } from "hyper-express";
import { env } from "../env";
import { compressImageMiddleware } from "../middlewares/compressImage.middleware";

export function handleAvatarsPostRoute(server: Server) {
  server.post(
    "/avatars/:groupId/:fileId",
    validGroupIdCheckMiddleware,
    tempFileMiddleware({ image: true }),
    compressImageMiddleware({
      size: [200, 200, "fill"],
      allowCrop: true,
    }),
    route,
    { max_body_length: env.imageMaxBodyLength }
  );
}

const route = async (req: Request, res: Response) => {
  if (!req.file) {
    res.status(400).json({
      error: "Missing file",
    });
    return;
  }

  if (!req.file.compressedFilename) {
    res.status(500).json({
      error: "Internal server error.",
    });
    return;
  }

  const result = await addToWaitingList(
    {
      type: VerificationType.AVATAR,
      fileId: req.file.fileId,
      groupId: req.params.groupId as string,
      compressed: true,
      originalFilename: req.file.originalFilename,
      tempFilename: req.file.tempFilename,
      animated: req.file.animated,
      filesize: req.file.filesize,
      mimetype: req.file.mimetype,
    },
    true
  ).catch((err) => {
    console.error(err);
  });

  if (!result) {
    res.status(500).json({
      error: "Failed to add to waiting list",
    });
    return;
  }

  res.status(200).json({
    fileId: req.file.fileId,
  });
};
