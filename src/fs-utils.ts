import * as fs from "fs";
import * as path from "path";

export function atomicWriteFileSync(filePath: string, data: string): void {
  const tmpPath = path.join(
    path.dirname(filePath),
    path.basename(filePath) + ".tmp"
  );
  try {
    fs.writeFileSync(tmpPath, data, "utf-8");
    fs.renameSync(tmpPath, filePath);
  } catch (err) {
    try {
      fs.unlinkSync(tmpPath);
    } catch {
      // ignore cleanup failure
    }
    throw err;
  }
}
