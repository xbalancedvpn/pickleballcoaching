(() => {
  const cfg = window.COACH_APP_CONFIG || {};
  const rates = cfg.rates || {};
  const defs = [rates.solo, rates.partners, rates.group].filter(Boolean);

  const originalQuickBookingSubmit = $("quickBookingForm")?.onsubmit || null;
  const originalParseButtonClick = $("parseBtn")?.onclick || null;
  const originalParseClientText = typeof parseClientText === "function" ? parseClientText : null;

  function configuredRate(players) {
    const n = Number(players || 1);
    const match = defs.find(r => n >= Number(r.minPlayers) && n <= Number(r.maxPlayers));
    return Number(match?.amount || 0);
  }

  function configuredType(players) {
    const n = Number(players || 1);
    const match = defs.find(r => n >= Number(r.minPlayers) && n <= Number(r.maxPlayers));
    if (!match) return "Pickleball Coaching";
    if (Number(match.minPlayers) === 1 && Number(match.maxPlayers) === 1) return match.label || "1-on-1";
    const range = Number(match.minPlayers) === Number(match.maxPlayers)
      ? String(match.minPlayers)
      : `${match.minPlayers}–${match.maxPlayers}`;
    return `${match.label || "Group"} (${range} Players)`;
  }

  function restoreV17BookingFlow() {
    try {
      if (typeof standardRate === "function") standardRate = configuredRate;
      if (typeof coachingType === "function") coachingType = configuredType;

      if (originalParseClientText) parseClientText = originalParseClientText;
      if (originalParseButtonClick && $("parseBtn")) $("parseBtn").onclick = originalParseButtonClick;
      if (originalQuickBookingSubmit && $("quickBookingForm")) $("quickBookingForm").onsubmit = originalQuickBookingSubmit;

      if ($("participantCount")) {
        $("participantCount").onchange = () => {
          const n = Number($("participantCount").value || 1);
          if (typeof v17dRenderAdminParticipants === "function") v17dRenderAdminParticipants(n);
          if (typeof updateRate === "function") updateRate();
        };
      }

      if (typeof updateRate === "function") updateRate();
    } catch (error) {
      console.warn("Master Template v1.2.1 client-link compatibility fix could not fully apply:", error);
    }
  }

  window.addEventListener("load", () => setTimeout(restoreV17BookingFlow, 60));
})();
