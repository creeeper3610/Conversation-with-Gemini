const API_KEY_STORAGE_KEY = "gemini_api_key";
const messagesEl = document.getElementById("messages");
const apiKeyInput = document.getElementById("apiKey");
const saveKeyBtn = document.getElementById("saveKeyBtn");
const clearKeyBtn = document.getElementById("clearKeyBtn");
const promptInput = document.getElementById("prompt");
const sendBtn = document.getElementById("sendBtn");
const imageInput = document.getElementById("imageInput");
const imagePreview = document.getElementById("imagePreview");

let attachedImage = null; // { dataUrl, mimeType }
let history = []; // Gemini用の会話履歴

// 初期化：APIキー復元
window.addEventListener("DOMContentLoaded", () => {
  const savedKey = localStorage.getItem(API_KEY_STORAGE_KEY);
  if (savedKey) {
    apiKeyInput.value = savedKey;
  }
});

// APIキー保存
saveKeyBtn.addEventListener("click", () => {
  const key = apiKeyInput.value.trim();
  if (!key) {
    alert("APIキーを入力してください");
    return;
  }
  localStorage.setItem(API_KEY_STORAGE_KEY, key);
  alert("APIキーを保存しました（このブラウザのみ）");
});

// APIキー削除
clearKeyBtn.addEventListener("click", () => {
  localStorage.removeItem(API_KEY_STORAGE_KEY);
  apiKeyInput.value = "";
  alert("APIキーを削除しました");
});

// 画像選択
imageInput.addEventListener("change", () => {
  const file = imageInput.files[0];
  if (!file) {
    attachedImage = null;
    imagePreview.classList.add("hidden");
    imagePreview.innerHTML = "";
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    attachedImage = {
      dataUrl: reader.result,
      mimeType: file.type || "image/png",
    };
    imagePreview.classList.remove("hidden");
    imagePreview.innerHTML = `
      <span>画像を添付中：</span>
      <img src="${attachedImage.dataUrl}" alt="preview" />
      <button id="removeImageBtn">削除</button>
    `;
    document
      .getElementById("removeImageBtn")
      .addEventListener("click", clearImage);
  };
  reader.readAsDataURL(file);
});

function clearImage() {
  attachedImage = null;
  imageInput.value = "";
  imagePreview.classList.add("hidden");
  imagePreview.innerHTML = "";
}

// 送信ボタン
sendBtn.addEventListener("click", sendMessage);
promptInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

function addMessage(role, text, imageDataUrl) {
  const row = document.createElement("div");
  row.className = `message-row ${role}`;

  const avatar = document.createElement("div");
  avatar.className = `avatar ${role}`;
  avatar.textContent = role === "user" ? "U" : "G";

  const bubble = document.createElement("div");
  bubble.className = "bubble";
  bubble.textContent = text || "";

  if (imageDataUrl) {
    const img = document.createElement("img");
    img.src = imageDataUrl;
    bubble.appendChild(img);
  }

  row.appendChild(role === "user" ? bubble : avatar);
  row.appendChild(role === "user" ? avatar : bubble);

  messagesEl.appendChild(row);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

async function sendMessage() {
  const apiKey = apiKeyInput.value.trim();
  const prompt = promptInput.value.trim();

  if (!apiKey) {
    alert("APIキーを入力してください");
    return;
  }
  if (!prompt && !attachedImage) {
    return;
  }

  // ユーザーメッセージを表示
  addMessage("user", prompt, attachedImage?.dataUrl);
  promptInput.value = "";

  // Gemini用の contents を組み立て
  const parts = [];
  if (prompt) {
    parts.push({ text: prompt });
  }
  if (attachedImage) {
    const base64 = attachedImage.dataUrl.split(",")[1];
    parts.push({
      inline_data: {
        mime_type: attachedImage.mimeType,
        data: base64,
      },
    });
  }

  history.push({ role: "user", parts });

  // 画像は一回ごとにクリア
  clearImage();

  // ローディング表示
  const loadingId = Symbol("loading");
  addLoadingBubble(loadingId);

  try {
    const res = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          contents: history,
        }),
      }
    );

    const data = await res.json();
    removeLoadingBubble(loadingId);

    if (data.error) {
      console.error(data.error);
      addMessage("assistant", `エラー: ${data.error.message || "不明なエラー"}`);
      return;
    }

    const text =
      data.candidates?.[0]?.content?.parts
        ?.map((p) => p.text || "")
        .join("") || "(応答なし)";

    addMessage("assistant", text);

    // 会話履歴にアシスタントの応答を追加
    history.push({
      role: "model",
      parts: data.candidates[0].content.parts,
    });
  } catch (e) {
    console.error(e);
    removeLoadingBubble(loadingId);
    addMessage("assistant", "ネットワークエラーが発生しました。");
  }
}

function addLoadingBubble(id) {
  const row = document.createElement("div");
  row.className = "message-row assistant";
  row.dataset.loadingId = String(id);

  const avatar = document.createElement("div");
  avatar.className = "avatar assistant";
  avatar.textContent = "G";

  const bubble = document.createElement("div");
  bubble.className = "bubble";
  bubble.textContent = "考え中…";

  row.appendChild(avatar);
  row.appendChild(bubble);
  messagesEl.appendChild(row);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function removeLoadingBubble(id) {
  const rows = messagesEl.querySelectorAll(".message-row.assistant");
  rows.forEach((row) => {
    if (row.dataset.loadingId === String(id)) {
      row.remove();
    }
  });
}
