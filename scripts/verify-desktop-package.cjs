const fs = require("fs");
const path = require("path");

const required = [
  ".next/standalone/server.js",
  ".next/standalone/node_modules/next/package.json",
  ".next/standalone/node_modules/react/package.json",
  ".next/standalone/node_modules/react-dom/package.json",
];

for (const file of required) {
  if (!fs.existsSync(file)) {
    throw new Error(`Desktop build is incomplete. Missing: ${file}`);
  }
}

const unpackedRoot = path.join("dist", "win-unpacked");
if (!fs.existsSync(unpackedRoot)) {
  throw new Error(
    "Windows unpacked output was not created at dist/win-unpacked. " +
      "Run this command on the Windows target: electron-builder --win nsis."
  );
}

const unpacked = path.join(unpackedRoot, "resources", "standalone");
for (const file of ["server.js", "runtime-deps/next/package.json", "runtime-deps/react/package.json", "runtime-deps/react-dom/package.json"]) {
  const target = path.join(unpacked, file);
  if (!fs.existsSync(target)) {
    throw new Error(`Windows package is incomplete. Missing: ${target}`);
  }
}

const wrapper = path.join(unpackedRoot, "resources", "next-server-wrapper.cjs");
if (!fs.existsSync(wrapper)) {
  throw new Error(`Windows package is incomplete. Missing: ${wrapper}`);
}

console.log("Desktop package verification passed.");
