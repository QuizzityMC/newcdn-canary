import { Server } from "hyper-express";
import { handleAttachmentsPostRoute } from "./routes/attachmentsPost";
import { handleVerifyPostRoute } from "./routes/verifyPost";
import { handleAvatarsPostRoute } from "./routes/avatarPost";
import { handleBannersPostRoute } from "./routes/bannerPost";
import { handleEmojisPostRoute } from "./routes/emojiPost";
import { handleDeleteFileRoute } from "./routes/deleteFile";
import { handleGetFileRoute } from "./routes/getFile";
import { handleDeleteFilesByFileIdsRoute } from "./routes/deleteFilesByFileIds";
import { handleDeleteAttachmentByGroupIdRoute } from "./routes/deleteAttachmentByGroupId";
import { handleProxyImageRoute } from "./routes/proxyImage";
import { handleProxyImageDimensionsRoute } from "./routes/proxyImageDimensions";
import { env } from "./env";
import { handleUploadWsRoute } from "./routes/uploadWs";
import { handleUploadRoute } from "./routes/uploadPost";

const server = new Server();

server.use((req, res, next) => {
  if (req.headers.origin) {
    const origin = env.origin.includes(req.headers.origin.toLowerCase())
      ? req.headers.origin
      : "https://nerimity.com";
    res.setHeader("Access-Control-Allow-Origin", origin);
  } else {
    res.setHeader("Access-Control-Allow-Origin", "https://nerimity.com");
  }

  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Headers", "content-type");
    res.status(200).end();
    return;
  }

  next();
});

handleDeleteAttachmentByGroupIdRoute(server);
handleDeleteFilesByFileIdsRoute(server);
handleGetFileRoute(server);
handleAttachmentsPostRoute(server);
handleVerifyPostRoute(server);
handleAvatarsPostRoute(server);
handleBannersPostRoute(server);
handleEmojisPostRoute(server);
handleDeleteFileRoute(server);
handleProxyImageRoute(server);
handleProxyImageDimensionsRoute(server);
// handleUploadWsRoute(server);
handleUploadRoute(server);

server.all("/*", (req, res) => {
  res.status(404).send("Not found");
});

server.listen(env.port, () => {
  console.log("Server started on port " + env.port);
});
