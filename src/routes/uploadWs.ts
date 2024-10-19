import { Server } from "hyper-express";
import { Request, Response } from "hyper-express";
import { fetchHeaders, isImageMime, isUrl } from "../utils/utils";

import { checkSecretMiddleware } from "../middlewares/checkSecret.middleware";
import { getMetadata } from "../utils/sharp";
import { generateId } from "../utils/flake";
import path from 'path';
import fs from 'fs';
import { tempDirPath } from "../utils/Folders";
import { env } from "../env";

export function handleUploadWsRoute(server: Server) {
  server.ws("/upload", { max_payload_length: 10 * 1024 * 1024, message_type: 'Buffer' }, (ws) => {


    console.log(ws.ip + ' is now connected using websockets!');

    let byteLength = 0;
    let details: {
      filename: string
      filesize: number
      filetype: string
    } | undefined;

    let fileId: string
    let extName: string

    let tempFilename: string

    let writeStream: fs.WriteStream;


    ws.on('close', () => {
      if (details && byteLength !== details.filesize) {
        writeStream.close();
        fs.promises.unlink(path.join(tempDirPath, tempFilename)).catch(() => { });
      }
    });

    ws.on("message", (msg: Buffer) => {

      if (!details) {
        try {
          details = JSON.parse(msg.toString());

          if (!details?.filesize || details.filesize! > env.attachmentMaxBodyLength) {
            ws.close();
            return;
          }

          fileId = generateId();
          extName = path.extname(details!.filename);

          tempFilename = fileId + extName;

          writeStream = fs.createWriteStream(path.join(tempDirPath, tempFilename), { flags: "a" });

          ws.send("n")
          return;
        } catch (e) {
          ws.close();
          return;
        }
      }

      byteLength += msg.byteLength;
      const done = byteLength === details.filesize


      writeStream.write(msg, () => {
        if (done) {
          writeStream.close();
          ws.send(fileId)
          ws.close()
          return;
        }
        ws.send("n")
      })
    })

  })
}

