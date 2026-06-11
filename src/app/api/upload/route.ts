import { NextRequest } from "next/server";
import { success, error } from "@/lib/api-utils";
import { saveUploadFile } from "@/lib/upload";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return error("请选择要上传的文件");
    }

    const { filePath: publicPath, fileName } = await saveUploadFile(file);

    return success({
      filePath: publicPath,
      fileName,
    });
  } catch (e) {
    return error(e instanceof Error ? e.message : "文件上传失败");
  }
}
