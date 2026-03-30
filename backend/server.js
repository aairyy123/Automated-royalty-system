import express from "express";
import cors from "cors";
import multer from "multer";
import axios from "axios";
import FormData from "form-data";
import dotenv from "dotenv";
import StellarSdk from "stellar-sdk";
import path from "path";
import { fileURLToPath } from "url";
import { db } from "./db.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, ".env") });

const {
  TransactionBuilder,
  Networks,
  BASE_FEE,
  Operation,
  Address,
  xdr,
} = StellarSdk;

const rpcServer = new StellarSdk.rpc.Server(process.env.SOROBAN_RPC, { allowHttp: true });
const NETWORK = Networks.TESTNET;

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

app.use(cors());
app.use(express.json());

console.log("server.js loaded");

app.post("/upload-and-register", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file received" });
    }

    const username = (req.body.username || "").trim();
    const title = (req.body.title || "").trim();
    const hashtags = (req.body.hashtags || "").trim();

    if (!username || !title) {
      return res.status(400).json({ error: "Username and title are required" });
    }

    const formData = new FormData();
    formData.append("file", req.file.buffer, {
      filename: req.file.originalname,
    });

    const pinataRes = await axios.post(
      "https://api.pinata.cloud/pinning/pinFileToIPFS",
      formData,
      {
        maxBodyLength: Infinity,
        headers: {
          ...formData.getHeaders(),
          pinata_api_key: process.env.PINATA_API_KEY,
          pinata_secret_api_key: process.env.PINATA_SECRET_API_KEY,
        },
      }
    );

    const cid = pinataRes.data.IpfsHash;

    db.prepare(`
      INSERT OR IGNORE INTO contents
      (cid, creator, username, title, hashtags, content_type, royalty_percent, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      cid,
      req.body.creator,
      username,
      title,
      hashtags,
      req.body.contentType,
      Number(req.body.royalty),
      new Date().toISOString()
    );

    res.json({ success: true, cid });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Upload failed" });
  }
});

app.delete("/content/:cid", async (req, res) => {
  try {
    const { cid } = req.params;
    const creator = (req.body?.creator || "").trim();

    if (!cid || !creator) {
      return res.status(400).json({ error: "Missing cid or creator" });
    }

    const existing = db.prepare("SELECT cid, creator FROM contents WHERE cid = ?").get(cid);

    if (!existing) {
      return res.status(404).json({ error: "Content not found" });
    }

    if (existing.creator !== creator) {
      return res.status(403).json({ error: "Only creator can remove this content" });
    }

    await axios.delete(`https://api.pinata.cloud/pinning/unpin/${cid}`, {
      headers: {
        pinata_api_key: process.env.PINATA_API_KEY,
        pinata_secret_api_key: process.env.PINATA_SECRET_API_KEY,
      },
    });

    db.prepare("DELETE FROM payments WHERE cid = ?").run(cid);
    db.prepare("DELETE FROM contents WHERE cid = ?").run(cid);

    res.json({ success: true, cid });
  } catch (error) {
    console.error("remove content error:", error?.response?.data || error.message || error);
    res.status(500).json({ error: "Failed to remove content" });
  }
});

app.get("/contents", (req, res) => {
  const rows = db.prepare(`
    SELECT 
      c.cid,
      c.creator,
      COALESCE(NULLIF(c.username, ''), c.creator) AS username,
      COALESCE(NULLIF(c.title, ''), c.content_type, c.cid) AS title,
      c.hashtags,
      c.content_type,
      COALESCE(c.royalty_percent, 0) AS royalty_percent,
      c.created_at,
      COALESCE(SUM(p.amount), 0) AS total_earned
    FROM contents c
    LEFT JOIN payments p ON c.cid = p.cid
    GROUP BY c.cid
    ORDER BY c.created_at DESC
  `).all();

  res.json(rows);
});

app.get("/search", (req, res) => {
  const q = `%${req.query.q || ""}%`;

  const rows = db.prepare(`
    SELECT 
      c.cid,
      c.creator,
      COALESCE(NULLIF(c.username, ''), c.creator) AS username,
      COALESCE(NULLIF(c.title, ''), c.content_type, c.cid) AS title,
      c.hashtags,
      c.content_type,
      c.created_at,
      COALESCE(c.royalty_percent, 0) AS royalty_percent,
      COALESCE(SUM(p.amount), 0) AS total_earned
    FROM contents c
    LEFT JOIN payments p ON c.cid = p.cid
    WHERE c.cid LIKE ?
      OR c.content_type LIKE ?
      OR c.username LIKE ?
      OR c.title LIKE ?
      OR c.hashtags LIKE ?
    GROUP BY c.cid
    ORDER BY c.created_at DESC
  `).all(q, q, q, q, q);

  res.json(rows);
});

app.post("/pay-on-view", async (req, res) => {
  try {
    const { cid, payer, amount } = req.body;

    if (!cid || !payer || !amount) {
      return res.status(400).json({ error: "Missing fields" });
    }

    const account = await rpcServer.getAccount(payer);

    const tx = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase: NETWORK,
    })
      .addOperation(
        Operation.invokeContract({
          contract: process.env.CONTRACT_ID,
          function: "pay_on_view",
          args: [
            xdr.ScVal.scvString(cid),
            Address.fromString(process.env.NATIVE_TOKEN_ADDRESS).toScVal(),
            Address.fromString(payer).toScVal(),
            xdr.ScVal.scvI128(xdr.Int128Parts.fromString(amount.toString())),
          ],
        })
      )
      .setTimeout(30)
      .build();

    res.send(tx.toXDR());
  } catch (error) {
    console.error("pay-on-view error:", error);
    res.status(500).json({ error: error.message });
  }
});

app.post("/submit", async (req, res) => {
  try {
    const { signedXdr, cid, amount, payer } = req.body;

    if (!signedXdr) {
      return res.status(400).json({ error: "Missing signedXdr" });
    }

    const tx = TransactionBuilder.fromXDR(signedXdr, NETWORK);
    const result = await rpcServer.sendTransaction(tx);

    if (cid && amount && payer) {
      db.prepare(`
        INSERT INTO payments (cid, payer, amount, paid_at)
        VALUES (?, ?, ?, ?)
      `).run(cid, payer, Number(amount), new Date().toISOString());
    }

    res.json({ success: true, hash: result.hash });
  } catch (error) {
    console.error("submit error:", error);
    res.status(500).json({ error: error.message });
  }
});

app.get("/creator-earnings/:address", (req, res) => {
  const creator = req.params.address;

  const rows = db.prepare(`
    SELECT 
      c.cid,
      c.creator,
      COALESCE(NULLIF(c.title, ''), c.content_type, c.cid) AS title,
      COALESCE(NULLIF(c.username, ''), c.creator) AS username,
      c.content_type,
      COALESCE(c.royalty_percent, 0) AS royalty_percent,
      COALESCE(SUM(p.amount), 0) AS total_earned
    FROM contents c
    LEFT JOIN payments p ON c.cid = p.cid
    WHERE c.creator = ?
    GROUP BY c.cid
    ORDER BY c.created_at DESC
  `).all(creator);

  const total = rows.reduce((sum, row) => sum + Number(row.total_earned || 0), 0);

  res.json({
    creator,
    total_earned: total,
    contents: rows,
  });
});

app.listen(4000, () => {
  console.log("Backend running on :4000");
});
