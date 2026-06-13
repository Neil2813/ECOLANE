// Mock data for EcoLens demo
export const todayExposure = {
  pm25: 340,
  avoided: 430,
  co2: 210,
  cityAvgCo2: 350,
  ecoscore: 84,
  no2: 88,
  noise: 62,
  heatStress: "Moderate",
};

export const ecoscoreTrend = [62, 65, 70, 68, 74, 71, 84];
export const weeklyPollution = [
  { day: "M", level: 45, status: "safe" },
  { day: "Tu", level: 72, status: "moderate" },
  { day: "W", level: 38, status: "safe" },
  { day: "Th", level: 88, status: "moderate" },
  { day: "F", level: 120, status: "high" },
  { day: "Sa", level: 52, status: "safe" },
  { day: "Su", level: 41, status: "safe" },
];

export const forecast = {
  risk: "high",
  pctHigher: 60,
  departure: "07:45 AM",
  route: "Residency Rd.",
};

export const badges = [
  { id: "clean", label: "Clean Commuter", icon: "bike", color: "green" },
  { id: "avoider", label: "Pollution Avoider", icon: "shield", color: "orange" },
  { id: "carbon", label: "Carbon Saver", icon: "trees", color: "blue" },
];

export const trips = [
  {
    id: "t1",
    date: "Oct 24",
    time: "08:15 AM",
    name: "Home to Work (River Path)",
    mode: "bike",
    duration: "17 min",
    pm25Avoided: 430,
    co2: 0,
    ecoscore: 87,
    status: "safe",
  },
  {
    id: "t2",
    date: "Oct 23",
    time: "17:30 PM",
    name: "Work to Gym (Downtown)",
    mode: "walk",
    duration: "25 min",
    pm25Avoided: 120,
    co2: 0,
    ecoscore: 64,
    status: "moderate",
  },
  {
    id: "t3",
    date: "Oct 21",
    time: "14:00 PM",
    name: "Grocery Run (Main Ave)",
    mode: "car",
    duration: "42 min",
    pm25Avoided: -50,
    co2: 180,
    ecoscore: 32,
    status: "high",
  },
  {
    id: "t4",
    date: "Oct 20",
    time: "07:45 AM",
    name: "Home to Work (River Path)",
    mode: "bike",
    duration: "18 min",
    pm25Avoided: 410,
    co2: 0,
    ecoscore: 85,
    status: "safe",
  },
];

export const routes = [
  {
    type: "fastest",
    label: "Fastest",
    duration: 14,
    distance: 3.2,
    pm25: 340,
    co2: 180,
    ecoscore: 42,
    color: "muted",
  },
  {
    type: "cleanest_air",
    label: "Cleanest Air",
    duration: 17,
    distance: 3.8,
    pm25: 110,
    co2: 180,
    ecoscore: 87,
    color: "green",
    recommended: true,
  },
  {
    type: "lowest_carbon",
    label: "Lowest Carbon",
    duration: 16,
    distance: 3.5,
    pm25: 210,
    co2: 60,
    ecoscore: 71,
    color: "blue",
  },
];
