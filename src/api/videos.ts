import path from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";

import type { BunRequest } from "bun";

import type { ApiConfig } from "../config";
import { getBearerToken, validateJWT } from "../auth";
import { getVideo, updateVideo } from "../db/videos";

import { respondWithJSON } from "./json";
import { BadRequestError, NotFoundError, UserForbiddenError } from "./errors";

export async function handlerUploadVideo(cfg: ApiConfig, req: BunRequest) {
  const MAX_UPLOAD_SIZE = 1 << 30;

  const { videoId } = req.params as { videoId?: string };

  if (!videoId) {
    throw new BadRequestError("Invalid video ID");
  }

  const token = getBearerToken(req.headers);
  const userID = validateJWT(token, cfg.jwtSecret);

  const video = getVideo(cfg.db, videoId);

  if (!video) {
    throw new NotFoundError("Couldn't find video");
  }

  if (video.userID !== userID) {
    throw new UserForbiddenError("You do not own this video");
  }

  const formData = await req.formData();
  const file = formData.get("video");

  if (!(file instanceof File)) {
    throw new BadRequestError("Video file missing");
  }

  if (file.size > MAX_UPLOAD_SIZE) {
    throw new BadRequestError("Video file too large");
  }

  if (file.type !== "video/mp4") {
    throw new BadRequestError("Unsupported video type");
  }

  const key = `${videoId}.mp4`;

  const tempPath = path.join(tmpdir(), `${videoId}-${randomUUID()}.mp4`);

  try {
    await Bun.write(tempPath, file);

    const tempFile = Bun.file(tempPath);
    const s3File = cfg.s3Client.file(key);

    await s3File.write(tempFile, {
      type: file.type,
    });

    const videoURL = `https://${cfg.s3Bucket}.s3.${cfg.s3Region}.amazonaws.com/${key}`;

    video.videoURL = videoURL;

    updateVideo(cfg.db, video);

    return respondWithJSON(200, video);
  } finally {
    await Bun.file(tempPath).delete();
  }
}
