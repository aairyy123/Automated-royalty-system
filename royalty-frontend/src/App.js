import React, { useState, useEffect } from "react";
import {
  isConnected,
  requestAccess,
  getAddress,
  signTransaction,
} from "@stellar/freighter-api";
import "./App.css";



const BACKEND_URL = "http://localhost:4000";

export default function App() {
  /* ---------------- STATE ---------------- */
  const [wallet, setWallet] = useState("");
  const [file, setFile] = useState(null);
  const [contentType, setContentType] = useState("audio");
  const [royalty, setRoyalty] = useState(10);
  const [contents, setContents] = useState([]);
  const [unlockedCids, setUnlockedCids] = useState({});

  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");

  const [earnings, setEarnings] = useState(null);

  useEffect(() => {
    if (!wallet) return;

    fetch(`${BACKEND_URL}/creator-earnings/${wallet}`)
      .then(res => res.json())
      .then(data => setEarnings(data))
      .catch(() => { });
  }, [wallet]);

  /* ---------------- LOAD CONTENT LIST ---------------- */
  useEffect(() => {
    fetchContents();
  }, []);

  async function fetchContents() {
    try {
      const res = await fetch(`${BACKEND_URL}/contents`);
      const data = await res.json();
      setContents(data);
    } catch (e) {
      console.error("Failed to load contents", e);
    }
  }

  /* ---------------- WALLET ---------------- */
  async function connectWallet() {
    try {
      if (!(await isConnected())) {
        alert("Freighter wallet not detected");
        return;
      }

      await requestAccess();
      const { address } = await getAddress();
      setWallet(address);
    } catch (err) {
      console.error(err);
      alert("Wallet connection failed");
    }
  }

  /* ---------------- UPLOAD + REGISTER ---------------- */
  async function uploadAndRegister() {
    try {
      if (!wallet) {
        alert("Connect wallet first");
        return;
      }

      if (!file) {
        alert("Select a file first");
        return;
      }

      setLoading(true);

      const formData = new FormData();
      formData.append("file", file);
      formData.append("contentType", contentType);
      formData.append("royalty", royalty);
      formData.append("creator", wallet);

      const res = await fetch(`${BACKEND_URL}/upload-and-register`, {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      alert(`✅ Uploaded!\nCID:\n${data.cid}`);

      await fetchContents();
    } catch (err) {
      console.error(err);
      alert("Upload failed");
    } finally {
      setLoading(false);
    }
  }

  /* ---------------- PAY & UNLOCK (TEMP PAY-ON-VIEW) ---------------- */
  async function payAndUnlock(cid, priceStroops) {
    try {
      const { address } = await getAddress();

      // 1️⃣ Get unsigned XDR
      const xdrTx = await fetch(`${BACKEND_URL}/pay-on-view`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cid,
          payer: address,
          amount: priceStroops,
        }),
      }).then(res => res.text());

      // 2️⃣ Sign with Freighter
      const signed = await signTransaction(xdrTx, {
        networkPassphrase: "Test SDF Network ; September 2015",
      });

      // 3️⃣ Submit
      await fetch(`${BACKEND_URL}/submit`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    signedXdr: signed,
    cid,
    amount: priceStroops,
  }),
});

      alert("✅ Payment confirmed on-chain!");
      setUnlockedCids(prev => ({
  ...prev,
  [cid]: true
}));


    } catch (e) {
      console.error(e);
      alert("❌ Payment failed");
    }
  }


  /* ---------------- SEARCH ---------------- */
  async function search() {
    try {
      const res = await fetch(`${BACKEND_URL}/search?q=${query}`);
      const data = await res.json();
      setContents(data);
    } catch (e) {
      console.error("Search failed", e);
    }
  }

  async function withdrawRoyalty(cid) {
  try {
    const xdrTx = await fetch(`${BACKEND_URL}/build-withdraw-xdr`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cid,
        creator: wallet
      }),
    }).then(res => res.text());

    const signed = await signTransaction(xdrTx, {
      networkPassphrase: "Test SDF Network ; September 2015",
    });

    await fetch(`${BACKEND_URL}/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ signedXdr: signed }),
    });

    alert("💰 Royalty withdrawn!");

  } catch (e) {
    console.error(e);
    alert("Withdraw failed");
  }
}


  /* ---------------- UI ---------------- */
  return (
    <div className="app">
      {/* HEADER */}
      <div className="header">
        <h1>🎵 Royalty DApp</h1>
        <button className="wallet-btn" onClick={connectWallet}>
          {wallet ? `Connected: ${wallet.slice(0, 6)}...` : "Connect Wallet"}
        </button>
      </div>

      {/* UPLOAD */}
      <div className="section">
        <h2>📤 Upload Content</h2>
        <div className="upload-grid">
          <input type="file" onChange={(e) => setFile(e.target.files[0])} />

          <select value={contentType} onChange={(e) => setContentType(e.target.value)}>
            <option value="audio">Audio</option>
            <option value="video">Video</option>
            <option value="image">Image</option>
            <option value="pdf">PDF</option>
            <option value="text">Text</option>
          </select>

          <input
            type="number"
            placeholder="Royalty %"
            value={royalty}
            onChange={(e) => setRoyalty(Number(e.target.value))}
          />

          <button className="primary-btn" disabled={loading} onClick={uploadAndRegister}>
            {loading ? "Uploading..." : "Upload & Register"}
          </button>
        </div>
      </div>

      {/* SEARCH */}
      <div className="section">
        <h2>🔍 Discover Content</h2>
        <div className="search-row">
          <input
            placeholder="Search by type or CID"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button className="wallet-btn" onClick={search}>Search</button>
        </div>
      </div>
      {earnings && (
        <>
          <hr />
          <h2>Creator Earnings</h2>
          <p>Total Earned: {earnings.total_earned} stroops</p>

          {earnings.contents.map(c => (
            <div key={c.cid}>
              <p>CID: {c.cid}</p>
              <p>Earned: {c.total_earned}</p>
              <button onClick={() => withdrawRoyalty(c.cid)}>
                Withdraw
              </button>
            </div>
          ))}
        </>
      )}
      {wallet && earnings && earnings.contents.length > 0 && (
  <div className="section">
    <h2>📊 Creator Dashboard</h2>

    <p>
      <strong>Total Earned:</strong>{" "}
      {earnings.total_earned.toLocaleString()} stroops
    </p>

    <div className="card-grid">
      {earnings.contents.map(c => (
        <div key={c.cid} className="card">
          <h3>{c.content_type.toUpperCase()}</h3>

          <div className="meta">
            Royalty: {c.royalty_percent}%
          </div>

          <div className="meta">
            Earned: {c.total_earned.toLocaleString()} stroops
          </div>

          <button
            className="pay-btn"
            onClick={() => withdrawRoyalty(c.cid)}
          >
            💸 Withdraw
          </button>
        </div>
      ))}
    </div>
  </div>
)}



      {/* CONTENT GRID */}
      <div className="section">
        <h2>📚 Marketplace</h2>

        {contents.length === 0 && <p>No content found</p>}

        <div className="card-grid">
          {contents.map((c) => (
            <div key={c.cid} className="card">
              <h3>{c.content_type.toUpperCase()}</h3>
              <div className="meta">Royalty: {c.royalty_percent}%</div>

              {unlockedCids[c.cid] ? (
                <a
                  className="view-link"
                  href={`https://gateway.pinata.cloud/ipfs/${c.cid}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  🔓 View Full Content
                </a>
              ) : wallet ? (
                <button
                  className="pay-btn"
                  onClick={() => payAndUnlock(c.cid, 10_000_000)}
                >
                  💰 Pay & View
                </button>
              ) : (
                <button className="pay-btn disabled" disabled>
                  🔒 Connect wallet to view
                </button>
              )}

            </div>
          ))}
        </div>
      </div>
    </div>
  );

}
