(() => {
  // Capture the full v17 handlers before the template business patch replaces them.
  const v17QuickBookingSubmit = $("quickBookingForm")?.onsubmit || null;
  const v17ParseButtonClick = $("parseBtn")?.onclick || null;
  const v17ParseClientText = typeof parseClientText === "function" ? parseClientText : null;

  function restoreV17BookingFlow() {
    try {
      // Restore the mature v17 workflow. This is the flow that creates/links
      // client profiles, writes booking_participants, and marks loaded inquiries
      // confirmed after a booking is successfully created.
      if (v17ParseClientText) parseClientText = v17ParseClientText;
      if (v17ParseButtonClick && $("parseBtn")) $("parseBtn").onclick = v17ParseButtonClick;
      if (v17QuickBookingSubmit && $("quickBookingForm")) $("quickBookingForm").onsubmit = v17QuickBookingSubmit;

      // Keep the v17 participant roster behavior while allowing the template
      // updateRate() patch to continue supplying config-driven rates.
      if ($("participantCount")) {
        $("participantCount").onchange = () => {
          const n = Number($("participantCount").value || 1);
          if (typeof v17dRenderAdminParticipants === "function") v17dRenderAdminParticipants(n);
          if (typeof updateRate === "function") updateRate();
        };
      }

      if (typeof updateRate === "function") updateRate();
    } catch (error) {
      console.warn("Master Template v1.2 client-link compatibility fix could not fully apply:", error);
    }
  }

  // template-admin-patches runs at load+0ms and template-admin-business at +20ms.
  // Restore the richer v17 handlers after both have finished applying.
  window.addEventListener("load", () => setTimeout(restoreV17BookingFlow, 80));
})();
