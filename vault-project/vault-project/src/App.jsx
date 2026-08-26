import { useState, useEffect, useRef } from "react";
import { Lock, Unlock, Plus, X, Search, Pencil, Trash2, Check, ImageIcon } from "lucide-react";

const CATEGORIES = [
  { id: "nfl", label: "NFL" },
  { id: "mlb", label: "MLB" },
  { id: "nba", label: "NBA" },
  { id: "fifa", label: "FIFA" },
  { id: "starwars", label: "Star Wars" },
  { id: "marvel", label: "Marvel" },
];

const CATEGORY_LABEL = Object.fromEntries(CATEGORIES.map((c) => [c.id, c.label]));

const CATEGORY_THEME = {
  nfl: { accent: "#8C6A46" },
  mlb: { accent: "#4F8F5B" },
  nba: { accent: "#D98A3D" },
  fifa: { accent: "#3C7DBF" },
  starwars: { accent: "#6C7BD9" },
  marvel: { accent: "#B8433A" },
};
const DEFAULT_ACCENT = "#C9A227";

function hexToRgba(hex, alpha) {
  const h = hex.replace("#", "");
  const num = parseInt(h, 16);
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}

// Original, license-free background textures built from CSS gradients -
// evoke each sport/franchise without embedding any outside artwork.
const PATTERNS = {
  nfl: (accent, op) => ({
    image: `radial-gradient(circle, ${hexToRgba(accent, op)} 1.3px, transparent 1.4px)`,
    size: "14px 14px",
  }),
  mlb: (accent, op) => ({
    image: `repeating-linear-gradient(45deg, ${hexToRgba(accent, op)} 0 2px, transparent 2px 18px), repeating-linear-gradient(-45deg, ${hexToRgba(accent, op)} 0 2px, transparent 2px 18px)`,
    size: "22px 22px, 22px 22px",
  }),
  nba: (accent, op) => ({
    image: `radial-gradient(circle, ${hexToRgba(accent, op)} 1.6px, transparent 1.7px), repeating-linear-gradient(45deg, ${hexToRgba(accent, op * 0.8)} 0 2px, transparent 2px 60px), repeating-linear-gradient(-45deg, ${hexToRgba(accent, op * 0.8)} 0 2px, transparent 2px 60px)`,
    size: "20px 20px, 84px 84px, 84px 84px",
  }),
  fifa: (accent, op) => ({
    image: `repeating-linear-gradient(60deg, ${hexToRgba(accent, op)} 0 2px, transparent 2px 30px), repeating-linear-gradient(-60deg, ${hexToRgba(accent, op)} 0 2px, transparent 2px 30px)`,
    size: "52px 52px, 52px 52px",
  }),
  starwars: (accent, op) => {
    const stars = [
      [8, 15, 1.1], [22, 60, 0.8], [35, 10, 1.4], [48, 80, 0.9], [60, 35, 1.2],
      [75, 65, 0.7], [88, 20, 1.3], [95, 90, 0.9], [15, 88, 0.8], [65, 5, 1.0],
      [30, 45, 0.6], [80, 45, 1.1], [5, 70, 0.9], [55, 95, 0.7],
    ];
    const image = stars
      .map(([x, y, r]) => `radial-gradient(circle ${r}px at ${x}% ${y}%, rgba(255,255,255,${Math.min(op * 4, 0.9)}), transparent 60%)`)
      .join(", ");
    return { image, size: "220px 220px" };
  },
  marvel: (accent, op) => ({
    image: `radial-gradient(circle, ${hexToRgba(accent, op)} 1px, transparent 1.3px), repeating-linear-gradient(115deg, ${hexToRgba(accent, op * 0.7)} 0 2px, transparent 2px 26px)`,
    size: "11px 11px, 140px 140px",
  }),
};

const EMPTY_FORM = {
  name: "",
  category: CATEGORIES[0].id,
  subtitle: "",
  year: "",
  set: "",
  price: "",
  condition: "",
  quantity: "1",
  rarity: "",
  notes: "",
  sold: false,
  image: null,
};

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

const API = "/.netlify/functions/cards";

async function apiLoad() {
  const res = await fetch(API);
  if (!res.ok) throw new Error("Failed to load catalog");
  return res.json(); // { cards: [...], hasPassword: bool }
}

async function apiUnlock(password) {
  const res = await fetch(API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "unlock", password }),
  });
  return res.json(); // { ok, created? }
}

async function apiSaveCard(card) {
  const res = await fetch(API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "save", card }),
  });
  return res.json();
}

async function apiDeleteCard(id) {
  const res = await fetch(API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "delete", id }),
  });
  return res.json();
}

async function compressImage(file, maxDim = 640, quality = 0.7) {
  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
  const img = await new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = dataUrl;
  });
  const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
  const w = Math.round(img.width * scale);
  const h = Math.round(img.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0, w, h);
  return canvas.toDataURL("image/jpeg", quality);
}

export default function TradingCardVault() {
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState(CATEGORIES[0].id);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("newest");
  const [bgStrength, setBgStrength] = useState("subtle");

  const [isAdmin, setIsAdmin] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [hasPassword, setHasPassword] = useState(null); // null = unknown yet

  const [selectedCard, setSelectedCard] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [imagePreview, setImagePreview] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    (async () => {
      try {
        const { cards: loaded, hasPassword: pw } = await apiLoad();
        setCards(loaded || []);
        setHasPassword(!!pw);
      } catch (e) {
        setCards([]);
        setHasPassword(false);
      }
      setLoading(false);
    })();
  }, []);

  async function handleUnlock() {
    setPasswordError("");
    if (!hasPassword && !passwordInput.trim()) {
      setPasswordError("Enter a password to set one.");
      return;
    }
    const result = await apiUnlock(passwordInput);
    if (result.ok) {
      setHasPassword(true);
      setIsAdmin(true);
      setShowPasswordModal(false);
      setPasswordInput("");
    } else {
      setPasswordError("That password doesn't match.");
    }
  }

  function openAddForm() {
    setEditingId(null);
    setFormData(EMPTY_FORM);
    setImagePreview(null);
    setShowForm(true);
  }

  function openEditForm(card) {
    setEditingId(card.id);
    setFormData({ ...card, price: String(card.price ?? ""), quantity: String(card.quantity ?? "1") });
    setImagePreview(card.image || null);
    setShowForm(true);
  }

  async function handleImageChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const compressed = await compressImage(file);
    setImagePreview(compressed);
  }

  async function handleSave() {
    if (!formData.name.trim()) return;
    setSaving(true);
    const id = editingId || uid();
    const card = {
      ...formData,
      id,
      price: parseFloat(formData.price) || 0,
      quantity: parseInt(formData.quantity, 10) || 1,
      image: imagePreview,
      createdAt: editingId ? formData.createdAt : Date.now(),
    };
    await apiSaveCard(card);

    let nextCards;
    if (editingId) {
      nextCards = cards.map((c) => (c.id === id ? card : c));
    } else {
      nextCards = [...cards, card];
    }
    setCards(nextCards);
    setSaving(false);
    setShowForm(false);
    setSelectedCard(null);
  }

  async function handleDelete(id) {
    await apiDeleteCard(id);
    const nextCards = cards.filter((c) => c.id !== id);
    setCards(nextCards);
    setDeleteConfirmId(null);
    setSelectedCard(null);
  }

  const filtered = cards
    .filter((c) => c.category === activeCategory)
    .filter((c) => {
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        c.name?.toLowerCase().includes(q) ||
        c.subtitle?.toLowerCase().includes(q) ||
        c.set?.toLowerCase().includes(q) ||
        CATEGORY_LABEL[c.category]?.toLowerCase().includes(q)
      );
    })
    .sort((a, b) => {
      if (sortBy === "price-asc") return a.price - b.price;
      if (sortBy === "price-desc") return b.price - a.price;
      if (sortBy === "name") return (a.name || "").localeCompare(b.name || "");
      return b.createdAt - a.createdAt;
    });

  const activeAccent = CATEGORY_THEME[activeCategory]?.accent || DEFAULT_ACCENT;
  const patternOpacity = bgStrength === "bold" ? 0.30 : 0.10;
  const washAlpha = bgStrength === "bold" ? "3D" : "22";
  const washStyle = `radial-gradient(circle at 50% -10%, ${activeAccent}${washAlpha}, transparent 60%)`;
  const activePattern = PATTERNS[activeCategory] ? PATTERNS[activeCategory](activeAccent, patternOpacity) : null;

  return (
    <div className="vault-root">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600;9..144,700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap');

        .vault-root {
          --bg: #1B1D22;
          --panel: #24262D;
          --panel-alt: #2C2F38;
          --border: #383B45;
          --gold: #C9A227;
          --gold-soft: rgba(201,162,39,0.16);
          --teal: #3FA9A0;
          --red: #C1554A;
          --text: #EDEBE3;
          --text-muted: #9A9CA6;
          background: var(--bg);
          color: var(--text);
          font-family: 'Inter', sans-serif;
          min-height: 100vh;
          padding: 32px 24px 80px;
          box-sizing: border-box;
        }
        .vault-root * { box-sizing: border-box; }
        .vault-root { position: relative; }
        .theme-wash-pattern {
          position: absolute;
          inset: 0;
          z-index: 0;
          pointer-events: none;
          background-repeat: repeat;
          transition: background-image 0.4s ease, background-size 0.4s ease;
        }
        .theme-wash-tint {
          position: absolute;
          inset: 0;
          z-index: 0;
          pointer-events: none;
          background-repeat: no-repeat;
          background-size: cover;
          transition: background-image 0.4s ease;
        }
        .vault-content { position: relative; z-index: 1; }
        .vault-header {
          max-width: 1180px;
          margin: 0 auto 28px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          flex-wrap: wrap;
        }
        .title-badge {
          display: inline-block;
          padding: 14px 30px;
          border-radius: 14px;
          background: linear-gradient(120deg, #2C2F38 0%, #C9A227 35%, #3FA9A0 65%, #2C2F38 100%);
          background-size: 220% 100%;
          background-position: 0% 0%;
          border: 1px solid var(--border);
          box-shadow: 0 8px 20px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.08);
          transition: background-position 0.6s ease;
        }
        .title-badge:hover { background-position: 100% 0%; }
        .vault-title {
          font-family: 'Fraunces', serif;
          font-weight: 700;
          font-size: 34px;
          letter-spacing: 0.5px;
          margin: 0;
          color: var(--text);
          text-shadow: 0 2px 6px rgba(0,0,0,0.5);
        }
        .lock-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          background: var(--panel);
          border: 1px solid var(--border);
          color: var(--text);
          padding: 10px 16px;
          border-radius: 8px;
          cursor: pointer;
          font-family: 'Inter', sans-serif;
          font-size: 13px;
          font-weight: 500;
          transition: border-color 0.15s ease;
        }
        .lock-btn:hover { border-color: var(--gold); }
        .lock-btn.unlocked { color: var(--gold); border-color: var(--gold); }

        .toolbar {
          max-width: 1180px;
          margin: 0 auto 20px;
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
          align-items: center;
          justify-content: space-between;
        }
        .tabs {
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
        }
        .tab {
          font-family: 'JetBrains Mono', monospace;
          font-size: 12px;
          letter-spacing: 0.4px;
          text-transform: uppercase;
          padding: 8px 14px;
          background: var(--panel);
          border: 1px solid var(--border);
          border-bottom: 2px solid var(--border);
          color: var(--text-muted);
          border-radius: 6px 6px 0 0;
          cursor: pointer;
        }
        .tab.active {
          color: var(--bg);
          background: var(--gold);
          border-color: var(--gold);
        }
        .search-sort {
          display: flex;
          gap: 8px;
          align-items: center;
        }
        .search-box {
          display: flex;
          align-items: center;
          gap: 8px;
          background: var(--panel);
          border: 1px solid var(--border);
          border-radius: 8px;
          padding: 8px 12px;
        }
        .search-box input {
          background: transparent;
          border: none;
          outline: none;
          color: var(--text);
          font-family: 'Inter', sans-serif;
          font-size: 13px;
          width: 160px;
        }
        .search-box input::placeholder { color: var(--text-muted); }
        select.sort-select {
          background: var(--panel);
          border: 1px solid var(--border);
          color: var(--text);
          border-radius: 8px;
          padding: 9px 10px;
          font-family: 'Inter', sans-serif;
          font-size: 13px;
        }
        .strength-toggle {
          display: flex;
          background: var(--panel);
          border: 1px solid var(--border);
          border-radius: 8px;
          overflow: hidden;
        }
        .strength-toggle button {
          background: transparent;
          border: none;
          color: var(--text-muted);
          font-family: 'Inter', sans-serif;
          font-size: 12px;
          font-weight: 500;
          padding: 8px 12px;
          cursor: pointer;
        }
        .strength-toggle button.active {
          background: var(--gold);
          color: var(--bg);
          font-weight: 600;
        }
        .add-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          background: var(--gold);
          color: var(--bg);
          border: none;
          border-radius: 8px;
          padding: 9px 16px;
          font-weight: 600;
          font-size: 13px;
          cursor: pointer;
        }

        .grid {
          max-width: 1180px;
          margin: 0 auto;
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
          gap: 18px;
        }
        .card-tile {
          position: relative;
          background: var(--panel);
          border: 1px solid var(--border);
          border-radius: 12px;
          overflow: hidden;
          cursor: pointer;
          transition: transform 0.18s ease, box-shadow 0.18s ease;
        }
        .card-tile:hover {
          transform: translateY(-4px);
          box-shadow: 0 12px 24px rgba(0,0,0,0.35);
        }
        .card-tile:hover .holo {
          opacity: 1;
          background-position: 120% 0;
        }
        .holo {
          position: absolute;
          inset: 0;
          pointer-events: none;
          opacity: 0;
          background: linear-gradient(115deg, transparent 30%, rgba(201,162,39,0.35) 45%, rgba(63,169,160,0.3) 55%, transparent 70%);
          background-size: 250% 100%;
          background-position: -30% 0;
          transition: background-position 0.6s ease, opacity 0.3s ease;
        }
        .card-img-wrap {
          width: 100%;
          aspect-ratio: 5 / 7;
          background: var(--panel-alt);
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
        }
        .card-img-wrap img { width: 100%; height: 100%; object-fit: cover; }
        .card-img-placeholder { color: var(--text-muted); }
        .card-info { padding: 10px 12px 12px; }
        .card-category {
          font-family: 'JetBrains Mono', monospace;
          font-size: 10px;
          letter-spacing: 0.5px;
          text-transform: uppercase;
        }
        .card-name {
          font-family: 'Fraunces', serif;
          font-weight: 600;
          font-size: 15px;
          margin: 2px 0 6px;
          line-height: 1.2;
        }
        .card-meta {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-family: 'JetBrains Mono', monospace;
          font-size: 12px;
          color: var(--text-muted);
        }
        .card-price { color: var(--text); font-weight: 500; }
        .sold-ribbon {
          position: absolute;
          top: 12px;
          right: -32px;
          background: var(--red);
          color: white;
          font-family: 'JetBrains Mono', monospace;
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 1px;
          padding: 3px 36px;
          transform: rotate(45deg);
          text-transform: uppercase;
        }
        .admin-overlay {
          position: absolute;
          top: 8px;
          left: 8px;
          display: flex;
          gap: 6px;
          z-index: 2;
        }
        .icon-btn {
          background: rgba(27,29,34,0.85);
          border: 1px solid var(--border);
          color: var(--text);
          border-radius: 6px;
          width: 28px;
          height: 28px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
        }
        .icon-btn:hover { border-color: var(--gold); }
        .icon-btn.danger:hover { border-color: var(--red); color: var(--red); }
        .icon-btn.confirm:hover { border-color: var(--teal); color: var(--teal); }

        .empty-state {
          max-width: 1180px;
          margin: 60px auto;
          text-align: center;
          color: var(--text-muted);
        }
        .empty-state h3 {
          font-family: 'Fraunces', serif;
          color: var(--text);
          font-size: 22px;
          margin-bottom: 8px;
        }

        .modal-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(10,11,13,0.7);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          z-index: 10;
        }
        .modal {
          background: var(--panel);
          border: 1px solid var(--border);
          border-radius: 14px;
          max-width: 640px;
          width: 100%;
          max-height: 88vh;
          overflow-y: auto;
          padding: 24px;
          position: relative;
        }
        .modal-close {
          position: absolute;
          top: 16px;
          right: 16px;
          background: transparent;
          border: none;
          color: var(--text-muted);
          cursor: pointer;
        }
        .modal-close:hover { color: var(--text); }
        .detail-grid {
          display: grid;
          grid-template-columns: 1fr 1.2fr;
          gap: 20px;
        }
        .detail-img {
          width: 100%;
          aspect-ratio: 5/7;
          background: var(--panel-alt);
          border-radius: 10px;
          overflow: hidden;
        }
        .detail-img img { width: 100%; height: 100%; object-fit: cover; }
        .detail-title {
          font-family: 'Fraunces', serif;
          font-size: 24px;
          font-weight: 700;
          margin: 0 0 2px;
        }
        .detail-sub { color: var(--text-muted); font-size: 13px; margin-bottom: 14px; }
        .stat-row {
          display: flex;
          justify-content: space-between;
          padding: 8px 0;
          border-bottom: 1px solid var(--border);
          font-size: 13px;
        }
        .stat-label {
          color: var(--text-muted);
          font-family: 'JetBrains Mono', monospace;
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.4px;
        }
        .stat-value { font-family: 'JetBrains Mono', monospace; }
        .notes-block { margin-top: 14px; font-size: 13px; line-height: 1.5; color: var(--text); }
        .detail-actions { display: flex; gap: 8px; margin-top: 18px; }
        .btn {
          font-family: 'Inter', sans-serif;
          font-size: 13px;
          font-weight: 600;
          padding: 9px 14px;
          border-radius: 8px;
          cursor: pointer;
          border: 1px solid var(--border);
          background: var(--panel-alt);
          color: var(--text);
        }
        .btn.primary { background: var(--gold); color: var(--bg); border: none; }
        .btn.danger { background: transparent; color: var(--red); border-color: var(--red); }

        .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 16px; }
        .form-field { display: flex; flex-direction: column; gap: 4px; }
        .form-field.full { grid-column: 1 / -1; }
        .form-field label {
          font-family: 'JetBrains Mono', monospace;
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.4px;
          color: var(--text-muted);
        }
        .form-field input, .form-field select, .form-field textarea {
          background: var(--panel-alt);
          border: 1px solid var(--border);
          border-radius: 6px;
          padding: 8px 10px;
          color: var(--text);
          font-family: 'Inter', sans-serif;
          font-size: 13px;
          outline: none;
        }
        .form-field input:focus, .form-field select:focus, .form-field textarea:focus { border-color: var(--gold); }
        .form-field textarea { resize: vertical; min-height: 56px; }
        .checkbox-field { display: flex; align-items: center; gap: 8px; flex-direction: row; }
        .image-upload {
          display: flex;
          align-items: center;
          gap: 14px;
        }
        .image-upload-preview {
          width: 80px;
          height: 112px;
          border-radius: 8px;
          background: var(--panel-alt);
          border: 1px dashed var(--border);
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          flex-shrink: 0;
        }
        .image-upload-preview img { width: 100%; height: 100%; object-fit: cover; }
        .password-modal { max-width: 340px; text-align: center; }
        .password-modal input {
          width: 100%;
          margin-top: 14px;
          background: var(--panel-alt);
          border: 1px solid var(--border);
          border-radius: 8px;
          padding: 10px 12px;
          color: var(--text);
          font-family: 'Inter', sans-serif;
          font-size: 14px;
          outline: none;
        }
        .password-modal input:focus { border-color: var(--gold); }
        .password-error { color: var(--red); font-size: 12px; margin-top: 8px; }
        .password-hint { font-size: 11px; color: var(--text-muted); margin-top: 10px; }

        @media (max-width: 640px) {
          .detail-grid { grid-template-columns: 1fr; }
          .form-grid { grid-template-columns: 1fr; }
        }
      `}</style>

      <div
        className="theme-wash-pattern"
        style={activePattern ? { backgroundImage: activePattern.image, backgroundSize: activePattern.size } : {}}
      />
      <div className="theme-wash-tint" style={{ backgroundImage: washStyle }} />
      <div className="vault-content">

      <div className="vault-header">
        <div className="title-badge">
          <h1 className="vault-title">The Vault</h1>
        </div>
        <button
          className={`lock-btn ${isAdmin ? "unlocked" : ""}`}
          onClick={() => (isAdmin ? setIsAdmin(false) : setShowPasswordModal(true))}
        >
          {isAdmin ? <Unlock size={15} /> : <Lock size={15} />}
          {isAdmin ? "Admin mode" : "Admin"}
        </button>
      </div>

      <div className="toolbar">
        <div className="tabs">
          {CATEGORIES.map((c) => {
            const accent = CATEGORY_THEME[c.id]?.accent || DEFAULT_ACCENT;
            const active = activeCategory === c.id;
            return (
              <div
                key={c.id}
                className={`tab ${active ? "active" : ""}`}
                style={active ? { background: accent, borderColor: accent } : { borderBottomColor: accent }}
                onClick={() => setActiveCategory(c.id)}
              >
                {c.label}
              </div>
            );
          })}
        </div>
        <div className="search-sort">
          {isAdmin && (
            <button className="add-btn" onClick={openAddForm}>
              <Plus size={15} /> Add card
            </button>
          )}
          <div className="search-box">
            <Search size={14} color="var(--text-muted)" />
            <input placeholder="Search cards..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <select className="sort-select" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
            <option value="newest">Newest</option>
            <option value="price-asc">Price: Low to High</option>
            <option value="price-desc">Price: High to Low</option>
            <option value="name">Name A–Z</option>
          </select>
          <div className="strength-toggle">
            <button
              className={bgStrength === "subtle" ? "active" : ""}
              onClick={() => setBgStrength("subtle")}
            >
              Subtle
            </button>
            <button
              className={bgStrength === "bold" ? "active" : ""}
              onClick={() => setBgStrength("bold")}
            >
              Bold
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="empty-state">Loading your collection...</div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <h3>{cards.length === 0 ? "This vault is still empty." : "No cards match that filter."}</h3>
          <p>{cards.length === 0 && isAdmin ? "Add your first card to get started." : cards.length === 0 ? "Check back soon." : "Try a different search or category."}</p>
        </div>
      ) : (
        <div className="grid">
          {filtered.map((card) => (
            <div className="card-tile" key={card.id} onClick={() => setSelectedCard(card)}>
              <div className="holo" />
              {card.sold && <div className="sold-ribbon">Sold</div>}
              {isAdmin && (
                <div className="admin-overlay" onClick={(e) => e.stopPropagation()}>
                  <button className="icon-btn" onClick={() => openEditForm(card)}>
                    <Pencil size={13} />
                  </button>
                  {deleteConfirmId === card.id ? (
                    <>
                      <button className="icon-btn confirm" onClick={() => handleDelete(card.id)}>
                        <Check size={13} />
                      </button>
                      <button className="icon-btn" onClick={() => setDeleteConfirmId(null)}>
                        <X size={13} />
                      </button>
                    </>
                  ) : (
                    <button className="icon-btn danger" onClick={() => setDeleteConfirmId(card.id)}>
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              )}
              <div className="card-img-wrap">
                {card.image ? (
                  <img src={card.image} alt={card.name} />
                ) : (
                  <ImageIcon className="card-img-placeholder" size={28} />
                )}
              </div>
              <div className="card-info">
                <div className="card-category" style={{ color: CATEGORY_THEME[card.category]?.accent || DEFAULT_ACCENT }}>
                  {CATEGORY_LABEL[card.category]}
                </div>
                <div className="card-name">{card.name}</div>
                <div className="card-meta">
                  <span>{card.year || ""}</span>
                  <span className="card-price">{card.price ? `$${Number(card.price).toFixed(2)}` : "—"}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      </div>

      {selectedCard && !showForm && (
        <div className="modal-backdrop" onClick={() => setSelectedCard(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setSelectedCard(null)}>
              <X size={20} />
            </button>
            <div className="detail-grid">
              <div className="detail-img">
                {selectedCard.image ? (
                  <img src={selectedCard.image} alt={selectedCard.name} />
                ) : (
                  <div style={{ display: "flex", height: "100%", alignItems: "center", justifyContent: "center" }}>
                    <ImageIcon color="var(--text-muted)" size={36} />
                  </div>
                )}
              </div>
              <div>
                <div className="card-category" style={{ color: CATEGORY_THEME[selectedCard.category]?.accent || DEFAULT_ACCENT }}>
                  {CATEGORY_LABEL[selectedCard.category]}
                </div>
                <h2 className="detail-title">{selectedCard.name}</h2>
                <p className="detail-sub">{selectedCard.subtitle}</p>
                <div className="stat-row"><span className="stat-label">Year</span><span className="stat-value">{selectedCard.year || "—"}</span></div>
                <div className="stat-row"><span className="stat-label">Set</span><span className="stat-value">{selectedCard.set || "—"}</span></div>
                <div className="stat-row"><span className="stat-label">Condition</span><span className="stat-value">{selectedCard.condition || "—"}</span></div>
                <div className="stat-row"><span className="stat-label">Rarity</span><span className="stat-value">{selectedCard.rarity || "—"}</span></div>
                <div className="stat-row"><span className="stat-label">Quantity</span><span className="stat-value">{selectedCard.quantity ?? "—"}</span></div>
                <div className="stat-row"><span className="stat-label">Price</span><span className="stat-value">{selectedCard.price ? `$${Number(selectedCard.price).toFixed(2)}` : "—"}</span></div>
                <div className="stat-row"><span className="stat-label">Status</span><span className="stat-value">{selectedCard.sold ? "Sold" : "Available"}</span></div>
                {selectedCard.notes && <p className="notes-block">{selectedCard.notes}</p>}
                {isAdmin && (
                  <div className="detail-actions">
                    <button className="btn primary" onClick={() => openEditForm(selectedCard)}>Edit card</button>
                    <button className="btn danger" onClick={() => handleDelete(selectedCard.id)}>Delete</button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {showForm && (
        <div className="modal-backdrop" onClick={() => setShowForm(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setShowForm(false)}>
              <X size={20} />
            </button>
            <h2 className="detail-title">{editingId ? "Edit card" : "Add a card"}</h2>
            <div className="image-upload" style={{ marginTop: 14 }}>
              <div className="image-upload-preview">
                {imagePreview ? <img src={imagePreview} alt="preview" /> : <ImageIcon size={22} color="var(--text-muted)" />}
              </div>
              <div>
                <button className="btn" onClick={() => fileInputRef.current?.click()}>Upload photo</button>
                <input ref={fileInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleImageChange} />
                <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 6 }}>Compressed automatically to keep the catalog fast.</p>
              </div>
            </div>

            <div className="form-grid">
              <div className="form-field full">
                <label>Name</label>
                <input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="Player or character name" />
              </div>
              <div className="form-field">
                <label>Category</label>
                <select value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value })}>
                  {CATEGORIES.map((c) => (
                    <option key={c.id} value={c.id}>{c.label}</option>
                  ))}
                </select>
              </div>
              <div className="form-field">
                <label>Team / subtitle</label>
                <input value={formData.subtitle} onChange={(e) => setFormData({ ...formData, subtitle: e.target.value })} placeholder="e.g. Team, movie, or comic" />
              </div>
              <div className="form-field">
                <label>Year</label>
                <input value={formData.year} onChange={(e) => setFormData({ ...formData, year: e.target.value })} placeholder="2024" />
              </div>
              <div className="form-field">
                <label>Set</label>
                <input value={formData.set} onChange={(e) => setFormData({ ...formData, set: e.target.value })} placeholder="e.g. Topps Chrome" />
              </div>
              <div className="form-field">
                <label>Condition</label>
                <input value={formData.condition} onChange={(e) => setFormData({ ...formData, condition: e.target.value })} placeholder="e.g. PSA 9, Near Mint" />
              </div>
              <div className="form-field">
                <label>Rarity</label>
                <input value={formData.rarity} onChange={(e) => setFormData({ ...formData, rarity: e.target.value })} placeholder="e.g. Refractor, 1st Edition" />
              </div>
              <div className="form-field">
                <label>Price ($)</label>
                <input type="number" step="0.01" value={formData.price} onChange={(e) => setFormData({ ...formData, price: e.target.value })} placeholder="0.00" />
              </div>
              <div className="form-field">
                <label>Quantity</label>
                <input type="number" min="0" value={formData.quantity} onChange={(e) => setFormData({ ...formData, quantity: e.target.value })} />
              </div>
              <div className="form-field full">
                <label>Notes</label>
                <textarea value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} placeholder="Anything else worth noting" />
              </div>
              <div className="form-field full checkbox-field">
                <input type="checkbox" checked={formData.sold} onChange={(e) => setFormData({ ...formData, sold: e.target.checked })} style={{ width: "auto" }} />
                <label style={{ textTransform: "none", fontSize: 13, color: "var(--text)" }}>Mark as sold</label>
              </div>
            </div>

            <div className="detail-actions">
              <button className="btn primary" onClick={handleSave} disabled={saving}>
                {saving ? "Saving..." : editingId ? "Save changes" : "Add to vault"}
              </button>
              <button className="btn" onClick={() => setShowForm(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {showPasswordModal && (
        <div className="modal-backdrop" onClick={() => setShowPasswordModal(false)}>
          <div className="modal password-modal" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setShowPasswordModal(false)}>
              <X size={20} />
            </button>
            <Lock size={22} color="var(--gold)" />
            <h2 className="detail-title" style={{ fontSize: 18, marginTop: 10 }}>
              {hasPassword ? "Enter admin password" : "Set an admin password"}
            </h2>
            <input
              type="password"
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleUnlock()}
              placeholder="Password"
              autoFocus
            />
            {passwordError && <p className="password-error">{passwordError}</p>}
            {!hasPassword && <p className="password-hint">Whatever you type here becomes the admin password.</p>}
            <div className="detail-actions" style={{ justifyContent: "center" }}>
              <button className="btn primary" onClick={handleUnlock}>Unlock</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
