window.COACH_APP_CONFIG = {
  templateVersion: "1.2.0",
  packageTier: "pro",
  storagePrefix: "coach-booking-template",

  brand: {
    name: "Your Coaching Brand",
    shortName: "Coach Booking",
    tagline: "Build your game. One rally at a time.",
    primaryColor: "#111111",
    accentColor: "#f6d21f",
    backgroundColor: "#ffffff"
  },

  coach: {
    fullName: "Coach Name",
    firstName: "Coach",
    bio: "Add the coach introduction here. Mention coaching style, experience, strengths, and what players can expect from each session.",
    heroLead: "Personalized pickleball coaching focused on fundamentals, confidence, consistency, and smarter play.",
    profilePhoto: "coach-placeholder.svg"
  },

  location: {
    city: "Your City",
    province: "Your Province",
    full: "Your City, Your Province",
    venueNote: "Venue confirmed with the coach"
  },

  schedule: {
    startHour: 8,
    endHour: 24,
    hoursLabel: "8 AM – 12 MN",
    daysLabel: "Monday–Sunday",
    durationLabel: "Flexible Duration",
    durationNote: "Choose consecutive available hours"
  },

  rates: {
    solo: { label: "1-on-1", amount: 400, minPlayers: 1, maxPlayers: 1, billingLabel: "per hour" },
    partners: { label: "Partners", amount: 300, minPlayers: 2, maxPlayers: 3, billingLabel: "each / hour" },
    group: { label: "Group", amount: 250, minPlayers: 4, maxPlayers: 8, billingLabel: "each / hour" }
  },

  courtFee: {
    included: false,
    note: "Court fee is not included in the coaching rate.",
    detail: "Court fee depends on the selected venue and schedule and is confirmed separately.",
    bookingMessage: "Not included; final court fee is confirmed separately based on venue and schedule."
  },

  contact: {
    facebookUrl: "#",
    facebookLabel: "Facebook / Messenger",
    phone: "",
    email: ""
  },

  assets: {
    logo: "brand-placeholder.svg",
    wordmark: "brand-placeholder.svg",
    emblem: "brand-placeholder.svg",
    favicon: "brand-placeholder.svg"
  },

  backend: {
    demoMode: true,
    supabaseUrl: "",
    supabasePublishableKey: ""
  },

  publicSiteUrl: "",

  features: {
    programs: true,
    testimonials: true,
    progressTracking: true,
    paymentTracking: true,
    weeklyScheduleCard: true,
    pwaInstall: true,
    multipleCoaches: false,
    multipleVenues: false
  }
};
