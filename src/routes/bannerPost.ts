import { Server } from "hyper-express";
import { tempFileMiddleware } from "../middlewares/tempFile.middleware";
import { validGroupIdCheckMiddleware } from "../middlewares/validGroupIdCheck.middleware";
import { addToWaitingList, VerificationType } from "../VerificationService";
import { Request, Response } from "hyper-express";
import { config } from "../config";
import { compressImageMiddleware } from "../middlewares/compressImage.middleware";
import { tempDirPath } from "../utils/Folders";

export function handleBannersPostRoute(server: Server) {
  server.post(
    "/banners/:groupId",
    validGroupIdCheckMiddleware,
    tempFileMiddleware({ image: true }),
    compressImageMiddleware({
      size: [1920, 1080, "fit"],
    }),
    route,
    { max_body_length: config.imageMaxBodyLength }
  );
}

const route = async (req: Request, res: Response) => {
  if (!req.file) {
    res.status(400).json({
      error: "Missing file",
    });
    return;
  }
  if (!req.file.shouldCompress) {
    res.status(500).json({
      error: "Internal server error.",
    });
    return;
  }

  const result = await addToWaitingList({
    type: VerificationType.BANNER,
    fileId: req.file.fileId,
    groupId: req.params.groupId as string,
    originalFilename: req.file.originalFilename,
    tempFilename: req.file.tempFilename,
    animated: req.file.animated,
    filesize: req.file.filesize,
    mimetype: req.file.mimetype,
  }).catch((err) => {
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
