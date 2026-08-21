# learn-file-storage-s3-typescript-starter (Tubely)

This repo contains the starter code for the Tubely application - the #1 tool for engagement bait - for the "Learn File Servers and CDNs with S3 and CloudFront" [course](https://www.boot.dev/courses/learn-file-servers-s3-cloudfront-typescript) on [boot.dev](https://www.boot.dev)

## Quickstart

*This is to be used as a *reference\* in case you need it, you should follow the instructions in the course rather than trying to do everything here.

## 1. Install dependencies

- [Typescript](https://www.typescriptlang.org/)
- [Bun](https://bun.sh/)
- [FFMPEG](https://ffmpeg.org/download.html) - both `ffmpeg` and `ffprobe` are required to be in your `PATH`.

```bash
# linux
sudo apt update
sudo apt install ffmpeg

# mac
brew update
brew install ffmpeg
```

- [SQLite 3](https://www.sqlite.org/download.html) only required for you to manually inspect the database.

```bash
# linux
sudo apt update
sudo apt install sqlite3

# mac
brew update
brew install sqlite3
```

- [AWS CLI](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html)

## 2. Download sample images and videos

```bash
./samplesdownload.sh
# samples/ dir will be created
# with sample images and videos
```

## 3. Configure environment variables

Copy the `.env.example` file to `.env` and fill in the values.

```bash
cp .env.example .env
```

You'll need to update values in the `.env` file to match your configuration, but _you won't need to do anything here until the course tells you to_.

## 3. Run the server

```bash
bun run src/index.ts
```

- You should see a new database file `tubely.db` created in the root directory.
- You should see a new `assets` directory created in the root directory, this is where the images will be stored.
- You should see a link in your console to open the local web page.


## What I Learned

- Local filesystem storage
- Base64 and file uploads
- MIME type and upload size validation
- AWS S3 object storage
- S3 object keys and prefixes
- Public and private S3 buckets
- IAM users, groups, policies, and roles
- Principle of least privilege
- Presigned URLs
- Video aspect ratio detection with ffprobe
- MP4 fast-start processing with FFmpeg
- CloudFront CDN
- CloudFront cache invalidations
- S3 object versioning
- Encryption at rest and in transit

## Tech Stack

- TypeScript
- Bun
- SQLite
- AWS S3
- AWS IAM
- AWS CloudFront
- FFmpeg / ffprobe

## Notes

This repository is based on the Boot.dev course starter project and was extended throughout the course exercises.

All AWS resources created for the course were deleted after completion to avoid unnecessary charges.