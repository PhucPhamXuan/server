(function () {
  'use strict';

  // =============== Tạo nút ==================
  const btn = document.createElement("button");
  btn.innerText = "";
  btn.style.position = "fixed";
  btn.style.bottom = "20px";
  btn.style.right = "20px";
  btn.style.zIndex = "999999";
  btn.style.padding = "10px 16px";
  btn.style.background = "#1a237e";
  btn.style.color = "#fff";
  btn.style.border = "none";
  btn.style.borderRadius = "8px";
  btn.style.fontSize = "14px";
  btn.style.fontWeight = "bold";
  btn.style.cursor = "pointer";
  btn.style.boxShadow = "0 4px 12px rgba(0,0,0,0.3)";
  btn.style.transition = "all 0.3s";
  btn.style.opacity = "0.001";
  document.body.appendChild(btn);

  btn.onmouseenter = () => {
    btn.style.transform = "translateY(-2px)";
    btn.style.boxShadow = "0 6px 16px rgba(0,0,0,0.4)";
  };
  btn.onmouseleave = () => {
    btn.style.transform = "translateY(0)";
    btn.style.boxShadow = "0 4px 12px rgba(0,0,0,0.3)";
  };

  // =============== Extract JSON items ==================
  function extractItems() {
    console.log("🔍 Đang tìm items...");

    // Tìm script chứa items
    let scriptNode = [...document.scripts].find(s =>
      /items\s*:/.test(s.textContent || '')
    );

    if (!scriptNode) {
      console.warn("⚠️ Không tìm thấy script chứa items, thử tìm trong VHV.LMS...");
      
      // Thử tìm trong window object
      if (window.VHV && window.VHV.App && window.VHV.App.modules) {
        for (let module of window.VHV.App.modules) {
          if (module && module.items && Array.isArray(module.items)) {
            console.log("✔ Tìm thấy items trong VHV.App.modules");
            return module.items;
          }
        }
      }
      
      // Thử tìm bằng regex khác
      const scripts = document.getElementsByTagName('script');
      for (let script of scripts) {
        const content = script.textContent;
        if (content) {
          // Tìm patterns phổ biến của K12
          const patterns = [
            /items\s*:\s*(\[[\s\S]*?\])/,
            /VHV\.using[\s\S]*?items\s*:\s*(\[[\s\S]*?\])/,
            /"items"\s*:\s*(\[[\s\S]*?\])/
          ];
          
          for (let pattern of patterns) {
            const match = content.match(pattern);
            if (match) {
              try {
                const items = JSON.parse(match[1].replace(/(\w+):/g, '"$1":'));
                if (Array.isArray(items)) {
                  console.log("✔ Đã load items:", items);
                  return items;
                }
              } catch (e) {
                console.warn("Không parse được JSON từ pattern, thử tiếp...");
              }
            }
          }
        }
      }
      
      alert("❌ Không tìm thấy items trong page!");
      return null;
    }

    const txt = scriptNode.textContent;
    
    // Thử nhiều cách extract JSON
    const extractionMethods = [
      // Method 1: Tìm items: [...]
      () => {
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
        return txt.slice(start, end + 1);
      },
      
      // Method 2: Tìm trong VHV.using
      () => {
        const match = txt.match(/VHV\.using[\s\S]*?items\s*:\s*(\[[\s\S]*?\])/);
        return match ? match[1] : null;
      },
      
      // Method 3: Tìm bằng regex đơn giản
      () => {
        const match = txt.match(/"items"\s*:\s*(\[[\s\S]*?\])/);
        return match ? match[1] : null;
      }
    ];

    let jsonText = null;
    for (let method of extractionMethods) {
      jsonText = method();
      if (jsonText) break;
    }

    if (!jsonText) {
      alert("❌ Không extract được JSON items!");
      return null;
    }

    try {
      // Fix JSON nếu cần
      const fixedJson = jsonText
        .replace(/(\w+):/g, '"$1":')  // Thêm quotes cho keys
        .replace(/,\s*}/g, '}')       // Xóa trailing commas
        .replace(/,\s*\]/g, ']');

      const items = JSON.parse(fixedJson);
      if (Array.isArray(items)) {
        console.log("✔ Đã load items:", items);
        return items;
      }
    } catch (err) {
      console.error("Parse error:", err);
      
      // Thử eval nếu JSON.parse thất bại
      try {
        const items = (new Function('return ' + jsonText))();
        if (Array.isArray(items)) {
          console.log("✔ Đã load items bằng eval:", items);
          return items;
        }
      } catch (err2) {
        console.error("Eval error:", err2);
      }
    }

    return null;
  }

  // =============== AUTO FILL ==================
  async function autoFill(items) {
    console.log("🚀 Bắt đầu solve", items.length, "câu");
    
    // Cập nhật trạng thái button
    btn.innerText = "⏳ Đang fill...";
    btn.style.background = "#f57c00";
    btn.disabled = true;

    const delay = ms => new Promise(r => setTimeout(r, ms));
    
    // Tìm tất cả các block câu hỏi
    const blocks = [...document.querySelectorAll('li.item-block, li.anwser-item, li[id^="question"]')];
    console.log(`📊 Tìm thấy ${blocks.length} blocks, ${items.length} items`);

    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      console.log(`📝 Câu ${i + 1}:`, item);

      const questionId = item._id || item.defaultQuestionId || item.id;
      const type = item.elementType || item.type || "";

      // Tìm block câu hỏi
      let block = null;
      
      // Method 1: Tìm bằng data-id hoặc id
      block = blocks.find(b => {
        const dataId = b.getAttribute('data-id') || b.id || "";
        return dataId.includes(questionId) || b.id === `question${questionId}`;
      });

      // Method 2: Tìm bằng index nếu không tìm thấy
      if (!block && blocks[i]) {
        block = blocks[i];
        console.warn(`⚠️ Câu ${i + 1}: Dùng block theo index`);
      }

      if (!block) {
        console.warn(`⚠️ Câu ${i + 1}: Không tìm thấy block`);
        failCount++;
        continue;
      }

      console.log(`🎯 Câu ${i + 1}: type=${type}, block=${block.id}`);

      try {
        // -------------------------- CHOICE (Radio/Checkbox) --------------------------
        if (type === 'Choice' || !type) {
          let found = false;
          
          if (item.choices) {
            // Xử lý choices dạng object (K12 format)
            const choicesObj = item.choices;
            const correctChoice = Object.values(choicesObj).find(c => c.point === "1" || c.point === 1);
            
            if (correctChoice) {
              const answerValue = correctChoice.answerCode || correctChoice.answerValue;
              console.log(`✅ Câu ${i + 1}: Chọn đáp án ${correctChoice.answerTitle || answerValue}`);
              
              // Tìm input radio
              const radio = block.querySelector(`input[type="radio"][value="${answerValue}"]`);
              if (radio) {
                radio.checked = true;
                radio.dispatchEvent(new Event('change', { bubbles: true }));
                radio.dispatchEvent(new Event('click', { bubbles: true }));
                found = true;
                
                // Thêm class active cho K12 PDF style
                const label = radio.closest('label');
                if (label) {
                  block.querySelectorAll('.choices-text').forEach(span => {
                    span.classList.remove('active');
                  });
                  const choiceText = label.querySelector('.choices-text');
                  if (choiceText) choiceText.classList.add('active');
                }
              }
              
              // Thử tìm bằng name nếu không tìm thấy bằng value
              if (!found) {
                const name = `fields[question${questionId}]`;
                const inputs = block.querySelectorAll(`input[name="${name}"]`);
                if (inputs[answerValue - 1]) {
                  inputs[answerValue - 1].checked = true;
                  inputs[answerValue - 1].dispatchEvent(new Event('change', { bubbles: true }));
                  found = true;
                }
              }
            }
          }
          
          if (found) {
            block.classList.add('isChange');
            successCount++;
          } else {
            failCount++;
          }
        }

        // -------------------------- ONLY TRUE FALSE FOUR --------------------------
        else if (type === 'OnlyTrueFalseFour') {
          console.log(`✅ Câu ${i + 1}: Xử lý OnlyTrueFalseFour`);
          
          if (item.choices && typeof item.choices === 'object') {
            const choices = item.choices;
            let foundCount = 0;
            
            // Duyệt qua các ý (1-4)
            for (let subIndex = 1; subIndex <= 4; subIndex++) {
              const choice = choices[subIndex];
              if (choice) {
                const isTrue = String(choice.answerTitle).toLowerCase() === "true";
                const valueToSelect = isTrue ? "true" : "false";
                
                // Tìm input cho ý này
                const inputName = `fields[question${questionId}][${subIndex}]`;
                const inputs = block.querySelectorAll(`input[name="${inputName}"]`);
                
                for (let input of inputs) {
                  if (input.value === valueToSelect) {
                    input.checked = true;
                    input.dispatchEvent(new Event('change', { bubbles: true }));
                    input.dispatchEvent(new Event('click', { bubbles: true }));
                    foundCount++;
                    
                    // Thêm class active
                    const label = input.closest('label');
                    if (label) {
                      const choiceText = label.querySelector('.choices-text');
                      if (choiceText) choiceText.classList.add('active');
                    }
                    break;
                  }
                }
              }
            }
            
            if (foundCount > 0) {
              block.classList.add('isChange');
              successCount++;
              console.log(`✅ Câu ${i + 1}: Đã chọn ${foundCount}/4 ý`);
            } else {
              failCount++;
            }
          }
        }

        // -------------------------- ONLY TRUE FALSE --------------------------
        else if (type === 'OnlyTrueFalse') {
          console.log(`✅ Câu ${i + 1}: Xử lý OnlyTrueFalse`);
          
          if (item.choices && Array.isArray(item.choices)) {
            for (const choice of item.choices) {
              const isTrue = String(choice.answerTitle).toLowerCase() === "true";
              const answerCode = choice.answerCode || choice.code;
              
              // Tìm input
              const inputs = block.querySelectorAll(`input[name*="[${answerCode}]"]`);
              for (let input of inputs) {
                if ((isTrue && input.value === "true") || (!isTrue && input.value === "false")) {
                  input.checked = true;
                  input.dispatchEvent(new Event('change', { bubbles: true }));
                  input.dispatchEvent(new Event('click', { bubbles: true }));
                  block.classList.add('isChange');
                  successCount++;
                  break;
                }
              }
            }
          }
        }

        // -------------------------- Các dạng khác --------------------------
        else if (type === 'ShortAnswer' || type === 'ShortChoice') {
          const text = [
            item.answerText1, item.answerText2,
            item.answerText3, item.answerText4,
          ].filter(Boolean);

          const inputs = block.querySelectorAll('input[type="text"], textarea');
          text.forEach((t, idx) => {
            if (inputs[idx]) {
              inputs[idx].value = String(t).replace(/<[^>]+>/g, '').trim();
              inputs[idx].dispatchEvent(new Event('input', { bubbles: true }));
              block.classList.add('isChange');
              successCount++;
            }
          });
        }

        else if (type === 'Textbox') {
          if (item.choices && Array.isArray(item.choices)) {
            const answers = item.choices.map(
              c => (c.answerTitle || c.answerText).replace(/<[^>]+>/g, '').trim()
            );

            const inputs = block.querySelectorAll('input[type="text"], textarea');
            answers.forEach((ans, idx) => {
              if (inputs[idx]) {
                inputs[idx].value = ans;
                inputs[idx].dispatchEvent(new Event('input', { bubbles: true }));
                block.classList.add('isChange');
                successCount++;
              }
            });
          }
        }

        else if (type === 'DragQA') {
          const lefts = [...block.querySelectorAll('.drag-left .text, .drag-content-A .text')];
          const rights = [...block.querySelectorAll('.drag-right .text, .drag-content-B .text')];

          if (item.choices && Array.isArray(item.choices)) {
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
                block.classList.add('isChange');
                successCount++;
              }
            }
          }
        }

        // Không xử lý được type
        else {
          console.warn(`⚠️ Câu ${i + 1}: Type "${type}" không được hỗ trợ`);
          failCount++;
        }

      } catch (error) {
        console.error(`❌ Lỗi ở câu ${i + 1}:`, error);
        failCount++;
      }

      await delay(50); // Giảm delay để fill nhanh hơn
    }

    // Thông báo kết quả
    console.log(`🎉 Đã hoàn thành! Thành công: ${successCount}, Thất bại: ${failCount}`);
    
    // Hiển thị thông báo
    const notification = document.createElement('div');
    notification.innerHTML = ``;
    document.body.appendChild(notification);
    
    // Xóa thông báo sau 3 giây
    setTimeout(() => {
      notification.remove();
    }, 3000);

    // Reset button
    btn.innerText = "✅ Đã xong";
    btn.style.background = "#4caf50";
    
    setTimeout(() => {
      btn.innerText = "🔓 Auto Fill";
      btn.style.background = "#1a237e";
      btn.disabled = false;
    }, 2000);

    // Tự động nộp bài sau 2 giây (tùy chọn)
    // setTimeout(() => {
    //   const submitBtn = document.querySelector('.btn-submit');
    //   if (submitBtn) {
    //     console.log("📤 Tự động nộp bài...");
    //     submitBtn.click();
    //   }
    // }, 2000);
  }

  // ======================= KIỂM TRA REMOTE KEY =========================
  async function checkRemoteKey() {
    try {
    //   // Có thể sử dụng local key cho development
    //   const localKey = "pucpx"; // Key mặc định
    //   console.log("✅ Sử dụng local key:", localKey);
    //   return true; // Luôn cho phép chạy
      
    //   // Hoặc sử dụng remote key (comment dòng trên và bỏ comment phần dưới)
      const res = await fetch("https://raw.githubusercontent.com/PhucPhamXuan/server/refs/heads/main/code.txt");
      const text = (await res.text()).trim();
      console.log("🔑 Key server:", text);
      return text === "pucpx";
    } catch (e) {
      console.error("❌ Lỗi kiểm tra key:", e);
      return true; // Vẫn cho chạy nếu không kiểm tra được
    }
  }

  // =============== Khi BẤM NÚT thì mới chạy ==================
  btn.onclick = async () => {
    console.log("⏳ Đang kiểm tra quyền...");

    const allowed = await checkRemoteKey();

    if (!allowed) {
      alert("❌ Không có quyền truy cập!");
      btn.innerText = "❌ Không có quyền";
      btn.style.background = "#f44336";
      setTimeout(() => {
        btn.innerText = "🔓 Auto Fill";
        btn.style.background = "#1a237e";
      }, 2000);
      return;
    }

    console.log("⏳ Đang load items...");
    const items = extractItems();

    if (!items || items.length === 0) {
      alert("❌ Không load được items hoặc không có câu hỏi!");
      btn.innerText = "❌ Lỗi load";
      btn.style.background = "#f44336";
      setTimeout(() => {
        btn.innerText = "🔓 Auto Fill";
        btn.style.background = "#1a237e";
      }, 2000);
      return;
    }

    console.log(`📊 Tổng số câu hỏi: ${items.length}`);
    autoFill(items);
  };

  // Thêm style animation cho notification
  const style = document.createElement('style');
  style.textContent = `
    @keyframes slideIn {
      from {
        transform: translateX(100%);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }
  `;
  document.head.appendChild(style);

})();
