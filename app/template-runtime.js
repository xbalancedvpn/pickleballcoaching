(() => {
  const cfg = window.COACH_APP_CONFIG || {};
  const brand = cfg.brand || {};
  const coach = cfg.coach || {};
  const location = cfg.location || {};
  const schedule = cfg.schedule || {};
  const rates = cfg.rates || {};
  const contact = cfg.contact || {};
  const assets = cfg.assets || {};

  const money = value => `₱${Number(value || 0).toLocaleString("en-PH", { maximumFractionDigits: 2 })}`;

  // Prevent a fresh template from accidentally connecting to the original Pickyla database.
  if (window.supabase && typeof window.supabase.createClient === "function") {
    const realCreateClient = window.supabase.createClient.bind(window.supabase);

    const emptyQuery = () => {
      const result = Promise.resolve({ data: [], error: null });
      let chain;
      chain = new Proxy({}, {
        get(_target, prop) {
          if (prop === "then") return result.then.bind(result);
          if (prop === "catch") return result.catch.bind(result);
          if (prop === "finally") return result.finally.bind(result);
          return () => chain;
        }
      });
      return chain;
    };

    const mockDb = {
      from: () => emptyQuery(),
      rpc: async () => ({ data: null, error: { message: "This template is not connected to a Supabase project yet." } }),
      auth: {
        getSession: async () => ({ data: { session: null }, error: null }),
        signInWithPassword: async () => ({ data: null, error: { message: "Connect this client build to its own Supabase project in config.js first." } }),
        signOut: async () => ({ error: null })
      }
    };

    window.supabase.createClient = function createTemplateClient(_url, _key, options) {
      const url = cfg.backend?.supabaseUrl;
      const key = cfg.backend?.supabasePublishableKey;
      if (cfg.backend?.demoMode || !url || !key) return mockDb;
      return realCreateClient(url, key, options);
    };
  }

  // Remap old Pickyla local-storage keys so cloned clients never share browser-side saved player data.
  if (window.Storage && cfg.storagePrefix) {
    const getItem = Storage.prototype.getItem;
    const setItem = Storage.prototype.setItem;
    const removeItem = Storage.prototype.removeItem;
    const remap = key => typeof key === "string" && key.startsWith("pickyla-")
      ? `${cfg.storagePrefix}-${key.slice("pickyla-".length)}`
      : key;
    Storage.prototype.getItem = function (key) { return getItem.call(this, remap(key)); };
    Storage.prototype.setItem = function (key, value) { return setItem.call(this, remap(key), value); };
    Storage.prototype.removeItem = function (key) { return removeItem.call(this, remap(key)); };
  }

  const setText = (selector, value) => {
    const el = document.querySelector(selector);
    if (el && value !== undefined && value !== null) el.textContent = value;
  };

  const setImage = (selector, src, alt) => {
    document.querySelectorAll(selector).forEach(img => {
      if (src) img.src = src;
      if (alt) img.alt = alt;
    });
  };

  function applyStaticConfig() {
    document.documentElement.style.setProperty("--template-primary", brand.primaryColor || "#111111");
    document.documentElement.style.setProperty("--template-accent", brand.accentColor || "#f6d21f");
    document.documentElement.style.setProperty("--template-bg", brand.backgroundColor || "#ffffff");

    document.title = `${brand.name || "Coaching"} | Pickleball Coaching`;

    setImage(".brand-logo", assets.emblem || assets.logo, `${brand.name || "Coaching"} logo`);
    setImage(".hero-logo, .footer-logo", assets.logo || assets.wordmark, `${brand.name || "Coaching"} logo`);
    setImage(".hero-photo img", coach.profilePhoto, `${coach.fullName || "Coach"} playing pickleball`);

    const heroEyebrow = document.querySelector(".hero-copy .eyebrow");
    if (heroEyebrow) heroEyebrow.textContent = `PICKLEBALL COACHING • ${(location.city || "YOUR CITY").toUpperCase()}`;
    setText(".hero-copy .hero-lead", coach.heroLead);
    setText("#about h2", coach.fullName);
    setText("#about > p", coach.bio);

    const quick = document.querySelectorAll("#about .quick-info > div");
    if (quick[0]) {
      const s = quick[0].querySelector("span");
      if (s) s.innerHTML = `<strong>${location.city || "Your City"}</strong><small>${location.province || "Your Province"}</small>`;
    }
    if (quick[1]) {
      const s = quick[1].querySelector("span");
      if (s) s.innerHTML = `<strong>${schedule.hoursLabel || "8 AM – 12 MN"}</strong><small>${schedule.daysLabel || "Monday–Sunday"}</small>`;
    }
    if (quick[2]) {
      const s = quick[2].querySelector("span");
      if (s) s.innerHTML = `<strong>${schedule.durationLabel || "Flexible Duration"}</strong><small>${schedule.durationNote || "Choose consecutive available hours"}</small>`;
    }

    const rateCards = document.querySelectorAll(".rate-card");
    const rateDefs = [rates.solo, rates.partners, rates.group].filter(Boolean);
    rateCards.forEach((card, index) => {
      const rate = rateDefs[index];
      if (!rate) return;
      const h3 = card.querySelector("h3");
      const price = card.querySelector(".price");
      const p = card.querySelector("p");
      if (h3) h3.textContent = index === 1 ? `${rate.minPlayers}–${rate.maxPlayers} Players` : index === 2 ? `${rate.minPlayers}–${rate.maxPlayers} Players` : rate.label;
      if (price) price.innerHTML = `<span>₱</span>${Number(rate.amount || 0).toLocaleString("en-PH")}`;
      if (p) p.textContent = rate.billingLabel || "per hour";
    });

    const packageButtons = document.querySelectorAll(".package-options button");
    const defs = [rates.solo, rates.partners, rates.group].filter(Boolean);
    packageButtons.forEach((button, index) => {
      const rate = defs[index];
      if (!rate) return;
      const players = index === 0 ? 1 : rate.minPlayers;
      const range = rate.minPlayers === rate.maxPlayers ? `${rate.minPlayers}` : `${rate.minPlayers}–${rate.maxPlayers}`;
      const packageName = index === 0 ? "1-on-1" : index === 1 ? `Partners (${range} Players)` : `Group (${range} Players)`;
      button.dataset.package = packageName;
      button.dataset.players = String(players);
      button.dataset.min = String(rate.minPlayers);
      button.dataset.max = String(rate.maxPlayers);
      button.dataset.rate = index === 0 ? `${money(rate.amount)}/hour` : `${money(rate.amount)} each/hour`;
      button.innerHTML = index === 0
        ? `1-on-1 <small>${money(rate.amount)}/hr</small>`
        : `${rate.label} <small>${range} players • ${money(rate.amount)} each</small>`;
    });

    const court = document.querySelector(".court-fee-note");
    if (court) court.innerHTML = `<strong>${cfg.courtFee?.note || "Court fee is not included in the coaching rate."}</strong><span>${cfg.courtFee?.detail || "Court fee is confirmed separately."}</span>`;

    const facebook = document.querySelector("#contact .contact-actions a");
    if (facebook) {
      facebook.href = contact.facebookUrl || "#";
      facebook.textContent = contact.facebookLabel || "Facebook / Messenger";
    }

    const install = document.querySelector("#contact .install-btn");
    if (install) install.textContent = `Install ${brand.name || "Coaching App"}`;

    const footerText = document.querySelector("footer span");
    if (footerText) footerText.textContent = `Pickleball Coaching • ${location.full || "Your City, Your Province"}`;
  }

  const replacements = () => [
    ["Kyla Nicole Soriano", coach.fullName || "Coach Name"],
    ["Pickyla", brand.name || "Your Coaching Brand"],
    ["Kyla", coach.firstName || "Coach"],
    ["Santiago City, Isabela", location.full || "Your City, Your Province"],
    ["Santiago City", location.city || "Your City"]
  ];

  function replaceTextInNode(root) {
    if (!root) return;
    if (root.nodeType === Node.TEXT_NODE) {
      let text = root.nodeValue || "";
      replacements().forEach(([from, to]) => { text = text.split(from).join(to); });
      if (text !== root.nodeValue) root.nodeValue = text;
      return;
    }
    if (root.nodeType !== Node.ELEMENT_NODE && root.nodeType !== Node.DOCUMENT_FRAGMENT_NODE) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(node => replaceTextInNode(node));
  }

  function startObserver() {
    const observer = new MutationObserver(records => {
      records.forEach(record => record.addedNodes.forEach(node => replaceTextInNode(node)));
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      applyStaticConfig();
      replaceTextInNode(document.body);
      startObserver();
    });
  } else {
    applyStaticConfig();
    replaceTextInNode(document.body);
    startObserver();
  }

  window.CoachTemplate = { config: cfg, money, applyStaticConfig };
})();
