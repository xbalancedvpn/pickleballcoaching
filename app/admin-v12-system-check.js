(() => {
  const BUILD = 'MASTER TEMPLATE v1.2.3';
  const byId = id => document.getElementById(id);
  const clean = v => String(v || '').trim();

  const dialog = document.createElement('dialog');
  dialog.id = 'masterSystemCheckDialog';
  dialog.style.maxWidth = '620px';
  dialog.style.width = 'calc(100% - 28px)';
  dialog.style.border = '0';
  dialog.style.borderRadius = '24px';
  dialog.style.padding = '0';
  dialog.innerHTML = `<div style="padding:24px;background:#fff;color:#111;font-family:inherit">
    <div style="display:flex;justify-content:space-between;gap:16px;align-items:flex-start">
      <div><small style="font-weight:800;letter-spacing:.12em;color:#9b7a00">${BUILD}</small><h2 style="margin:6px 0 6px">Live System Check</h2><p style="margin:0;color:#666">Runs a temporary real inquiry → booking → client-history flow, verifies the database result, then removes its test records.</p></div>
      <button id="masterSystemCheckClose" type="button" style="border:0;background:#eee;border-radius:12px;padding:8px 12px;font-size:20px">×</button>
    </div>
    <div id="masterSystemCheckResult" style="margin-top:20px"></div>
  </div>`;
  document.body.appendChild(dialog);
  byId('masterSystemCheckClose').onclick = () => dialog.close();

  function line(label, ok, detail='') {
    return `<div style="padding:10px 0;border-bottom:1px solid #eee"><strong>${ok ? '✅' : '❌'} ${label}</strong>${detail ? `<div style="font-size:13px;color:#666;margin-top:3px">${detail}</div>` : ''}</div>`;
  }

  async function refreshViews() {
    const names = ['loadInquiries','loadV17Clients','loadReports','loadPaymentDashboard','loadTodayCommandCenter','loadCollectionAlerts','loadAdminCalendar','loadDay'];
    await Promise.allSettled(names.map(async name => { try { if (typeof window[name] === 'function') await window[name](); } catch (_) {} }));
  }

  async function cleanup(state) {
    try {
      if (state.bookingId) await db.from('schedule_slots').delete().eq('booking_id', state.bookingId);
      if (state.bookingId) await db.from('bookings').delete().eq('id', state.bookingId);
      if (state.inquiryId) await db.from('inquiries').delete().eq('id', state.inquiryId);
      if (state.nameKeys?.length) {
        const { data: clients } = await db.from('clients').select('id,name_key').in('name_key', state.nameKeys);
        const ids = (clients || []).map(x => x.id);
        if (ids.length) await db.from('clients').delete().in('id', ids);
      }
      await refreshViews();
      return true;
    } catch (e) {
      console.warn('System check cleanup:', e);
      return false;
    }
  }

  async function runSystemCheck(button) {
    const result = byId('masterSystemCheckResult');
    const state = { inquiryId: null, bookingId: null, nameKeys: [] };
    const checks = [];
    button.disabled = true;
    button.textContent = 'Checking…';
    dialog.showModal();
    result.innerHTML = '<div style="padding:16px;background:#f7f7f4;border-radius:16px">Running live end-to-end test…</div>';

    try {
      const { data: { session } } = await db.auth.getSession();
      checks.push(['Authenticated admin session', !!session, session ? 'Admin session is active.' : 'No active session.']);
      if (!session) throw new Error('Login to Admin first.');

      const form = byId('quickBookingForm');
      const runtimeReady = !!form?.onsubmit && typeof v17dLoadInquiryToBooking === 'function' && typeof v17dCurrentAdminParticipants === 'function';
      checks.push(['v17 booking/client runtime loaded', runtimeReady, runtimeReady ? 'Structured participant and inquiry conversion functions are available.' : 'Required v17 functions are missing.']);
      if (!runtimeReady) throw new Error('The current page is not running the expected v17 booking runtime.');

      const token = String(Date.now()).slice(-7);
      const marker = `MASTER-SYSTEM-CHECK-${token}`;
      const people = [
        { first_name: `Check${token}A`, last_name: 'Player', full_name: `Check${token}A Player`, contact: null, is_primary: true },
        { first_name: `Check${token}B`, last_name: 'Player', full_name: `Check${token}B Player`, contact: null, is_primary: false },
        { first_name: `Check${token}C`, last_name: 'Player', full_name: `Check${token}C Player`, contact: null, is_primary: false }
      ];
      state.nameKeys = people.map(p => `${p.first_name} ${p.last_name}`.toLowerCase());

      let testDate = '2099-12-29', startHour = 8;
      const cfg = window.COACH_APP_CONFIG || {};
      const firstHour = Number(cfg.schedule?.startHour ?? 8);
      const lastHour = Number(cfg.schedule?.endHour ?? 24);
      const { data: occupied, error: occErr } = await db.from('schedule_slots').select('start_hour,status').eq('slot_date', testDate);
      if (occErr) throw occErr;
      const used = new Set((occupied || []).filter(x => x.status !== 'available').map(x => Number(x.start_hour)));
      startHour = Array.from({ length: Math.max(1, lastHour - firstHour) }, (_, i) => firstHour + i).find(h => h < lastHour && !used.has(h));
      if (startHour == null) throw new Error('No free diagnostic hour found on the isolated test date.');

      const rate = Number(cfg.rates?.partners?.amount || 300);
      const inquiryRow = {
        client_name: people[0].full_name,
        preferred_date: testDate,
        start_hour: startHour,
        end_hour: startHour + 1,
        participant_count: 3,
        coaching_type: 'System Check',
        quoted_rate: rate,
        status: 'new',
        source_text: marker,
        notes: marker
      };
      const { data: inquiry, error: inquiryErr } = await db.from('inquiries').insert(inquiryRow).select().single();
      if (inquiryErr) throw inquiryErr;
      state.inquiryId = inquiry.id;

      const inquiryPlayers = people.map((p, i) => ({
        inquiry_id: inquiry.id,
        participant_order: i + 1,
        first_name: p.first_name,
        last_name: p.last_name,
        full_name: p.full_name,
        contact: null,
        contact_key: null,
        is_primary: i === 0
      }));
      const { error: ipErr } = await db.from('inquiry_participants').insert(inquiryPlayers);
      if (ipErr) throw ipErr;
      checks.push(['Temporary public inquiry created', true, '3-player inquiry written to the live validation database.']);

      const { data: loaded, error: loadErr } = await db.from('inquiries')
        .select('*,inquiry_participants(id,participant_order,first_name,last_name,full_name,contact,is_primary)')
        .eq('id', inquiry.id).single();
      if (loadErr) throw loadErr;

      await v17dLoadInquiryToBooking(loaded);
      byId('bookingNotes').value = marker;
      const roster = v17dCurrentAdminParticipants();
      checks.push(['Load to Booking keeps all players', roster.length === 3 && roster.every(x => clean(x.first_name) && clean(x.last_name)), `${roster.length} player row(s) loaded.`]);

      const originalConfirm = window.confirm;
      window.confirm = () => true;
      try {
        await form.onsubmit.call(form, { preventDefault() {}, submitter: null });
      } finally {
        window.confirm = originalConfirm;
      }

      const { data: bookings, error: bookErr } = await db.from('bookings').select('*').eq('notes', marker).order('created_at', { ascending: false }).limit(1);
      if (bookErr) throw bookErr;
      const booking = bookings?.[0] || null;
      state.bookingId = booking?.id || null;
      checks.push(['Booking saved by the actual live form handler', !!booking, booking ? `Booking ${booking.id.slice(0,8)}… created.` : 'No booking with the diagnostic marker was created.']);

      const { data: inquiryAfter, error: iaErr } = await db.from('inquiries').select('status').eq('id', inquiry.id).single();
      if (iaErr) throw iaErr;
      checks.push(['Loaded inquiry becomes Confirmed', inquiryAfter?.status === 'confirmed', `Database status: ${inquiryAfter?.status || 'missing'}`]);

      let participants = [], linkedClients = [];
      if (booking) {
        const { data: bp, error: bpErr } = await db.from('booking_participants').select('id,client_id,participant_order,full_name,is_primary').eq('booking_id', booking.id).order('participant_order');
        if (bpErr) throw bpErr;
        participants = bp || [];
        const ids = participants.map(x => x.client_id).filter(Boolean);
        if (ids.length) {
          const { data: cs, error: csErr } = await db.from('clients').select('id,full_name,is_active').in('id', ids);
          if (csErr) throw csErr;
          linkedClients = cs || [];
        }
      }
      checks.push(['Booking has primary client_id', !!booking?.client_id, booking?.client_id ? 'Primary client is linked.' : 'client_id is NULL.']);
      checks.push(['All 3 booking participants linked', participants.length === 3 && participants.every(x => x.client_id), `${participants.length} participant record(s), ${participants.filter(x => x.client_id).length} with client_id.`]);
      checks.push(['3 active client profiles created', linkedClients.length === 3 && linkedClients.every(x => x.is_active !== false), `${linkedClients.length} linked client profile(s) found.`]);

      const corePassed = checks.every(x => x[1]);
      const cleanupOk = await cleanup(state);
      checks.push(['Diagnostic records cleaned up', cleanupOk, cleanupOk ? 'Temporary inquiry, booking, slots, participants, and clients removed.' : 'Cleanup needs attention.']);

      const passed = corePassed && cleanupOk;
      result.innerHTML = `<div style="padding:16px;border-radius:16px;background:${passed ? '#e9f8ec' : '#fff0f0'};margin-bottom:12px"><strong style="font-size:22px">${passed ? '✅ PASS' : '❌ FAIL'}</strong><div style="margin-top:4px">${passed ? 'The live inquiry → booking → client-history flow passed end-to-end.' : 'The live flow still has a failing step. Do not declare this build client-ready yet.'}</div></div>${checks.map(x => line(x[0], x[1], x[2])).join('')}`;
      window.__MASTER_SYSTEM_CHECK_LAST_RESULT__ = { passed, checks, build: BUILD, at: new Date().toISOString() };
    } catch (error) {
      const cleanupOk = await cleanup(state);
      checks.push(['Diagnostic cleanup after error', cleanupOk, cleanupOk ? 'Temporary data removed.' : 'Cleanup may be incomplete.']);
      result.innerHTML = `<div style="padding:16px;border-radius:16px;background:#fff0f0;margin-bottom:12px"><strong style="font-size:22px">❌ FAIL</strong><div style="margin-top:4px">${String(error?.message || error)}</div></div>${checks.map(x => line(x[0], x[1], x[2])).join('')}`;
      window.__MASTER_SYSTEM_CHECK_LAST_RESULT__ = { passed: false, error: String(error?.message || error), checks, build: BUILD, at: new Date().toISOString() };
    } finally {
      button.disabled = false;
      button.textContent = 'System Check';
    }
  }

  function install() {
    if (byId('masterSystemCheckBtn')) return;
    const host = document.querySelector('.v17g-quickbar > div:last-child') || document.querySelector('.v17g-quickbar') || byId('adminDashboardTop');
    if (!host) return setTimeout(install, 500);
    const button = document.createElement('button');
    button.id = 'masterSystemCheckBtn';
    button.type = 'button';
    button.textContent = 'System Check';
    button.style.marginLeft = '8px';
    button.style.border = '1px solid #d8b500';
    button.style.borderRadius = '12px';
    button.style.padding = '9px 12px';
    button.style.background = '#fff8cf';
    button.style.fontWeight = '800';
    button.onclick = () => runSystemCheck(button);
    host.appendChild(button);
  }

  setTimeout(install, 900);
})();
