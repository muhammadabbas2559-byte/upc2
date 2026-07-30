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

const unpacked = path.join("dist", "win-unpacked", "resources", "standalone");
if (fs.existsSync(path.join("dist", "win-unpacked"))) {
  for (const file of ["server.js", "node_modules/next/package.json", "node_modules/react/package.json", "node_modules/react-dom/package.json"]) {
    const target = path.join(unpacked, file);
    if (!fs.existsSync(target)) {
      throw new Error(`Windows package is incomplete. Missing: ${target}`);
    }
  }
}

console.log("Desktop package verification passed.");
