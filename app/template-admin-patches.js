(() => {
  const cfg = window.COACH_APP_CONFIG || {};
  const scheduleCfg = cfg.schedule || {};
  const ratesCfg = cfg.rates || {};
  const brandCfg = cfg.brand || {};
  const locationCfg = cfg.location || {};
  const assetsCfg = cfg.assets || {};

  const startHour = Number.isFinite(Number(scheduleCfg.startHour)) ? Number(scheduleCfg.startHour) : 8;
  const endHour = Number.isFinite(Number(scheduleCfg.endHour)) ? Number(scheduleCfg.endHour) : 24;
  const slotCount = Math.max(0, endHour - startHour);
  const slug = String(brandCfg.shortName || brandCfg.name || "coaching").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "coaching";
  const primary = brandCfg.primaryColor || "#111111";
  const accent = brandCfg.accentColor || "#f5c400";

  function configuredRate(players) {
    const n = Number(players || 1);
    const defs = [ratesCfg.solo, ratesCfg.partners, ratesCfg.group].filter(Boolean);
    const match = defs.find(r => n >= Number(r.minPlayers) && n <= Number(r.maxPlayers));
    return Number(match?.amount || 0);
  }

  function configuredType(players) {
    const n = Number(players || 1);
    const defs = [ratesCfg.solo, ratesCfg.partners, ratesCfg.group].filter(Boolean);
    const match = defs.find(r => n >= Number(r.minPlayers) && n <= Number(r.maxPlayers));
    if (!match) return "Pickleball Coaching";
    if (Number(match.minPlayers) === 1 && Number(match.maxPlayers) === 1) return match.label || "1-on-1";
    const range = Number(match.minPlayers) === Number(match.maxPlayers) ? `${match.minPlayers}` : `${match.minPlayers}–${match.maxPlayers}`;
    return `${match.label || "Group"} (${range} Players)`;
  }

  function applyAdminTemplatePatches() {
    try {
      renderSlots = function () {
        slotList.innerHTML = "";
        const c = { available: 0, booked: 0, unavailable: 0 };
        for (let h = startHour; h < endHour; h++) {
          const r = rowsByHour.get(h) || { status: "available" };
          c[r.status]++;
          const div = document.createElement("div");
          div.className = "admin-slot";
          const label = r.status === "booked" ? (r.client_name || "Booked session") : r.status === "unavailable" ? "Blocked time" : "Open";
          div.innerHTML = `<div class="time">${hourLabel(h)}</div><span class="badge ${r.status}">${r.status}</span><div class="client-mini">${label}</div><button class="edit-btn">Edit</button>`;
          div.querySelector("button").onclick = () => openEditor(h);
          slotList.appendChild(div);
        }
        $("availableCount").textContent = c.available;
        $("bookedCount").textContent = c.booked;
        $("unavailableCount").textContent = c.unavailable;
      };

      loadBookingAvailability = async function () {
        const d = $("bookingDate").value;
        if (!d) return;
        const slots = await fetchSlots(d), map = new Map(slots.map(r => [Number(r.start_hour), r.status]));
        const start = $("bookingStart"), end = $("bookingEnd");
        start.innerHTML = "";
        for (let h = startHour; h < endHour; h++) {
          if ((map.get(h) || "available") === "available") {
            const o = document.createElement("option");
            o.value = h;
            o.textContent = hourName(h);
            start.appendChild(o);
          }
        }
        if (!start.options.length) {
          $("bookingHint").textContent = "No available starting time on this date.";
          end.innerHTML = "";
          return;
        }
        populateEnd(map);
        updateTotal();
      };

      populateEnd = function (map) {
        const s = Number($("bookingStart").value), end = $("bookingEnd");
        end.innerHTML = "";
        for (let e = s + 1; e <= endHour; e++) {
          let ok = true;
          for (let h = s; h < e; h++) {
            if ((map.get(h) || "available") !== "available") { ok = false; break; }
          }
          if (!ok) break;
          const o = document.createElement("option");
          o.value = e;
          o.textContent = hourName(e);
          end.appendChild(o);
        }
        $("bookingHint").textContent = `Available consecutive time from ${hourName(s)}.`;
      };

      updateRate = function () {
        const n = Number($("participantCount").value);
        if ($("rateMode").value === "standard") {
          $("ratePerPerson").value = configuredRate(n);
          $("ratePerPerson").readOnly = true;
        } else {
          $("ratePerPerson").readOnly = false;
        }
        updateTotal();
      };

      updateTotal = function () {
        const s = Number($("bookingStart").value || startHour), e = Number($("bookingEnd").value || s + 1), hrs = Math.max(1, e - s), n = Number($("participantCount").value || 1), r = Number($("ratePerPerson").value || 0), t = hrs * n * r;
        $("bookingTotal").textContent = peso(t);
        $("bookingCalc").textContent = `${hrs} hr × ${n} player(s) × ${peso(r)}`;
      };

      adminDayState = function (map, date) {
        let booked = 0, unavailable = 0, available = 0;
        for (let h = startHour; h < endHour; h++) {
          const s = map.get(`${date}|${h}`) || "available";
          if (s === "booked") booked++;
          else if (s === "unavailable") unavailable++;
          else available++;
        }
        if (slotCount > 0 && booked === slotCount) return { cls: "full-booked", label: "Fully booked" };
        if (available === 0) return { cls: "full-unavailable", label: "No availability" };
        if (booked > 0) return { cls: "partial-booked", label: `${booked} booked` };
        if (unavailable > 0) return { cls: "partial-unavailable", label: "Limited" };
        return { cls: "", label: "Open" };
      };

      fillHours($("blockStart"), startHour, Math.max(startHour, endHour - 1));
      fillHours($("blockEnd"), Math.min(endHour, startHour + 1), endHour);
      $("blockEnd").value = String(endHour);
      $("participantCount").onchange = updateRate;
      $("rateMode").onchange = updateRate;
      $("ratePerPerson").oninput = updateTotal;
      $("bookingDate").onchange = loadBookingAvailability;
      $("bookingStart").onchange = async () => {
        const slots = await fetchSlots($("bookingDate").value), map = new Map(slots.map(r => [Number(r.start_hour), r.status]));
        populateEnd(map);
        updateTotal();
      };
      $("bookingEnd").onchange = updateTotal;

      document.querySelectorAll("[data-preset]").forEach(b => {
        b.onclick = () => {
          const presets = {
            whole: [startHour, endHour],
            morning: [startHour, Math.min(12, endHour)],
            afternoon: [Math.max(startHour, 12), Math.min(17, endHour)],
            evening: [Math.max(startHour, 17), endHour]
          };
          const m = presets[b.dataset.preset] || presets.whole;
          $("blockStart").value = String(m[0]);
          $("blockEnd").value = String(Math.max(m[0] + 1, m[1]));
        };
      });

      const rateNote = document.querySelector(".admin-rate-note");
      if (rateNote) {
        const defs = [ratesCfg.solo, ratesCfg.partners, ratesCfg.group].filter(Boolean);
        rateNote.textContent = `Standard: ${defs.map(r => {
          const range = Number(r.minPlayers) === Number(r.maxPlayers) ? `${r.minPlayers} player` : `${r.minPlayers}–${r.maxPlayers} players`;
          return `${range} ${peso(r.amount)}${Number(r.minPlayers) === 1 && Number(r.maxPlayers) === 1 ? "/hr" : " each/hr"}`;
        }).join(" • ")}. ${cfg.courtFee?.included ? "Court fee included." : "Court fee is separate."}`;
      }

      initPublicQr = function () {
        const box = $("publicQrCode");
        if (!box || typeof QRCode === "undefined") return;
        const url = cfg.publicSiteUrl || window.location.href.replace(/admin\.html.*$/, "");
        box.innerHTML = "";
        new QRCode(box, { text: url, width: 150, height: 150, colorDark: primary, colorLight: "#ffffff", correctLevel: QRCode.CorrectLevel.H });
        const display = document.querySelector(".qr-tool-copy strong");
        if (display) display.textContent = url.replace(/^https?:\/\//, "").replace(/\/$/, "");
      };

      if ($("downloadPublicQr")) $("downloadPublicQr").onclick = () => {
        const box = $("publicQrCode"), src = box?.querySelector("canvas")?.toDataURL("image/png") || box?.querySelector("img")?.src;
        if (!src) return alert("QR is still loading. Try again.");
        const a = document.createElement("a");
        a.href = src;
        a.download = `${slug}-public-site-qr.png`;
        a.click();
      };

      generateConfirmationCard = async function (b) {
        const c = document.createElement("canvas");
        c.width = 1080; c.height = 1350;
        const x = c.getContext("2d");
        x.fillStyle = primary; x.fillRect(0, 0, c.width, c.height);
        x.fillStyle = accent; x.fillRect(0, 0, c.width, 18); x.fillRect(0, 1332, c.width, 18);
        try {
          const logo = await canvasImage(assetsCfg.emblem || assetsCfg.logo || "brand-placeholder.svg");
          x.drawImage(logo, 70, 70, 150, 150);
        } catch {}
        x.fillStyle = accent; x.font = "800 28px Manrope, Arial"; x.fillText(String(brandCfg.shortName || brandCfg.name || "COACHING").toUpperCase(), 250, 120);
        x.fillStyle = "#fff"; x.font = "800 54px Manrope, Arial"; x.fillText("BOOKING CONFIRMED", 70, 305);
        x.fillStyle = "#aaa"; x.font = "600 24px Arial"; x.fillText(`Pickleball Coaching • ${locationCfg.full || ""}`, 70, 350);
        x.fillStyle = "#222"; roundRectCanvas(x, 70, 405, 940, 750, 34); x.fill();
        const rows = [["CLIENT", b.client_name], ["DATE", new Date(`${b.session_date}T00:00:00`).toLocaleDateString("en-PH", { weekday: "long", month: "long", day: "numeric", year: "numeric" })], ["TIME", `${hourName(Number(b.start_hour))} – ${hourName(Number(b.end_hour))}`], ["PLAYERS", `${b.participant_count || 1} player${Number(b.participant_count) === 1 ? "" : "s"}`], ["COACHING", b.coaching_type || "Pickleball Coaching"]];
        if (b.client_program_id) rows.push(["PROGRAM SESSION", `Session ${b.program_session_number || "—"}`]);
        let yy = 485;
        for (const [lab, val] of rows) {
          x.fillStyle = accent; x.font = "800 19px Arial"; x.fillText(lab, 120, yy);
          x.fillStyle = "#fff"; x.font = "700 29px Manrope, Arial"; yy = wrapCanvasText(x, val, 120, yy + 42, 820, 38, 2) + 38;
        }
        const p = paymentState(b);
        x.fillStyle = accent; x.font = "800 19px Arial"; x.fillText("PAYMENT", 120, 1070);
        x.fillStyle = "#fff"; x.font = "700 28px Manrope, Arial"; x.fillText(b.client_program_id ? "Program package payment tracked separately" : (p.balance <= 0 ? "Fully Collected" : `${peso(p.balance)} outstanding`), 120, 1112);
        x.fillStyle = "#aaa"; x.font = "500 20px Arial"; x.fillText(`Please message ${brandCfg.name || "the coach"} if you need to change your schedule.`, 70, 1245);
        return c.toDataURL("image/png");
      };

      if ($("downloadConfirmationCard")) $("downloadConfirmationCard").onclick = () => {
        if (!confirmationCardDataUrl) return;
        const a = document.createElement("a");
        a.href = confirmationCardDataUrl;
        a.download = `${slug}-booking-confirmation-${todayStr()}.png`;
        a.click();
      };

      updateRate();
      renderSlots();
      loadBookingAvailability();
      loadAdminCalendar();
      initPublicQr();
    } catch (error) {
      console.warn("Master Template admin patch could not fully apply:", error);
    }
  }

  window.addEventListener("load", () => setTimeout(applyAdminTemplatePatches, 0));
})();
