window.DC = window.DC || {};

DC.SERVER_MODELS = [
  { name: "NovaEdge R220", power: 320, cores: 16, mem: 64 },
  { name: "NovaEdge R340", power: 410, cores: 32, mem: 128 },
  { name: "Helios 2450", power: 380, cores: 24, mem: 96 },
  { name: "Helios 2480", power: 460, cores: 48, mem: 192 },
  { name: "CoreLine C12", power: 290, cores: 12, mem: 48 },
  { name: "CoreLine C16", power: 340, cores: 20, mem: 80 },
  { name: "Axiom S2", power: 380, cores: 28, mem: 112 },
  { name: "Axiom X4", power: 520, cores: 64, mem: 256 }
];

DC.ROLES = {
  WEB: { load: [35, 65], heat: 1.0, net: 1.2 },
  DATABASE: { load: [45, 80], heat: 1.25, net: 1.0 },
  AUTH: { load: [20, 45], heat: 0.85, net: 0.9 },
  DNS: { load: [8, 20], heat: 0.6, net: 1.1 },
  VIRTUALIZATION: { load: [55, 88], heat: 1.35, net: 1.0 },
  "AI INFERENCE": { load: [65, 95], heat: 1.7, net: 0.9 },
  ANALYTICS: { load: [50, 85], heat: 1.4, net: 0.8 },
  RENDERING: { load: [70, 96], heat: 1.6, net: 0.6 },
  VIDEO: { load: [35, 70], heat: 1.1, net: 1.6 },
  BACKUP: { load: [20, 55], heat: 1.0, net: 1.4 },
  API: { load: [30, 60], heat: 1.0, net: 1.5 },
  "BATCH COMPUTE": { load: [55, 92], heat: 1.45, net: 0.5 },
  MONITORING: { load: [10, 25], heat: 0.6, net: 0.8 },
  CACHE: { load: [30, 60], heat: 1.05, net: 1.7 },
  MIDDLEWARE: { load: [25, 55], heat: 0.95, net: 1.2 }
};

DC.SERVICE_TYPES = [
  { key: "CUSTOMER PORTAL", customers: [1200, 9000], crit: 1.3, tickets: 1.2 },
  { key: "AUTHENTICATION", customers: [900, 7000], crit: 1.5, tickets: 1.35 },
  { key: "FILE SERVICE", customers: [400, 4000], crit: 1.0, tickets: 0.9 },
  { key: "DATABASE", customers: [300, 3500], crit: 1.4, tickets: 1.0 },
  { key: "API PLATFORM", customers: [500, 6000], crit: 1.3, tickets: 1.1 },
  { key: "VIDEO SERVICE", customers: [600, 5500], crit: 0.9, tickets: 1.0 },
  { key: "DNS", customers: [1500, 9000], crit: 1.6, tickets: 1.4 },
  { key: "AI SERVICE", customers: [200, 2500], crit: 1.1, tickets: 0.9 },
  { key: "BILLING SYSTEM", customers: [150, 1800], crit: 1.2, tickets: 0.8 },
  { key: "METRICS DASHBOARD", customers: [100, 900], crit: 0.4, tickets: 0.3 },
  { key: "CHECKOUT SYSTEM", customers: [300, 3000], crit: 1.7, tickets: 1.5 },
  { key: "SEARCH SERVICE", customers: [400, 4000], crit: 0.9, tickets: 0.8 },
  { key: "MESSAGING", customers: [300, 3000], crit: 1.0, tickets: 0.9 }
];

DC.TICKET_FLAVOR = {
  "CUSTOMER PORTAL": ["Portal is down.", "Cannot load the site.", "Pages are timing out.", "Is the website broken?"],
  AUTHENTICATION: ["Cannot sign in.", "Login loop.", "Passwords rejected.", "Locked out of my account."],
  "FILE SERVICE": ["Files unavailable.", "Shared folder disappeared.", "Cannot open documents.", "File access is slow."],
  DATABASE: ["Database error.", "Queries are failing.", "App shows SQL error.", "Data won't save."],
  "API PLATFORM": ["API requests are failing.", "504 errors everywhere.", "Integration is broken.", "API latency huge."],
  "VIDEO SERVICE": ["Video system unavailable.", "Streams won't play.", "Playback keeps buffering.", "Video calls dropping."],
  DNS: ["Sites won't resolve.", "Name lookup failing.", "Everything unreachable.", "DNS errors."],
  "AI SERVICE": ["AI tool not responding.", "Inference queue stuck.", "Model requests fail.", "AI is offline."],
  "BILLING SYSTEM": ["Invoices missing.", "Can't process payment.", "Billing page broken.", "Charges failing."],
  "METRICS DASHBOARD": ["Graphs are blank.", "Dashboard slow.", "No data showing.", "Monitoring down."],
  "CHECKOUT SYSTEM": ["Checkout is failing.", "Cart errors.", "Cannot complete purchase.", "Payment page down."],
  "SEARCH SERVICE": ["Search broken.", "No results returned.", "Search is slow.", "Index not updating."],
  MESSAGING: ["Messages not sending.", "Chat is offline.", "Notifications missing.", "Chat laggy."]
};

DC.GENERIC_COMPLAINTS = ["Everything is slow.", "Is anyone fixing this?", "Why is this still down?", "This keeps happening.", "Please escalate!"];

DC.EXPANSION_TEMPLATES = [
  {
    key: "COMPUTE WING", flavor: "AI / analytics workload",
    racks: [2, 4], servers: [6, 14], storage: [0, 1],
    customers: [2500, 6000], power: 1.16, heat: 1.12, repBonus: 3
  },
  {
    key: "STORAGE EXPANSION", flavor: "high storage traffic",
    racks: [1, 3], servers: [1, 3], storage: [2, 5],
    customers: [1200, 3200], power: 1.08, heat: 1.06, repBonus: 2
  },
  {
    key: "ENTERPRISE CUSTOMER", flavor: "high-criticality application",
    racks: [1, 2], servers: [4, 8], storage: [1, 2],
    customers: [3500, 8000], power: 1.1, heat: 1.08, repBonus: 8
  },
  {
    key: "VIDEO PLATFORM", flavor: "streaming delivery",
    racks: [1, 3], servers: [4, 10], storage: [0, 2],
    customers: [2000, 5500], power: 1.1, heat: 1.1, repBonus: 3
  },
  {
    key: "PRIVATE CLOUD", flavor: "virtualization cluster",
    racks: [2, 3], servers: [7, 12], storage: [1, 2],
    customers: [1500, 4500], power: 1.18, heat: 1.15, repBonus: 4
  },
  {
    key: "EDGE COMPUTE", flavor: "low-latency workloads",
    racks: [1, 2], servers: [4, 8], storage: [0, 1],
    customers: [1000, 3000], power: 1.07, heat: 1.05, repBonus: 2
  }
];

DC.UPGRADES = {
  HOT_AISLE: { name: "HOT AISLE CONTAINMENT", desc: "Improves cooling efficiency across all halls.", effect: { coolEff: 1.25 }, risk: null },
  REDUNDANT_CRAC: { name: "REDUNDANT CRAC", desc: "Allows one cooling unit to fail safely.", effect: { cracBackup: true }, risk: null },
  DUAL_FEEDS: { name: "DUAL POWER FEEDS", desc: "Improves rack power resilience. PDU faults hurt less.", effect: { pduShield: true }, risk: null },
  BIG_UPS: { name: "HIGH-CAPACITY UPS", desc: "Longer backup power during utility outages.", effect: { upsCap: 2.2 }, risk: null },
  GENERATOR: { name: "STANDBY GENERATOR", desc: "Protects against extended utility outage.", effect: { generator: true }, risk: "Generator can fail to start (rare)." },
  NVME: { name: "NVME STORAGE", desc: "Faster rebuilds and performance.", effect: { rebuild: 1.6 }, risk: "Higher heat output." },
  LOAD_BALANCER: { name: "AUTOMATED LOAD BALANCING", desc: "Moves workload from failing compute automatically.", effect: { autoMigrate: true }, risk: null },
  NET_FABRIC: { name: "NETWORK FABRIC REDUNDANCY", desc: "Dual network paths. Switch faults less severe.", effect: { netShield: true }, risk: null },
  FIREWALL: { name: "SEGMENTATION FIREWALL", desc: "Slows simulated cyber spread.", effect: { propSlow: 0.5 }, risk: null },
  EDR: { name: "EDR MONITORING", desc: "Earlier and clearer security warnings.", effect: { secWarn: true }, risk: null },
  MONITORING: { name: "IMPROVED MONITORING", desc: "Earlier warnings for hardware faults.", effect: { earlyWarn: true }, risk: null },
  PREDICTIVE: { name: "PREDICTIVE MAINTENANCE", desc: "More early hardware warnings.", effect: { predRate: 1.6 }, risk: null },
  LIQUID: { name: "LIQUID COOLING LOOP", desc: "Excellent cooling for dense racks.", effect: { coolEff: 1.5 }, risk: "Pump/coolant pressure incidents possible." },
  SMART_PDU: { name: "SMART PDU", desc: "Better power telemetry, earlier overload warnings.", effect: { pduTelemetry: true }, risk: null },
  EFF_FANS: { name: "HIGH-EFFICIENCY FANS", desc: "Lower heat everywhere.", effect: { heatCut: 0.82 }, risk: null },
  BACKUP_APPL: { name: "BACKUP APPLIANCE", desc: "Improves recovery, fewer backup failures.", effect: { backupOk: 0.4 }, risk: null },
  REBUILD_CTRL: { name: "FASTER REBUILD CONTROLLER", desc: "Reduces storage exposure after drive loss.", effect: { rebuild: 1.4 }, risk: null }
};
