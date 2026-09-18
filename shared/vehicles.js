// shared/vehicles.js
//
// Canonical list of vehicle keys, used for /give-vehicle + /remove-vehicle
// autocomplete + validation in the bot/API.
//
// IMPORTANT: vul deze lijst met de exacte namen/keys die jouw voertuig-
// systeem gebruikt (bv. de ModuleScript of het model onder ReplicatedStorage
// dat voertuigen spawnt). Dit bestand is bewust leeg-ish opgezet als
// startpunt — precies zoals shared/items.js en shared/jobs.js.

const VEHICLES = [
  // Voorbeeld — vervang met je eigen voertuignamen:
  // 'Sultan RS', 'Elegy Retro Custom', 'Politie Interceptor', 'Ambulance',
];

function isValidVehicle(vehicle) {
  return typeof vehicle === 'string' && VEHICLES.includes(vehicle);
}

module.exports = { VEHICLES, isValidVehicle };
