const express = require("express");
const nodemailer = require("nodemailer");
const multer = require("multer");
const { google } = require("googleapis");
const app = express();
const cors = require("cors");
require("dotenv").config();

// Middleware
app.use(express.json());
app.use(cors());

// Configure Multer for handling file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
  },
});

const upload = multer({ storage });

const oauth2Client = new google.auth.OAuth2(
  process.env.OAUTH_CLIENTID,
  process.env.OAUTH_CLIENT_SECRET,
  process.env.REDIRECT_URI
);

oauth2Client.setCredentials({
  refresh_token: process.env.OAUTH_REFRESH_TOKEN,
});

let transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    type: "OAuth2",
    user: process.env.EMAIL,
    clientId: process.env.OAUTH_CLIENTID,
    clientSecret: process.env.OAUTH_CLIENT_SECRET,
    refreshToken: process.env.OAUTH_REFRESH_TOKEN,
    accessToken: oauth2Client.getAccessToken(),
  },
});

transporter.verify((err, success) => {
  err
    ? console.log(err)
    : console.log(`=== Server is ready to take messages: ${success} ===`);
});

app.post("/send", upload.single("attachment"), function (req, res) {
  const { senderEmail, recipientEmail, subject, message } = req.body;

  let mailOptions = {
    from: senderEmail,
    to: recipientEmail,
    subject: subject,
    text: message,
    attachments: [],
  };

  if (req.file) {
    mailOptions.attachments.push({
      filename: req.file.originalname,
      path: req.file.path,
    });
  }

  transporter.sendMail(mailOptions, function (err, data) {
    if (err) {
      console.error(err);
      res.json({
        status: "fail",
      });
    } else {
      console.log("== Message Sent ==");
      res.json({
        status: "success",
      });
    }
  });
});

app.get("/auth", (req, res) => {
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: "https://www.googleapis.com/auth/gmail.send",
  });

  res.redirect(authUrl);
});

app.get("/callback", async (req, res) => {
  const code = req.query.code;

  try {
    const { tokens } = await oauth2Client.getToken(code);
    console.log("New refresh token:", tokens.refresh_token);
    process.env.OAUTH_REFRESH_TOKEN = tokens.refresh_token;
    oauth2Client.setCredentials(tokens);
    transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        type: "OAuth2",
        user: process.env.EMAIL,
        clientId: process.env.OAUTH_CLIENTID,
        clientSecret: process.env.OAUTH_CLIENT_SECRET,
        refreshToken: tokens.refresh_token,
        accessToken: oauth2Client.getAccessToken(),
      },
    });
    res.redirect("/");
  } catch (err) {
    console.error(err);
    res.redirect("/error.html");
  }
});

const port = 3001;
app.listen(port, () => {
  console.log(`Server is running on port: ${port}`);
});