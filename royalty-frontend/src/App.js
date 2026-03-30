import React, { useEffect, useState } from "react";
import {
  getAddress,
  isConnected,
  requestAccess,
  signTransaction,
} from "@stellar/freighter-api";
import "./App.css";

const BACKEND_URL = "http://localhost:4000";
const DEFAULT_ACCESS_PRICE = 10_000_000;

export default function App() {
  const [wallet, setWallet] = useState("");
  const [activePage, setActivePage] = useState("welcome");
  const [username, setUsername] = useState(localStorage.getItem("royalty-username") || "");
  const [file, setFile] = useState(null);
  const [title, setTitle] = useState("");
  const [hashtags, setHashtags] = useState("");
  const [contentType, setContentType] = useState("audio");
  const [royalty, setRoyalty] = useState(10);
  const [contents, setContents] = useState([]);
  const [unlockedCids, setUnlockedCids] = useState({});
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [earnings, setEarnings] = useState(null);

  useEffect(() => {
    fetchContents();
  }, []);

  useEffect(() => {
    if (!wallet && activePage === "app") {
      setActivePage("welcome");
    }
  }, [wallet, activePage]);

  useEffect(() => {
    if (!wallet) {
      setEarnings(null);
      return;
    }

    fetchCreatorEarnings(wallet);
  }, [wallet]);

  async function fetchCreatorEarnings(address) {
    try {
      const res = await fetch(`${BACKEND_URL}/creator-earnings/${address}`);
      const data = await res.json();
      setEarnings(data);
    } catch (error) {
      console.error("Failed to load creator earnings", error);
    }
  }

  async function fetchContents() {
    try {
      const res = await fetch(`${BACKEND_URL}/contents`);
      const data = await res.json();
      setContents(data);
    } catch (error) {
      console.error("Failed to load contents", error);
    }
  }

  async function connectWallet() {
    try {
      if (!(await isConnected())) {
        alert("Freighter wallet not detected");
        return;
      }

      await requestAccess();
      const { address } = await getAddress();
      setWallet(address);
    } catch (error) {
      console.error(error);
      alert("Wallet connection failed");
    }
  }

  function disconnectWallet() {
    setWallet("");
    setUnlockedCids({});
    setEarnings(null);
    setActivePage("welcome");
  }

  function updateUsername(value) {
    setUsername(value);
    localStorage.setItem("royalty-username", value);
  }

  async function uploadAndRegister() {
    try {
      if (!wallet) {
        alert("Connect wallet first");
        return;
      }

      if (!username.trim()) {
        alert("Enter a username");
        return;
      }

      if (!title.trim()) {
        alert("Enter a content title");
        return;
      }

      if (!file) {
        alert("Select a file first");
        return;
      }

      setLoading(true);

      const normalizedUsername = username.trim();
      const normalizedTitle = title.trim();
      const normalizedHashtags = hashtags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean)
        .join(", ");

      const formData = new FormData();
      formData.append("file", file);
      formData.append("username", normalizedUsername);
      formData.append("title", normalizedTitle);
      formData.append("hashtags", normalizedHashtags);
      formData.append("contentType", contentType);
      formData.append("royalty", royalty);
      formData.append("creator", wallet);

      const res = await fetch(`${BACKEND_URL}/upload-and-register`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Upload failed");
      }

      localStorage.setItem("royalty-username", normalizedUsername);
      setTitle("");
      setHashtags("");
      setFile(null);

      alert(`Uploaded successfully. CID: ${data.cid}`);

      await fetchContents();
      await fetchCreatorEarnings(wallet);
    } catch (error) {
      console.error(error);
      alert(error.message || "Upload failed");
    } finally {
      setLoading(false);
    }
  }

  async function removeContent(cid) {
    try {
      if (!wallet) {
        alert("Connect wallet first");
        return;
      }

      const confirmed = window.confirm("Remove this content from IPFS and dashboard?");
      if (!confirmed) {
        return;
      }

      const res = await fetch(`${BACKEND_URL}/content/${cid}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ creator: wallet }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to remove content");
      }

      setUnlockedCids((prev) => {
        const next = { ...prev };
        delete next[cid];
        return next;
      });

      await fetchContents();
      await fetchCreatorEarnings(wallet);
      alert("Content removed from IPFS.");
    } catch (error) {
      console.error(error);
      alert(error.message || "Failed to remove content");
    }
  }

  async function payAndUnlock(cid, priceStroops) {
    try {
      if (!wallet) {
        alert("Connect wallet first");
        return;
      }

      const { address } = await getAddress();

      const xdrTx = await fetch(`${BACKEND_URL}/pay-on-view`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cid,
          payer: address,
          amount: priceStroops,
        }),
      }).then((res) => res.text());

      const signed = await signTransaction(xdrTx, {
        networkPassphrase: "Test SDF Network ; September 2015",
      });

      const submitRes = await fetch(`${BACKEND_URL}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          signedXdr: signed,
          cid,
          amount: priceStroops,
          payer: address,
        }),
      });
      const submitData = await submitRes.json();

      if (!submitRes.ok) {
        throw new Error(submitData.error || "Payment failed");
      }

      alert("Payment confirmed on-chain.");
      setUnlockedCids((prev) => ({
        ...prev,
        [cid]: true,
      }));

      await fetchContents();
      if (wallet) {
        await fetchCreatorEarnings(wallet);
      }
    } catch (error) {
      console.error(error);
      alert("Payment failed");
    }
  }

  async function search() {
    try {
      if (!query.trim()) {
        await fetchContents();
        return;
      }

      const res = await fetch(`${BACKEND_URL}/search?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      setContents(data);
    } catch (error) {
      console.error("Search failed", error);
    }
  }

  async function withdrawRoyalty(cid) {
    try {
      const xdrTx = await fetch(`${BACKEND_URL}/build-withdraw-xdr`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cid,
          creator: wallet,
        }),
      }).then((res) => res.text());

      const signed = await signTransaction(xdrTx, {
        networkPassphrase: "Test SDF Network ; September 2015",
      });

      await fetch(`${BACKEND_URL}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signedXdr: signed }),
      });

      alert("Royalty withdrawn.");
    } catch (error) {
      console.error(error);
      alert("Withdraw failed");
    }
  }

  const creatorContents = earnings?.contents || [];
  const creatorContentCards = creatorContents.length > 0
    ? creatorContents
    : contents.filter((content) => content.creator === wallet);
  const paidCreatorContents = creatorContents.filter((content) => Number(content.total_earned || 0) > 0);
  const canWithdrawAny = Number(earnings?.total_earned || 0) > 0;

  const creatorUsernameByAddress = contents.reduce((accumulator, content) => {
    const name = String(content.username || "").trim();
    if (name) {
      accumulator[content.creator] = name;
    }
    return accumulator;
  }, {});

  function resolveTitle(content) {
    const value = String(content?.title || "").trim();
    if (value) {
      return value;
    }
    const type = String(content?.content_type || "").trim();
    if (type) {
      return type;
    }
    return content?.cid || "Untitled";
  }

  function resolveRoyalty(content) {
    const value = Number(content?.royalty_percent);
    return Number.isFinite(value) ? value : 0;
  }

  function resolveUsername(content, isOwner) {
    const fromContent = String(content?.username || "").trim();
    if (fromContent) {
      return fromContent;
    }

    if (isOwner) {
      const fromInput = String(username || "").trim();
      if (fromInput) {
        return fromInput;
      }
    }

    if (content?.creator && creatorUsernameByAddress[content.creator]) {
      return creatorUsernameByAddress[content.creator];
    }

    return content?.creator || "Unknown";
  }

  function goToAppPage() {
    if (!wallet) {
      alert("Connect wallet first");
      return;
    }
    setActivePage("app");
  }

  if (activePage === "welcome") {
    return (
      <div className="welcome-page">
        <div className="welcome-card">
          <h1>Welcome to Content World</h1>
          <p>Search more for Values. Connect your wallet and start exploring premium creator content.</p>

          <div className="welcome-actions">
            <button className="wallet-btn" type="button" onClick={connectWallet}>
              {wallet ? `Connected ${wallet.slice(0, 6)}...` : "Connect Wallet"}
            </button>
            <button className="primary-btn" type="button" onClick={goToAppPage}>
              Let&apos;s Explore
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <div className="header">
        <h1>Royalty DApp</h1>
        <div className="header-actions">
          <button className="back-btn" type="button" onClick={() => setActivePage("welcome")}>
            Back
          </button>
          <input
            className="username-top-input"
            type="text"
            placeholder="Username"
            value={username}
            onChange={(event) => updateUsername(event.target.value)}
          />

          {wallet ? (
            <button className="wallet-btn" type="button" onClick={disconnectWallet}>
              Disconnect {wallet.slice(0, 6)}...
            </button>
          ) : (
            <button className="wallet-btn" type="button" onClick={connectWallet}>
              Connect Wallet
            </button>
          )}
        </div>
      </div>

      <div className="section section-upload">
        <h2>Upload Content</h2>
        <div className="upload-grid">
          <input
            type="text"
            placeholder="Content title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />

          <input
            type="text"
            placeholder="Hashtags separated by commas"
            value={hashtags}
            onChange={(event) => setHashtags(event.target.value)}
          />

          <input type="file" onChange={(event) => setFile(event.target.files[0] || null)} />

          <select value={contentType} onChange={(event) => setContentType(event.target.value)}>
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
            onChange={(event) => setRoyalty(Number(event.target.value))}
          />

          <button className="primary-btn" type="button" disabled={loading} onClick={uploadAndRegister}>
            {loading ? "Uploading..." : "Upload & Register"}
          </button>
        </div>
      </div>

      <div className="section section-discover">
        <h2>Discover Content</h2>
        <div className="search-row">
          <input
            placeholder="Search by username, hashtag, title, type, or CID"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <button className="wallet-btn" type="button" onClick={search}>
            Search
          </button>
        </div>
      </div>

      {earnings && (
        <div className="section section-earnings">
          <h2>My Earnings</h2>
          <p>Total Earned: {Number(earnings.total_earned || 0).toLocaleString()} stroops</p>

          {paidCreatorContents.length === 0 ? (
            <p>No royalty payments yet. Earnings will increase when others pay to access your content.</p>
          ) : (
            paidCreatorContents.map((content) => (
              <div key={`earning-${content.cid}`} className="earning-row">
                <p>Title: {resolveTitle(content)}</p>
                <p>Username: {resolveUsername(content, true)}</p>
                <p>CID: {content.cid}</p>
                <p>Total Paid by Others: {Number(content.total_earned || 0).toLocaleString()} stroops</p>
                <button
                  type="button"
                  disabled={Number(content.total_earned || 0) <= 0 || !canWithdrawAny}
                  onClick={() => withdrawRoyalty(content.cid)}
                >
                  Withdraw
                </button>
              </div>
            ))
          )}
        </div>
      )}

      {wallet && (
        <div className="section section-dashboard">
          <h2>Creator Content Dashboard</h2>
          {creatorContentCards.length === 0 ? (
            <p>No creator content found yet.</p>
          ) : (
          <div className="card-grid">
            {creatorContentCards.map((content) => {
              const contentEarned = Number(content.total_earned || 0);
              const isOwner = wallet && content.creator === wallet;

              return (
                <div key={`creator-${content.cid}`} className="card">
                  <h3>Content Title: {resolveTitle(content)}</h3>
                  <div className="meta">Creator Username: {resolveUsername(content, Boolean(isOwner))}</div>
                  <div className="meta">Royalty Amount: {resolveRoyalty(content)}%</div>
                  <div className="meta">CID: {content.cid}</div>
                  <div className="meta">Total Paid by Others: {contentEarned.toLocaleString()} stroops</div>

                  <button
                    className="pay-btn"
                    type="button"
                    disabled={contentEarned <= 0}
                    onClick={() => withdrawRoyalty(content.cid)}
                  >
                    Withdraw Earnings
                  </button>

                  <button
                    className="remove-btn"
                    type="button"
                    onClick={() => removeContent(content.cid)}
                  >
                    Remove from IPFS
                  </button>
                </div>
              );
            })}
          </div>
          )}
        </div>
      )}

      <div className="section section-marketplace">
        <h2>Content Market</h2>

        {contents.length === 0 && <p>No content found</p>}

        <div className="card-grid">
          {contents.map((content) => {
            const isOwner = wallet && content.creator === wallet;
            const isUnlocked = Boolean(unlockedCids[content.cid]) || Boolean(isOwner);

            return (
              <div key={`market-${content.cid}`} className="card">
                <h3>{resolveTitle(content)}</h3>
                <div className="meta">Username: {resolveUsername(content, Boolean(isOwner))}</div>
                <div className="meta">Royalty: {resolveRoyalty(content)}%</div>

                {isUnlocked ? (
                  <a
                    className="view-link"
                    href={`https://gateway.pinata.cloud/ipfs/${content.cid}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    View Full Content
                  </a>
                ) : wallet ? (
                  <button
                    className="pay-btn"
                    type="button"
                    onClick={() => payAndUnlock(content.cid, DEFAULT_ACCESS_PRICE)}
                  >
                    Pay & View
                  </button>
                ) : (
                  <button className="pay-btn disabled" type="button" disabled>
                    Connect wallet to pay and access
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
