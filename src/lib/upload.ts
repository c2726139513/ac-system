import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { v4 as uuidv4 } from "uuid";

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");

export async function saveUploadFile(
  file: File,
  subDir: string = "general"
): Promise<{ filePath: string; fileName: string; savedPath: string }> {
  const uploadPath = path.join(UPLOAD_DIR, subDir);
  await mkdir(uploadPath, { recursive: true });

  const ext = path.extname(file.name) || ".ofd";
  const savedName = `${uuidv4()}${ext}`;
  const savedPath = path.join(uploadPath, savedName);

  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(savedPath, buffer);

  return {
    filePath: `/uploads/${subDir}/${savedName}`,
    fileName: file.name,
    savedPath,
  };
}
