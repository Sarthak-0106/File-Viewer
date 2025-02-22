require("dotenv").config();
const express = require("express");
const path = require("path");
const basicAuth = require("express-basic-auth");
const fs = require("fs");
const mime = require("mime-types");

if (!process.env.AUTH_USER || !process.env.AUTH_PASS) {
  console.error("❌ Missing AUTH_USER or AUTH_PASS in .env file");
  process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 8000;

// 🔒 Secure Access with Basic Authentication
app.use(
  basicAuth({
    users: { [process.env.AUTH_USER]: process.env.AUTH_PASS },
    challenge: true,
    unauthorizedResponse: (req) => {
      console.log(`Unauthorized Access Attempt: ${req.ip}`);
      return "🚫 Access Denied: Invalid Username or Password";
    },
  })
);

// 📂 Function to get the correct full path
function getFullPath(requestPath) {
  let fullPath = decodeURIComponent(requestPath);

  // Handle Windows Drive Paths (Convert `/C:/` to `C:/`)
  if (fullPath.startsWith("/") && fullPath[2] === ":") {
    fullPath = fullPath.substring(1);
  }
  
  return path.resolve(fullPath);
}

// 📂 Route to Browse Drives & Files
app.get("*", (req, res) => {
  let requestedPath = getFullPath(req.path);

  // Show available drives (Windows) or `/` (Linux/Mac)
  if (req.path === "/") {
    if (process.platform === "win32") {
      res.send(`
        <h2>📁 Select a Drive</h2>
        <ul>
          <li><a href="/C:/">C:/</a></li>
          <li><a href="/D:/">D:/</a></li>
          <li><a href="/E:/">E:/</a></li>
        </ul>
      `);
    } else {
      res.send(`
        <h2>📁 Root Directory</h2>
        <ul>
          ${fs.readdirSync("/").map((file) => `<li><a href="/${file}">${file}</a></li>`).join("")}
        </ul>
      `);
    }
    return;
  }

  // 🔍 Check if path exists
  if (!fs.existsSync(requestedPath)) {
    return res.status(404).send("❌ Path not found");
  }

  // 📂 If it's a directory, list contents
  if (fs.lstatSync(requestedPath).isDirectory()) {
    let files;
    try {
      files = fs.readdirSync(requestedPath);
    } catch (err) {
      return res.status(403).send("🚫 Access Denied: Cannot read this directory.");
    }

    const fileLinks = files
      .map((file) => {
        const filePath = path.join(req.path, file).replace(/\\/g, "/");
        try {
          const fileStats = fs.statSync(path.join(requestedPath, file));
          const fileSize = (fileStats.size / 1024).toFixed(2) + " KB";
          const lastModified = new Date(fileStats.mtime).toLocaleString();
          return `
            <li>
              <a href="${filePath}">${file}</a> - ${fileSize} | Last Modified: ${lastModified}
            </li>
          `;
        } catch (err) {
          return `<li><span style="color:red;">🚫 Cannot Access: ${file}</span></li>`;
        }
      })
      .join("");

    return res.send(`
      <h2>📁 Browsing: ${requestedPath}</h2>
      <ul>${fileLinks}</ul>
    `);
  }

  // 📄 If it's a file, serve it inline
  const mimeType = mime.lookup(requestedPath) || "application/octet-stream";
  res.setHeader("Content-Type", mimeType);

  const inlineTypes = ["application/pdf", "image/jpeg", "image/png", "text/plain", "text/html"];
  res.setHeader("Content-Disposition", inlineTypes.includes(mimeType) ? "inline" : "attachment");

  res.sendFile(requestedPath);
});

// 🏁 Start the server
app.listen(PORT, "0.0.0.0", () => {
  console.log(`📂 File Browser Running at: http://localhost:${PORT}`);
});
