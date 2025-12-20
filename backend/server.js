import express from "express";
import cors from "cors";
import multer from "multer";
import axios from "axios";
import FormData from "form-data";
import dotenv from "dotenv";
import StellarSdk from "stellar-sdk";
import { db } from "./db.js";

dotenv.config();

/* ---------------- STELLAR ---------------- */



const {
  TransactionBuilder,
  Networks,
  BASE_FEE,
  Operation,
  Address,
  xdr,
} = StellarSdk;

// ✅ THIS IS THE CORRECT SOROBAN RPC CLIENT
const rpcServer = new StellarSdk.rpc.Server(
  process.env.SOROBAN_RPC,
  { allowHttp: true }
);

const NETWORK = Networks.TESTNET;

/* ---------------- APP ---------------- */

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

app.use(cors());
app.use(express.json());

console.log("🔥 server.js loaded");

/* =========================================================
   UPLOAD + REGISTER
========================================================= */
app.post("/upload-and-register", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file received" });
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
      (cid, creator, content_type, royalty_percent, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      cid,
      req.body.creator,
      req.body.contentType,
      Number(req.body.royalty),
      new Date().toISOString()
    );

    res.json({ success: true, cid });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Upload failed" });
  }
});

/* =========================================================
   LIST CONTENT + EARNINGS
========================================================= */
app.get("/contents", (req, res) => {
  const rows = db.prepare(`
    SELECT 
      c.cid,
      c.creator,
      c.content_type,
      c.royalty_percent,
      c.created_at,
      COALESCE(SUM(p.amount), 0) AS total_earned
    FROM contents c
    LEFT JOIN payments p ON c.cid = p.cid
    GROUP BY c.cid
    ORDER BY c.created_at DESC
  `).all();

  res.json(rows);
});

/* =========================================================
   SEARCH
========================================================= */
app.get("/search", (req, res) => {
  const q = `%${req.query.q || ""}%`;

  const rows = db.prepare(`
    SELECT 
      c.cid,
      c.creator,
      c.content_type,
      c.royalty_percent,
      COALESCE(SUM(p.amount), 0) AS total_earned
    FROM contents c
    LEFT JOIN payments p ON c.cid = p.cid
    WHERE c.cid LIKE ? OR c.content_type LIKE ?
    GROUP BY c.cid
  `).all(q, q);

  res.json(rows);
});

/* =========================================================
   PAY ON VIEW → BUILD XDR
========================================================= */
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
            xdr.ScVal.scvI128(
              xdr.Int128Parts.fromString(amount.toString())
            ),
          ],
        })
      )
      .setTimeout(30)
      .build();

    res.send(tx.toXDR());
  } catch (err) {
    console.error("pay-on-view error:", err);
    res.status(500).json({ error: err.message });
  }
});

/* =========================================================
   SUBMIT TX + RECORD PAYMENT
========================================================= */
app.post("/submit", async (req, res) => {
  try {
    const { signedXdr, cid, amount } = req.body;

    if (!signedXdr) {
      return res.status(400).json({ error: "Missing signedXdr" });
    }

    const tx = TransactionBuilder.fromXDR(signedXdr, NETWORK);
    const result = await rpcServer.sendTransaction(tx);

    if (cid && amount) {
      db.prepare(`
        INSERT INTO payments (cid, amount, paid_at)
        VALUES (?, ?, ?)
      `).run(cid, Number(amount), new Date().toISOString());
    }

    res.json({ success: true, hash: result.hash });
  } catch (err) {
    console.error("submit error:", err);
    res.status(500).json({ error: err.message });
  }
});

/* =========================================================
   CREATOR DASHBOARD
========================================================= */
app.get("/creator-earnings/:address", (req, res) => {
  const creator = req.params.address;

  const rows = db.prepare(`
    SELECT 
      c.cid,
      c.content_type,
      COALESCE(SUM(p.amount), 0) AS total_earned
    FROM contents c
    LEFT JOIN payments p ON c.cid = p.cid
    WHERE c.creator = ?
    GROUP BY c.cid
  `).all(creator);

  const total = rows.reduce((s, r) => s + r.total_earned, 0);

  res.json({
    creator,
    total_earned: total,
    contents: rows,
  });
});

/* =========================================================
   START SERVER
========================================================= */
app.listen(4000, () => {
  console.log("🚀 Backend running on :4000");
});
