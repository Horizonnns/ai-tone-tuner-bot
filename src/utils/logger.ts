import fs from "fs";
import path from "path";

export function log(message: string) {
  const logMessage = `[${new Date().toISOString()}] ${message}\n`;
  console.log(logMessage.trim());
  const logPath = path.join(process.cwd(), "logs.txt");
  fs.appendFileSync(logPath, logMessage);
}
