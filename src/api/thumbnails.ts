import path from "node:path";
import { getBearerToken, validateJWT } from "../auth";
import { getVideo, updateVideo } from "../db/videos";
import type { ApiConfig } from "../config";
import type { BunRequest } from "bun";
import { respondWithJSON } from "./json";
import {
  BadRequestError,
  NotFoundError,
  UserForbiddenError,
} from "./errors";

export async function handlerUploadThumbnail(
  cfg: ApiConfig,
  req: BunRequest,
) {
  const { videoId } = req.params as { videoId?: string };

  if (!videoId) {
    throw new BadRequestError("Invalid video ID");
  }

  const token = getBearerToken(req.headers);
  const userID = validateJWT(token, cfg.jwtSecret);

  const formData = await req.formData();
  const file = formData.get("thumbnail");

  if (!(file instanceof File)) {
    throw new BadRequestError("Thumbnail file missing");
  }

  const MAX_UPLOAD_SIZE = 10 << 20;

  if (file.size > MAX_UPLOAD_SIZE) {
    throw new BadRequestError("Thumbnail file too large");
  }

  const video = getVideo(cfg.db, videoId);

  if (!video) {
    throw new NotFoundError("Couldn't find video");
  }

  if (video.userID !== userID) {
    throw new UserForbiddenError("You do not own this video");
  }

  const fileExtension = file.type.split("/")[1];
  const filename = `${videoId}.${fileExtension}`;
  const fullPath = path.join(cfg.assetsRoot, filename);

  const data = await file.arrayBuffer();
  await Bun.write(fullPath, data);

  const thumbnailURL =
    `http://localhost:${cfg.port}/assets/${filename}`;

  video.thumbnailURL = thumbnailURL;

  updateVideo(cfg.db, video);

  return respondWithJSON(200, video);
}