import * as fs from "fs";
import { STATE_DIR } from "./state";
import * as path from "path";
import { atomicWriteFileSync } from "./fs-utils";

const PROCESSES_PATH = path.join(STATE_DIR, "processes.json");

export interface ProcessEntry {
  pid: number;
  cwd: string;
  command: string;
  provider: string;
  started_at: string;
}

function readProcesses(): ProcessEntry[] {
  if (!fs.existsSync(PROCESSES_PATH)) return [];
  try {
    const data = JSON.parse(fs.readFileSync(PROCESSES_PATH, "utf-8"));
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function writeProcesses(entries: ProcessEntry[]): void {
  fs.mkdirSync(STATE_DIR, { recursive: true });
  atomicWriteFileSync(PROCESSES_PATH, JSON.stringify(entries, null, 2));
}

function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export function registerProcess(
  pid: number,
  cwd: string,
  command: string,
  provider: string
): void {
  const entries = readProcesses();
  entries.push({
    pid,
    cwd,
    command,
    provider,
    started_at: new Date().toISOString(),
  });
  writeProcesses(entries);
}

export function unregisterProcess(pid: number): void {
  const entries = readProcesses();
  writeProcesses(entries.filter((e) => e.pid !== pid));
}

export function listAliveProcesses(): ProcessEntry[] {
  const entries = readProcesses();
  const alive = entries.filter((e) => isAlive(e.pid));
  if (alive.length !== entries.length) {
    writeProcesses(alive);
  }
  return alive;
}
