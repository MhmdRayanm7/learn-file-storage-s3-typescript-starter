import path from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";

import type { BunRequest } from "bun";

import type { ApiConfig } from "../config";
import { getBearerToken, validateJWT } from "../auth";
import { getVideo, updateVideo } from "../db/videos";

import { respondWithJSON } from "./json";
import { BadRequestError, NotFoundError, UserForbiddenError } from "./errors";
import exp from "node:constants";

type VideoAspectRatio = "landscape" | "portrait" | "other";

// Upload a video, detect its aspect ratio, and store it in S3
export async function handlerUploadVideo(cfg: ApiConfig, req: BunRequest) {
  const MAX_UPLOAD_SIZE = 1 << 30;

  // Get the video ID from the URL
  const { videoId } = req.params as { videoId?: string };

  if (!videoId) {
    throw new BadRequestError("Invalid video ID");
  }

  // Authenticate the user
  const token = getBearerToken(req.headers);
  const userID = validateJWT(token, cfg.jwtSecret);

  // Get the video metadata from the database
  const video = getVideo(cfg.db, videoId);

  if (!video) {
    throw new NotFoundError("Couldn't find video");
  }

  // Only the owner can upload the video file
  if (video.userID !== userID) {
    throw new UserForbiddenError("You do not own this video");
  }

  // Get the uploaded video from the form
  const formData = await req.formData();
  const file = formData.get("video");

  if (!(file instanceof File)) {
    throw new BadRequestError("Video file missing");
  }

  // Validate upload size and file type
  if (file.size > MAX_UPLOAD_SIZE) {
    throw new BadRequestError("Video file too large");
  }

  if (file.type !== "video/mp4") {
    throw new BadRequestError("Unsupported video type");
  }
  // Save the uploaded video temporarily on disk
  const tempPath = path.join(tmpdir(), `${videoId}-${randomUUID()}.mp4`);

  let processedTempPath: string | undefined;

  try {
    await Bun.write(tempPath, file);

    // Detect the video's aspect ratio
    const aspectRatio = await getVideoAspectRatio(tempPath);

    // Create a fast-start version of the video
    processedTempPath = await processVideoForFastStart(tempPath);

    // Use the aspect ratio as the S3 prefix
    const key = `${aspectRatio}/${videoId}.mp4`;

    // Upload the processed video to S3
    const processedFile = Bun.file(processedTempPath);
    const s3File = cfg.s3Client.file(key);

    await s3File.write(processedFile, {
      type: file.type,
    });

    // Save the S3 URL in the database
    const videoURL = `https://${cfg.s3Bucket}.s3.${cfg.s3Region}.amazonaws.com/${key}`;

    video.videoURL = videoURL;

    updateVideo(cfg.db, video);

    return respondWithJSON(200, video);
  } finally {
    // Always remove the original temporary file
    await Bun.file(tempPath).delete();

    // Remove the processed file if it was created
    if (processedTempPath) {
      await Bun.file(processedTempPath).delete();
    }
  }
}

// Detect whether a video is landscape, portrait, or another aspect ratio
export async function getVideoAspectRatio(
  filePath: string,
): Promise<VideoAspectRatio> {
  const LANDSCAPE_RATIO = 16 / 9;
  const PORTRAIT_RATIO = 9 / 16;
  const TOLERANCE = 0.01;

  // Run ffprobe on the first video stream
  const proc = Bun.spawn(
    [
      "ffprobe",
      "-v",
      "error",
      "-select_streams",
      "v:0",
      "-show_entries",
      "stream=width,height",
      "-of",
      "json",
      filePath,
    ],
    {
      stdout: "pipe",
      stderr: "pipe",
    },
  );

  // Read ffprobe output
  const stdoutText = await new Response(proc.stdout).text();
  const stderrText = await new Response(proc.stderr).text();

  const exitCode = await proc.exited;

  if (exitCode !== 0) {
    throw new Error(`ffprobe failed: ${stderrText}`);
  }

  // Parse the JSON returned by ffprobe
  let data;

  try {
    data = JSON.parse(stdoutText);
  } catch {
    throw new Error("Invalid ffprobe output");
  }

  const stream = data.streams?.[0];

  if (!stream) {
    throw new Error("No video stream found");
  }

  const { width, height } = stream;

  if (
    typeof width !== "number" ||
    typeof height !== "number" ||
    width <= 0 ||
    height <= 0
  ) {
    throw new Error("Invalid video dimensions");
  }

  // Compare the video's ratio with 16:9 and 9:16
  const aspectRatio = width / height;

  if (Math.abs(aspectRatio - LANDSCAPE_RATIO) < TOLERANCE) {
    return "landscape";
  }

  if (Math.abs(aspectRatio - PORTRAIT_RATIO) < TOLERANCE) {
    return "portrait";
  }

  return "other";
}

export async function processVideoForFastStart(
  inputFilePath: string,
): Promise<string> {
  const outputFilePath = `${inputFilePath}.processed`;

  const proc = Bun.spawn(
    [
      "ffmpeg",
      "-i",
      inputFilePath,
      "-movflags",
      "faststart",
      "-map_metadata",
      "0",
      "-codec",
      "copy",
      "-f",
      "mp4",
      outputFilePath,
    ],
    {
      stdout: "pipe",
      stderr: "pipe",
    },
  );

  const stdoutText = await new Response(proc.stdout).text();
  const stderrText = await new Response(proc.stderr).text();

  const exitCode = await proc.exited;

  if (exitCode !== 0) {
    throw new Error(`ffmpeg failed: ${stderrText}`);
  }

  return outputFilePath;
}
