import fs from "fs";
import path from "path";

export function log(message: string) {
  const logMessage = `[${new Date().toISOString()}] ${message}\n`;
  console.log(logMessage.trim());
  fs.appendFileSync(path.join("logs.txt"), logMessage);
}
