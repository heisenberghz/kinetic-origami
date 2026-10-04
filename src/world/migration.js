import { regions } from "./layout.js";
import { landmarkMetrics } from "./landmarks.js";

const cruiseAltitude = 6.4;
const climbHeight = 2.3;

function noise(index, salt) {
  const value = Math.sin(index * 12.9898 + salt * 78.233) * 43758.5453;
  return value - Math.floor(value);
}

function nearestRegion(x, z) {
  let best = regions[0];
  let bestDistance = Infinity;
  for (const region of regions) {
    const distance = Math.hypot(x - region.x, z - region.z);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = region;
    }
  }
  return best;
}

export function createMigration({ cranes, reducedMotion = false }) {
  const roosts = cranes.map((crane, index) => {
    const home = nearestRegion(crane.baseX, crane.baseZ);
    return {
      x: crane.baseX,
      y: crane.baseY,
      z: crane.baseZ,
      homeId: home.id,
      speed: 0.05 + (index % 4) * 0.008
    };
  });

  const routes = roosts.map(() => ({ t: 0, dwell: 0, outbound: true, target: null, salt: 1 }));

  function chooseTarget(index) {
    const route = routes[index];
    route.salt += 1;
    if (route.outbound) {
      const options = regions.filter((region) => region.id !== roosts[index].homeId);
      route.target = options[Math.floor(noise(index, route.salt) * options.length) % options.length];
    } else {
      route.target = regions.find((region) => region.id === roosts[index].homeId);
    }
  }

  for (let index = 0; index < routes.length; index += 1) chooseTarget(index);

  function holdAt(index, x, altitude, z) {
    const crane = cranes[index];
    crane.baseX = x;
    crane.baseY = altitude;
    crane.baseZ = z;
  }

  function cruiseHeightFor(regionId, groundY) {
    return groundY + cruiseAltitude + landmarkMetrics[regionId].height * 0.5;
  }

  function update(delta) {
    const travel = reducedMotion ? 0.25 : 1;
    for (let index = 0; index < cranes.length; index += 1) {
      const roost = roosts[index];
      const route = routes[index];
      const target = route.target;

      if (route.dwell > 0) {
        route.dwell -= delta * travel;
        if (route.outbound) {
          holdAt(index, target.x, cruiseHeightFor(target.id, 0), target.z);
        } else {
          holdAt(index, roost.x, roost.y, roost.z);
        }
        if (route.dwell <= 0) {
          route.t = 0;
          route.outbound = !route.outbound;
          chooseTarget(index);
        }
        continue;
      }

      route.t = Math.min(1, route.t + delta * roost.speed * travel);
      const eased = route.t * route.t * (3 - 2 * route.t);
      const originY = roost.y + cruiseAltitude;
      const targetY = cruiseHeightFor(target.id, 0);
      holdAt(
        index,
        roost.x + (target.x - roost.x) * eased,
        originY + (targetY - originY) * eased + Math.sin(eased * Math.PI) * climbHeight,
        roost.z + (target.z - roost.z) * eased
      );

      if (route.t >= 1) {
        route.dwell = 3.4 + noise(index, route.salt) * 5.4;
        route.outbound = !route.outbound;
      }
    }
  }

  function reset() {
    for (let index = 0; index < cranes.length; index += 1) {
      const crane = cranes[index];
      const roost = roosts[index];
      crane.baseX = roost.x;
      crane.baseY = roost.y;
      crane.baseZ = roost.z;
      crane.x = roost.x;
      crane.y = roost.y;
      crane.z = roost.z;
      crane.vx = 0;
      crane.vy = 0;
      crane.vz = 0;
      routes[index].t = 0;
      routes[index].dwell = 0;
      routes[index].outbound = true;
      chooseTarget(index);
    }
  }

  return { update, reset, roosts, routes };
}
