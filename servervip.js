// ==UserScript==
// @name         test
// @namespace    http://tampermonkey.net/
// @version      2025-11-27
// @description  try to take over the world!
// @author       You
// @match        https://*/*
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  // =============== Tạo nút ==================
  const btn = document.createElement("button");
  btn.innerText = "";
  btn.title = "Mode: Giải bài (bấm 2 lần để chuyển sang mode Hoàn thành video)";

  // Trạng thái: 'quiz' = giải bài (mặc định), 'video' = hoàn thành video
  let mode = 'quiz';
  let clickTimer = null;

  Object.assign(btn.style, {
    position: "fixed",
    bottom: "20px",
    right: "20px",
    zIndex: "999999",
    padding: "10px 16px",
    background: "#ffffff",
    color: "#333",
    border: "2px solid transparent",
    borderRadius: "8px",
    fontSize: "16px",
    cursor: "pointer",
    boxShadow: "0 3px 10px rgba(0,0,0,0.3)",
    transition: "background 0.3s, border-color 0.3s",
    userSelect: "none",
  });

  document.body.appendChild(btn);

  function setMode(newMode) {
    mode = newMode;
    if (mode === 'video') {
      btn.innerText = "";
      btn.style.background = "#fffacd"; // vàng nhạt
      btn.style.borderColor = "#f0c040";
      btn.title = "Mode: Hoàn thành video (bấm 2 lần để quay về Giải bài)";
    } else {
      btn.innerText = "";
      btn.style.background = "#ffffff";
      btn.style.borderColor = "transparent";
      btn.title = "Mode: Giải bài (bấm 2 lần để chuyển sang mode Hoàn thành video)";
    }
  }

  // =============== Extract JSON items (cho mode quiz) ==================
  function extractItems() {
    console.log("🔍 Đang tìm items...");
    let scriptNode = [...document.scripts].find(s =>
      /items\s*:/.test(s.textContent || '')
    );
    if (!scriptNode) { alert("❌ Không tìm thấy script chứa items!"); return null; }

    const txt = scriptNode.textContent;
    const idx = txt.indexOf('items:');
    if (idx === -1) return null;
    const start = txt.indexOf('[', idx);
    if (start === -1) return null;

    let depth = 0, end = -1;
    for (let i = start; i < txt.length; i++) {
      const ch = txt[i];
      if (ch === '[') depth++;
      else if (ch === ']') { depth--; if (depth === 0) { end = i; break; } }
      if (ch === '"' || ch === "'") {
        const quote = ch; i++;
        while (i < txt.length && txt[i] !== quote) { if (txt[i] === '\\') i++; i++; }
      }
    }
    if (end === -1) return null;

    const jsonText = txt.slice(start, end + 1);
    try {
      const items = (new Function('return ' + jsonText))();
      if (Array.isArray(items)) { console.log("✔ Đã load items:", items); return items; }
    } catch (err) { console.error("Parse error:", err); }
    return null;
  }

  // =============== AUTO FILL quiz ==================
  async function autoFill(items) {
    console.log("🚀 Bắt đầu solve", items.length, "câu");
    const delay = ms => new Promise(r => setTimeout(r, ms));
    const blocks = [...document.querySelectorAll('li.item-block, li[id^="question"]')];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const questionId = item._id || item.defaultQuestionId || item.id;
      const block = blocks.find(b => {
        const dataId = b.getAttribute('data-id') || b.id || "";
        return dataId.includes(questionId) || b.id === `question${questionId}`;
      }) || blocks[i];

      if (!block) { console.warn(`⚠️ Không tìm thấy block câu ${i + 1}`); continue; }

      const type = item.elementType || item.type || "";

      // CHOICE
      if (type === 'Choice' || !type) {
        if (Array.isArray(item.choices)) {
          for (const c of item.choices) {
            if (String(c.point) === '1') {
              const input = block.querySelector(`input[value="${c.answerCode}"]`);
              if (input) {
                input.checked = true;
                input.dispatchEvent(new Event('change', { bubbles: true }));
                input.dispatchEvent(new Event('click', { bubbles: true }));
                const label = input.closest('label');
                if (label) {
                  block.querySelectorAll('.choices-text').forEach(s => s.classList.remove('active'));
                  const ct = label.querySelector('.choices-text');
                  if (ct) ct.classList.add('active');
                }
                block.classList.add('isChange');
                console.log(`✔️ Câu ${i + 1}: Chọn đáp án ${c.answerTitle || c.answerCode}`);
              }
            }
          }
        } else if (typeof item.choices === 'object') {
          const correctChoice = Object.values(item.choices).find(c => c.point === "1");
          if (correctChoice) {
            const radio = block.querySelector(`input[type="radio"][value="${correctChoice.answerCode}"]`);
            if (radio) {
              radio.checked = true;
              radio.dispatchEvent(new Event('change', { bubbles: true }));
              radio.dispatchEvent(new Event('click', { bubbles: true }));
              const label = radio.closest('label');
              if (label) {
                block.querySelectorAll('.choices-text').forEach(s => s.classList.remove('active'));
                const ct = label.querySelector('.choices-text');
                if (ct) ct.classList.add('active');
              }
              block.classList.add('isChange');
              console.log(`✔️ Câu ${i + 1}: Chọn đáp án ${correctChoice.answerTitle}`);
            }
          }
        }
      }

      // TRUE/FALSE
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

      // SHORT ANSWER
      if (type === 'ShortChoice' || type === 'ShortAnswer') {
        const text = [item.answerText1, item.answerText2, item.answerText3, item.answerText4].filter(Boolean);
        const inputs = block.querySelectorAll('input[type="text"], textarea');
        text.forEach((t, idx) => {
          if (inputs[idx]) {
            inputs[idx].value = t.replace(/<[^>]+>/g, '').trim();
            inputs[idx].dispatchEvent(new Event('input', { bubbles: true }));
          }
        });
      }

      // TEXTBOX
      if (type === 'Textbox') {
        const answers = item.choices?.map(c => (c.answerTitle || c.answerText).replace(/<[^>]+>/g, '').trim());
        const inputs = block.querySelectorAll('input[type="text"], textarea');
        answers?.forEach((ans, idx) => {
          if (inputs[idx]) {
            inputs[idx].value = ans;
            inputs[idx].dispatchEvent(new Event('input', { bubbles: true }));
          }
        });
      }

      // DRAGQA
      if (type === 'DragQA') {
        const lefts = [...block.querySelectorAll('.drag-left .text, .drag-content-A .text')];
        const rights = [...block.querySelectorAll('.drag-right .text, .drag-content-B .text')];
        for (const pair of item.choices) {
          const A = (pair.questionA || pair.a || "").replace(/<[^>]+>/g, '').trim();
          const B = (pair.questionB || pair.b || "").replace(/<[^>]+>/g, '').trim();
          const L = lefts.find(e => e.innerText.trim() === A);
          const R = rights.find(e => e.innerText.trim() === B);
          if (L && R) { L.click(); await delay(120); R.click(); await delay(120); }
        }
      }

      await delay(100);
    }
    console.log("🎉 Solve xong!");
  }

  // =============== AUTO COMPLETE VIDEO ==================
  async function autoCompleteVideo() {
    console.log('🚀 Bắt đầu tự động đánh dấu video hoàn thành...');

    const securityToken = window.VHV?.securityToken;
    if (!securityToken) { console.error('❌ Không tìm thấy securityToken'); alert('❌ Không tìm thấy securityToken'); return; }
    console.log('✅ securityToken:', securityToken);

    let courseResultId = null;
    for (let script of document.querySelectorAll('script')) {
      const content = script.textContent || script.innerText;
      const match = content.match(/courseResultId["']?\s*:\s*["']([^"']+)["']/);
      if (match) { courseResultId = match[1]; break; }
    }
    if (!courseResultId) { console.error('❌ Không tìm thấy courseResultId'); alert('❌ Không tìm thấy courseResultId'); return; }
    console.log('✅ courseResultId:', courseResultId);

    let totalTime = null;
    if (typeof timeComplete !== 'undefined') {
      totalTime = timeComplete;
      console.log('✅ Tìm thấy timeComplete:', totalTime);
    } else {
      const video = document.querySelector('video');
      if (!video) { console.error('❌ Không tìm thấy video element'); alert('❌ Không tìm thấy video element'); return; }
      if (video.readyState < 1) {
        console.log('⏳ Đợi video tải...');
        await new Promise(resolve => video.addEventListener('loadedmetadata', resolve, { once: true }));
      }
      totalTime = Math.floor(video.duration);
      console.log('✅ Thời lượng video từ element:', totalTime);
    }
    if (!totalTime || totalTime <= 0) { console.error('❌ Không xác định được thời lượng video'); alert('❌ Không xác định được thời lượng video'); return; }

    const site = window.VHV?.site || '2003742';
    const urlParams = new URLSearchParams(window.location.search);
    const courseSiteId = urlParams.get('courseSiteId') || site;

    const params = new URLSearchParams({
      courseSiteId: courseSiteId,
      time: totalTime,
      courseResultId: courseResultId,
      'options[courseId]': '',
      'options[scheduleId]': '',
      'options[classroomId]': '',
      'options[contentSharingId]': '',
      site: site,
      securityToken: securityToken
    });

    try {
      const response = await fetch('https://hcm.k12online.vn/api/LMS/Learning/CourseResult/Video/markTime', {
        method: 'POST',
        headers: {
          'Accept': '*/*',
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          'X-Requested-With': 'XMLHttpRequest',
          'Origin': 'https://hcm.k12online.vn',
          'Referer': window.location.href
        },
        credentials: 'include',
        body: params
      });
      const text = await response.text();
      console.log('📤 Status:', response.status);
      console.log('📥 Response:', text);
      if (response.ok) {
        console.log('🎉 Đã đánh dấu video hoàn thành 100%!');
        alert('🎉 Đã đánh dấu video hoàn thành 100%!');
      } else {
        console.error('❌ Request thất bại');
        alert('❌ Request thất bại: ' + response.status);
      }
    } catch (err) {
      console.error('❌ Lỗi fetch:', err);
      alert('❌ Lỗi fetch: ' + err.message);
    }
  }

  // ======================= KIỂM TRA REMOTE KEY =========================
  async function checkRemoteKey() {
    try {
      const res = await fetch("https://raw.githubusercontent.com/PhucPhamXuan/server/refs/heads/main/code.txt");
      const text = (await res.text()).trim();
      console.log("Key server:", text);
      return text === "pucpx";
    } catch (e) {
      console.error(e);
      return false;
    }
  }

  // =============== XỬ LÝ CLICK (single / double) ==================
  btn.addEventListener('click', (e) => {
    if (clickTimer) {
      // Double click → đổi mode
      clearTimeout(clickTimer);
      clickTimer = null;
      if (mode === 'quiz') {
        setMode('video');
        console.log("🔄 Chuyển sang mode: Hoàn thành video 🎬");
      } else {
        setMode('quiz');
        console.log("🔄 Chuyển sang mode: Giải bài ✏️");
      }
    } else {
      // Bấm lần 1 – chờ xem có double click không
      clickTimer = setTimeout(async () => {
        clickTimer = null;

        if (mode === 'quiz') {
          // ---- Mode giải bài ----
          console.log("⏳ Kiểm tra quyền chạy solve...");
          const allowed = await checkRemoteKey();
          if (!allowed) { alert("❌ Lỗi server hoặc không có quyền!"); return; }
          console.log("⏳ Đang load items...");
          const items = extractItems();
          if (!items) { alert("❌ Không load được items!"); return; }
          autoFill(items);
        } else {
          // ---- Mode hoàn thành video ----
          autoCompleteVideo();
        }
      }, 300); // 300ms để phân biệt single vs double click
    }
  });

})();
