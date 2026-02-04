// Nigerian States and Major Cities
export const nigerianStates = [
  { name: "Lagos", cities: ["Ikeja", "Victoria Island", "Lekki", "Surulere", "Yaba", "Ikoyi", "Ajah", "Oshodi"] },
  { name: "Abuja FCT", cities: ["Central Area", "Wuse", "Garki", "Maitama", "Gwarinpa", "Asokoro", "Jabi"] },
  { name: "Rivers", cities: ["Port Harcourt", "Obio-Akpor", "Eleme", "Bonny"] },
  { name: "Kano", cities: ["Kano City", "Fagge", "Nassarawa", "Gwale"] },
  { name: "Oyo", cities: ["Ibadan", "Ogbomoso", "Oyo", "Iseyin"] },
  { name: "Kaduna", cities: ["Kaduna City", "Zaria", "Kafanchan"] },
  { name: "Delta", cities: ["Warri", "Asaba", "Sapele", "Ughelli"] },
  { name: "Anambra", cities: ["Awka", "Onitsha", "Nnewi"] },
  { name: "Enugu", cities: ["Enugu City", "Nsukka", "Agbani"] },
  { name: "Edo", cities: ["Benin City", "Auchi", "Ekpoma"] },
  { name: "Ogun", cities: ["Abeokuta", "Ijebu-Ode", "Sagamu", "Ota"] },
  { name: "Ondo", cities: ["Akure", "Ondo City", "Ore"] },
  { name: "Osun", cities: ["Osogbo", "Ile-Ife", "Ilesa"] },
  { name: "Kwara", cities: ["Ilorin", "Offa", "Jebba"] },
  { name: "Plateau", cities: ["Jos", "Bukuru", "Pankshin"] },
  { name: "Cross River", cities: ["Calabar", "Ogoja", "Ikom"] },
  { name: "Akwa Ibom", cities: ["Uyo", "Eket", "Ikot Ekpene"] },
  { name: "Abia", cities: ["Umuahia", "Aba", "Ohafia"] },
  { name: "Imo", cities: ["Owerri", "Orlu", "Okigwe"] },
  { name: "Borno", cities: ["Maiduguri", "Biu", "Damboa"] },
  { name: "Bauchi", cities: ["Bauchi City", "Azare", "Misau"] },
  { name: "Niger", cities: ["Minna", "Bida", "Suleja"] },
  { name: "Sokoto", cities: ["Sokoto City", "Tambuwal", "Wurno"] },
  { name: "Katsina", cities: ["Katsina City", "Daura", "Funtua"] },
  { name: "Jigawa", cities: ["Dutse", "Hadejia", "Gumel"] },
  { name: "Kebbi", cities: ["Birnin Kebbi", "Argungu", "Yauri"] },
  { name: "Zamfara", cities: ["Gusau", "Kaura Namoda", "Talata Mafara"] },
  { name: "Yobe", cities: ["Damaturu", "Potiskum", "Gashua"] },
  { name: "Adamawa", cities: ["Yola", "Mubi", "Numan"] },
  { name: "Taraba", cities: ["Jalingo", "Wukari", "Bali"] },
  { name: "Gombe", cities: ["Gombe City", "Kaltungo", "Billiri"] },
  { name: "Nasarawa", cities: ["Lafia", "Keffi", "Akwanga"] },
  { name: "Kogi", cities: ["Lokoja", "Okene", "Kabba"] },
  { name: "Benue", cities: ["Makurdi", "Otukpo", "Gboko"] },
  { name: "Ebonyi", cities: ["Abakaliki", "Afikpo", "Onueke"] },
  { name: "Ekiti", cities: ["Ado-Ekiti", "Ikere", "Efon"] },
  { name: "Bayelsa", cities: ["Yenagoa", "Ogbia", "Brass"] },
];

export const getAllStates = () => nigerianStates.map(s => s.name);

export const getCitiesByState = (stateName: string) => {
  const state = nigerianStates.find(s => s.name === stateName);
  return state?.cities || [];
};

// CAD Software commonly used
export const cadSoftwareList = [
  "AutoCAD",
  "Revit",
  "SolidWorks",
  "SketchUp",
  "Inventor",
  "Fusion 360",
  "CATIA",
  "Rhino 3D",
  "ArchiCAD",
  "Civil 3D",
  "MicroStation",
  "Blender",
  "3ds Max",
  "Maya",
  "NX (Siemens)",
  "Creo",
  "FreeCAD",
  "DraftSight",
  "BricsCAD",
  "Vectorworks",
];

// Skills/Specializations
export const cadSkills = [
  "2D Drafting",
  "3D Modeling",
  "Architectural Design",
  "Mechanical Design",
  "Electrical Design",
  "Civil Engineering",
  "Structural Analysis",
  "BIM Modeling",
  "Product Design",
  "Industrial Design",
  "Interior Design",
  "Landscape Design",
  "MEP Design",
  "HVAC Design",
  "Piping Design",
  "Sheet Metal Design",
  "Weldment Design",
  "Finite Element Analysis",
  "CFD Simulation",
  "Technical Illustration",
  "As-Built Documentation",
  "Shop Drawings",
  "Construction Drawings",
  "Rendering & Visualization",
];

// Format price in Naira
export const formatNaira = (amount: number): string => {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

// Common price ranges for filtering
export const priceRanges = [
  { label: "Under ₦10,000/hr", min: 0, max: 10000 },
  { label: "₦10,000 - ₦25,000/hr", min: 10000, max: 25000 },
  { label: "₦25,000 - ₦50,000/hr", min: 25000, max: 50000 },
  { label: "₦50,000 - ₦100,000/hr", min: 50000, max: 100000 },
  { label: "Above ₦100,000/hr", min: 100000, max: Infinity },
];

// Project budget ranges
export const budgetRanges = [
  { label: "Under ₦50,000", min: 0, max: 50000 },
  { label: "₦50,000 - ₦200,000", min: 50000, max: 200000 },
  { label: "₦200,000 - ₦500,000", min: 200000, max: 500000 },
  { label: "₦500,000 - ₦1,000,000", min: 500000, max: 1000000 },
  { label: "₦1,000,000 - ₦5,000,000", min: 1000000, max: 5000000 },
  { label: "Above ₦5,000,000", min: 5000000, max: Infinity },
];
