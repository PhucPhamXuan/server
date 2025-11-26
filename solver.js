(function () {
  'use strict';

  // =============== Tạo nút ==================
  const btn = document.createElement("button");
  btn.innerText = "+";
  btn.style.position = "fixed";
  btn.style.bottom = "20px";
  btn.style.right = "20px";
  btn.style.zIndex = 999999;
  btn.style.padding = "10px 16px";
  btn.style.background = "#ff4444";
  btn.style.color = "white";
  btn.style.border = "none";
  btn.style.borderRadius = "8px";
  btn.style.fontSize = "16px";
  btn.style.cursor = "pointer";
  btn.style.boxShadow = "0 3px 10px rgba(0,0,0,0.3)";
  document.body.appendChild(btn);


  // =============== Extract JSON items ==================
  function extractItems() {
    console.log("🔍 Đang tìm items...");

    let scriptNode = [...document.scripts].find(s =>
      /items\s*:/.test(s.textContent || '')
    );

    if (!scriptNode) {
      alert("❌ Không tìm thấy script chứa items!");
      return null;
    }

    const txt = scriptNode.textContent;
    const idx = txt.indexOf('items:');
    if (idx === -1) return null;

    const start = txt.indexOf('[', idx);
    if (start === -1) return null;

    let depth = 0, end = -1;

    for (let i = start; i < txt.length; i++) {
      const ch = txt[i];

      if (ch === '[') depth++;
      else if (ch === ']') {
        depth--;
        if (depth === 0) {
          end = i;
          break;
        }
      }

      if (ch === '"' || ch === "'") {
        const quote = ch;
        i++;
        while (i < txt.length && txt[i] !== quote) {
          if (txt[i] === '\\') i++;
          i++;
        }
      }
    }

    if (end === -1) return null;

    const jsonText = txt.slice(start, end + 1);

    try {
      const items = (new Function('return ' + jsonText))();
      if (Array.isArray(items)) {
        console.log("✔ Đã load items:", items);
        return items;
      }
    } catch (err) {
      console.error("Parse error:", err);
    }

    return null;
  }


  // =============== AUTO FILL ==================
  async function autoFill(items) {
    console.log("🚀 Bắt đầu solve", items.length, "câu");

    const delay = ms => new Promise(r => setTimeout(r, ms));
    const blocks = [...document.querySelectorAll('li.item-block')];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];

      const block = blocks.find(b => {
        const dataId = b.getAttribute('data-id') || b.id || "";
        return dataId.includes(item.defaultQuestionId || item.id || item._id);
      }) || blocks[i];

      if (!block) continue;

      const type = item.elementType || item.type || "";

      // -------------------------- CHOICE --------------------------
      if (type === 'Choice') {
        if (Array.isArray(item.choices)) {
          for (const c of item.choices) {
            if (String(c.point) === '1') {
              const input = block.querySelector(`input[value="${c.answerCode}"]`);
              if (input) {
                input.checked = true;
                input.dispatchEvent(new Event('change', { bubbles: true }));
                input.dispatchEvent(new Event('click', { bubbles: true }));
              }
            }
          }
        }
      }

      // -------------------------- TRUE / FALSE --------------------------
      if (type === 'OnlyTrueFalse' || type === 'OnlyTrueFalseFour') {
        for (const c of item.choices) {
          const answerCode = c.answerCode || c.code || c.id;
          const isTrue = (c.answerTitle + "").toLowerCase() === "true";
          const inputs = block.querySelectorAll(`input[name*="[${answerCode}]"]`);

          for (const input of inputs) {
            const val = input.value.toLowerCase();
            if ((isTrue && val === 'true') || (!isTrue && val === 'false')) {
              input.checked = true;
              input.dispatchEvent(new Event('change', { bubbles: true }));
              input.dispatchEvent(new Event('click', { bubbles: true }));
            }
          }
        }
      }

      // -------------------------- SHORT ANSWER --------------------------
      if (type === 'ShortChoice' || type === 'ShortAnswer') {
        const text = [
          item.answerText1, item.answerText2,
          item.answerText3, item.answerText4,
        ].filter(Boolean);

        const inputs = block.querySelectorAll('input[type="text"], textarea');

        text.forEach((t, idx) => {
          if (inputs[idx]) {
            inputs[idx].value = t.replace(/<[^>]+>/g, '').trim();
            inputs[idx].dispatchEvent(new Event('input', { bubbles: true }));
          }
        });
      }

      // -------------------------- TEXTBOX --------------------------
      if (type === 'Textbox') {
        const answers = item.choices?.map(
          c => (c.answerTitle || c.answerText).replace(/<[^>]+>/g, '').trim()
        );

        const inputs = block.querySelectorAll('input[type="text"], textarea');
        answers?.forEach((ans, idx) => {
          if (inputs[idx]) {
            inputs[idx].value = ans;
            inputs[idx].dispatchEvent(new Event('input', { bubbles: true }));
          }
        });
      }

      // -------------------------- DRAGQA --------------------------
      if (type === 'DragQA') {
        const lefts = [...block.querySelectorAll('.drag-left .text, .drag-content-A .text')];
        const rights = [...block.querySelectorAll('.drag-right .text, .drag-content-B .text')];

        for (const pair of item.choices) {
          const A = (pair.questionA || pair.a || "").replace(/<[^>]+>/g, '').trim();
          const B = (pair.questionB || pair.b || "").replace(/<[^>]+>/g, '').trim();

          const L = lefts.find(e => e.innerText.trim() === A);
          const R = rights.find(e => e.innerText.trim() === B);

          if (L && R) {
            L.click();
            await delay(120);
            R.click();
            await delay(120);
          }
        }
      }

      await delay(100);
    }

    console.log("🎉 Solve xong!");
    alert("✔ DONE!");
  }


  // ======================= KIỂM TRA REMOTE KEY =========================
  async function checkRemoteKey() {
    try {
      const res = await fetch("https://raw.githubusercontent.com/PhucPhamXuan/server/refs/heads/main/code.txt";
      const text = (await res.text()).trim();
      console.log("Key server:", text);

      return text === "pucpx";
    } catch (e) {
      console.error(e);
      return false;
    }
  }


  // =============== Khi BẤM NÚT thì mới chạy ==================
  btn.onclick = async () => {
    console.log("⏳ Kiểm tra quyền chạy solve...");

    const allowed = await checkRemoteKey();

    if (!allowed) {
      alert("❌ Lỗi server");
      return;
    }

    console.log("⏳ Đang load items...");
    const items = extractItems();

    if (!items) {
      alert("Không load được");
      return;
    }

    autoFill(items);
  };

})();
