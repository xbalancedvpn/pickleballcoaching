(() => {
  const cfg = window.COACH_APP_CONFIG || {};
  const scheduleCfg = cfg.schedule || {};
  const coachCfg = cfg.coach || {};
  const locationCfg = cfg.location || {};
  const courtCfg = cfg.courtFee || {};
  const contactCfg = cfg.contact || {};
  const brandCfg = cfg.brand || {};

  const startHour = Number.isFinite(Number(scheduleCfg.startHour)) ? Number(scheduleCfg.startHour) : 8;
  const endHour = Number.isFinite(Number(scheduleCfg.endHour)) ? Number(scheduleCfg.endHour) : 24;
  const slotCount = Math.max(0, endHour - startHour);

  function applyPublicTemplatePatches() {
    try {
      dayState = function (date) {
        let booked = 0, unavailable = 0, available = 0;
        for (let h = startHour; h < endHour; h++) {
          const s = statusFor(date, h);
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

      renderSlots = function () {
        slotsEl.innerHTML = "";
        if (!selectedDate) {
          selectedDateText.textContent = "Choose a date";
          return;
        }
        const ds = keyDate(selectedDate);
        selectedDateText.textContent = niceDate(selectedDate);
        for (let h = startHour; h < endHour; h++) {
          const b = document.createElement("button"), s = statusFor(ds, h);
          b.className = "slot";
          b.textContent = hourLabel(h);
          b.type = "button";
          if (s === "booked") {
            b.classList.add("booked");
            b.disabled = true;
          } else if (s === "unavailable") {
            b.classList.add("unavailable");
            b.disabled = true;
          } else {
            if (selectedStart !== null && selectedEnd !== null && h >= selectedStart && h < selectedEnd) b.classList.add("in-range");
            b.onclick = () => {
              selectedStart = h;
              populateEndTimes();
              renderSlots();
              updateSummary();
            };
          }
          slotsEl.appendChild(b);
        }
      };

      populateStartTimes = function () {
        clientStart.innerHTML = "";
        clientEnd.innerHTML = "";
        if (!selectedDate) {
          clientStart.disabled = true;
          clientEnd.disabled = true;
          clientStart.innerHTML = "<option>Choose a date first</option>";
          clientEnd.innerHTML = "<option>Choose start time</option>";
          durationSummary.textContent = "Select a start and end time.";
          return;
        }
        const ds = keyDate(selectedDate), available = [];
        for (let h = startHour; h < endHour; h++) if (statusFor(ds, h) === "available") available.push(h);
        if (!available.length) {
          clientStart.disabled = true;
          clientEnd.disabled = true;
          clientStart.innerHTML = "<option>No available times</option>";
          clientEnd.innerHTML = "<option>Fully booked / unavailable</option>";
          durationSummary.textContent = "No available coaching time on this date.";
          return;
        }
        available.forEach(h => {
          const o = document.createElement("option");
          o.value = h;
          o.textContent = hourName(h);
          clientStart.appendChild(o);
        });
        clientStart.disabled = false;
        if (selectedStart === null || !available.includes(selectedStart)) selectedStart = available[0];
        clientStart.value = selectedStart;
        populateEndTimes();
      };

      populateEndTimes = function () {
        clientEnd.innerHTML = "";
        if (!selectedDate || selectedStart === null) return;
        const ds = keyDate(selectedDate);
        let last = selectedStart;
        for (let h = selectedStart; h < endHour; h++) {
          if (statusFor(ds, h) !== "available") break;
          last = h + 1;
          const o = document.createElement("option");
          o.value = last;
          o.textContent = hourName(last);
          clientEnd.appendChild(o);
        }
        if (!clientEnd.options.length) {
          clientEnd.disabled = true;
          selectedEnd = null;
          durationSummary.textContent = "No consecutive time available from this start time.";
        } else {
          clientEnd.disabled = false;
          if (selectedEnd === null || selectedEnd <= selectedStart || selectedEnd > last) selectedEnd = selectedStart + 1;
          clientEnd.value = selectedEnd;
          updateDuration();
        }
      };

      bookingMessage = function () {
        const players = getPublicParticipants(true);
        if (!selectedDate || selectedStart === null || selectedEnd === null || !selectedPackage || !players || players.length !== Number(selectedPlayers || players.length)) return "";
        const hrs = selectedEnd - selectedStart;
        const primary = players[0];
        const context = [
          selectedGoalLabel ? `Goal: ${selectedGoalLabel}` : "",
          selectedProgramInterest ? `Program Interest: ${selectedProgramInterest.name}` : ""
        ].filter(Boolean).join("\n");
        const roster = players.map((p, i) => `Player ${i + 1}: ${fullPlayerName(p)}${p.contact ? ` | Contact: ${p.contact}` : " | Contact: Not provided"}`).join("\n");
        const coachName = coachCfg.firstName || coachCfg.fullName || "Coach";
        const venue = locationCfg.venueNote || locationCfg.full || "Venue confirmed with the coach";
        const courtFeeText = courtCfg.included
          ? "Included in coaching rate"
          : (courtCfg.bookingMessage || courtCfg.detail || "Not included; confirmed separately");
        return `Hi ${coachName}! I would like to request a pickleball coaching session.\n\nName: ${fullPlayerName(primary)}\nContact: ${primary.contact || "Not provided"}\nDate: ${niceDate(selectedDate)}\nTime: ${hourName(selectedStart)} - ${hourName(selectedEnd)} (${hrs} hour${hrs > 1 ? "s" : ""})\nPlayers: ${players.length}\n${roster}\nCoaching: ${selectedPackage}\nCoaching Rate: ${selectedRate}${context ? `\n${context}` : ""}\nCourt Fee: ${courtFeeText}\nVenue: ${venue}\n\nPlease confirm if this schedule is still available. Thank you!`;
      };

      loadPublicWeekPreview = async function () {
        const days = publicWeekDates(), start = keyDate(days[0]), end = keyDate(days[6]);
        publicWeekRange.textContent = `${days[0].toLocaleDateString("en-PH", { month: "short", day: "numeric" })} – ${days[6].toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })}`;
        publicWeekGrid.innerHTML = '<div class="pw-cell pw-head">TIME</div>' + days.map(d => `<div class="pw-cell pw-head">${d.toLocaleDateString("en-PH", { weekday: "short" }).toUpperCase()}<small>${d.toLocaleDateString("en-PH", { month: "short", day: "numeric" })}</small></div>`).join("");
        const { data, error } = await db.from("public_schedule").select("slot_date,start_hour,status").gte("slot_date", start).lte("slot_date", end);
        if (error) {
          publicWeekGrid.innerHTML = '<div class="pw-cell pw-time" style="grid-column:1/-1">Could not load schedule. Please close and try again.</div>';
          return;
        }
        const map = new Map((data || []).map(r => [`${r.slot_date}|${Number(r.start_hour)}`, r.status])), now = new Date();
        for (let h = startHour; h < endHour; h++) {
          publicWeekGrid.insertAdjacentHTML("beforeend", `<div class="pw-cell pw-time">${hourLabel(h)}</div>`);
          for (const d of days) {
            const ds = keyDate(d), status = map.get(`${ds}|${h}`) || "available", slot = new Date(d);
            slot.setHours(h, 0, 0, 0);
            let cls, label, clickable = false;
            if (status === "booked") { cls = "pw-booked-cell"; label = "BOOKED"; }
            else if (status === "unavailable") { cls = "pw-blocked-cell"; label = "BLOCKED"; }
            else if (slot <= now) { cls = "pw-past-cell"; label = "PAST"; }
            else { cls = "pw-available-cell"; label = "AVAILABLE"; clickable = true; }
            const b = document.createElement(clickable ? "button" : "div");
            b.className = `pw-cell ${cls}`;
            b.textContent = label;
            if (clickable) {
              b.type = "button";
              b.onclick = () => jumpFromWeekToBooking(ds, h);
            }
            publicWeekGrid.appendChild(b);
          }
        }
      };

      loadLiveAvailabilityIndicator = async function () {
        const badge = document.getElementById("liveAvailabilityBadge");
        if (!badge) return;
        const now = new Date(), sun = new Date(now);
        sun.setHours(0, 0, 0, 0);
        sun.setDate(sun.getDate() - sun.getDay());
        const sat = new Date(sun);
        sat.setDate(sun.getDate() + 6);
        const { data, error } = await db.from("public_schedule").select("slot_date,start_hour,status").gte("slot_date", keyDate(sun)).lte("slot_date", keyDate(sat));
        if (error) {
          badge.querySelector("strong").textContent = "Live schedule available below";
          return;
        }
        const map = new Map((data || []).map(r => [`${r.slot_date}|${Number(r.start_hour)}`, r.status]));
        let open = 0, todayOpen = 0;
        for (let i = 0; i < 7; i++) {
          const d = new Date(sun);
          d.setDate(sun.getDate() + i);
          for (let h = startHour; h < endHour; h++) {
            const slot = new Date(d);
            slot.setHours(h, 0, 0, 0);
            if (slot <= now) continue;
            if ((map.get(`${keyDate(d)}|${h}`) || "available") === "available") {
              open++;
              if (keyDate(d) === keyDate(now)) todayOpen++;
            }
          }
        }
        badge.classList.remove("limited", "full");
        if (open === 0) {
          badge.classList.add("full");
          badge.querySelector("strong").textContent = "No open hours left this week";
        } else if (open <= 5) {
          badge.classList.add("limited");
          badge.querySelector("strong").textContent = `Limited availability • ${open} open hour${open === 1 ? "" : "s"} this week`;
        } else {
          badge.querySelector("strong").textContent = todayOpen
            ? `${todayOpen} open hour${todayOpen === 1 ? "" : "s"} today • ${open} this week`
            : `${open} open coaching hours this week`;
        }
      };

      if (copyOpenButton) {
        copyOpenButton.onclick = async () => {
          if (!bookingMessage()) return;
          await copyDetails();
          const url = contactCfg.facebookUrl;
          if (url && url !== "#") setTimeout(() => window.open(url, "_blank"), 180);
        };
      }

      const installButton = document.getElementById("installPickylaBtn");
      if (installButton) installButton.textContent = `Install ${brandCfg.shortName || brandCfg.name || "Coaching App"}`;

      renderCalendar();
      renderSlots();
      populateStartTimes();
      loadLiveAvailabilityIndicator();
    } catch (error) {
      console.warn("Master Template public patch could not fully apply:", error);
    }
  }

  window.addEventListener("load", () => setTimeout(applyPublicTemplatePatches, 0));
})();
