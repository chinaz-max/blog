import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const result = spawnSync(
    process.platform === "win32" ? "python" : "python3",
    [fileURLToPath(new URL("./update-ai-radar.py", import.meta.url))],
    { stdio: "inherit", timeout: 75_000 },
);

if (result.error || result.status !== 0) {
    console.warn("AI radar: refresh unavailable; building with the existing public snapshot.");
}
