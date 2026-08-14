import fs from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { env } from "./env.js";

export function ensureUploadDir(...parts: string[]) {
  const dir = path.join(env.STORAGE_LOCAL_PATH, ...parts);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function saveBuffer(
  tenantId: string,
  buf: Buffer,
  ext: string,
): { relativePath: string; absPath: string } {
  const safeExt = ext.replace(/[^a-z0-9]/gi, "").slice(0, 8) || "bin";
  const name = `${Date.now()}-${randomBytes(4).toString("hex")}.${safeExt}`;
  const dir = ensureUploadDir(tenantId);
  const absPath = path.join(dir, name);
  fs.writeFileSync(absPath, buf);
  return {
    relativePath: `${tenantId}/${name}`,
    absPath,
  };
}

export function publicMediaUrl(relativePath: string) {
  return `/api/v1/media/${relativePath.replace(/\\/g, "/")}`;
}
