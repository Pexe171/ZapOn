import { exec } from "child_process";
import path from "path";

export const convertWebmToMp4 = (inputPath: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const outputPath = inputPath.replace(/\.webm$/i, ".mp4");

    const cmd = `ffmpeg -y -i "${inputPath}" -movflags faststart -pix_fmt yuv420p "${outputPath}"`;

    exec(cmd, (error) => {
      if (error) {
        return reject(error);
      }
      resolve(outputPath);
    });
  });
};
