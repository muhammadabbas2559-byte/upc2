const fs = require("fs");
const path = require("path");

const runtime = path.resolve("desktop-runtime");
fs.rmSync(runtime, { recursive: true, force: true });
fs.mkdirSync(runtime, { recursive: true });

function copy(source, target) {
  fs.cpSync(path.resolve(source), path.join(runtime, target), {
    recursive: true,
    force: true,
    dereference: true,
  });
}

copy(".next/standalone", ".");
copy("node_modules", "runtime-deps");
copy(".next/static", ".next/static");

for (const required of [
  "server.js",
  "runtime-deps/next/package.json",
  "runtime-deps/react/package.json",
  "runtime-deps/react-dom/package.json",
]) {
  if (!fs.existsSync(path.join(runtime, required))) {
    throw new Error(`Prepared desktop runtime is missing ${required}`);
  }
}

console.log(`Prepared complete desktop runtime at ${runtime}`);
