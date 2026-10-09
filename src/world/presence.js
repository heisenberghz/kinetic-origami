export const presenceLimits = {
  hoverHeight: 1.2,
  minPitch: -0.62,
  maxPitch: 0.42,
  cruiseSpeed: 2.4,
  boostMultiplier: 2.15,
  acceleration: 3.4,
  damping: 2.6,
  steeringGain: 2.4,
  steeringDeadzone: 0.0022,
  playableRadius: 58,
  bobHeight: 0.075,
  bobRate: 0.62,
  foldHoldMs: 300,
  dragTravelScale: 0.055
};

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}

function damp(current, target, lambda, delta) {
  return current + (target - current) * (1 - Math.exp(-lambda * delta));
}

export function wrapAngle(angle) {
  if (angle > Math.PI) return angle - Math.PI * 2;
  if (angle < -Math.PI) return angle + Math.PI * 2;
  return angle;
}

export function createPresence(options = {}) {
  const limits = { ...presenceLimits, ...(options.limits || {}) };
  const state = {
    x: 0,
    y: limits.hoverHeight,
    z: 0,
    yaw: 0,
    pitch: -0.08,
    velocityX: 0,
    velocityZ: 0,
    bobPhase: 0,
    gliding: null
  };

  function forwardX() {
    return -Math.sin(state.yaw);
  }

  function forwardZ() {
    return -Math.cos(state.yaw);
  }

  function rightX() {
    return Math.cos(state.yaw);
  }

  function rightZ() {
    return -Math.sin(state.yaw);
  }

  function releaseGlide() {
    state.gliding = null;
  }

  function travelSpeed(boost) {
    return boost ? limits.cruiseSpeed * limits.boostMultiplier : limits.cruiseSpeed;
  }

  function applyTravel(input, delta) {
    const speed = travelSpeed(input.boost);
    if (state.gliding) {
      const dx = state.gliding.x - state.x;
      const dz = state.gliding.z - state.z;
      const distance = Math.hypot(dx, dz);
      if (distance < state.gliding.arriveRadius) {
        state.x = state.gliding.x;
        state.z = state.gliding.z;
        releaseGlide();
        state.velocityX = 0;
        state.velocityZ = 0;
        return;
      }
      const easing = Math.min(1, distance / 14);
      const glideSpeed = speed * (0.35 + easing * 0.65);
      state.velocityX = (dx / distance) * glideSpeed;
      state.velocityZ = (dz / distance) * glideSpeed;
      const heading = wrapAngle(Math.atan2(dx, dz) - state.yaw);
      state.yaw = wrapAngle(state.yaw + heading * (1 - Math.exp(-2.4 * delta)));
      return;
    }

    const wishX = forwardX() * input.forward + rightX() * input.strafe;
    const wishZ = forwardZ() * input.forward + rightZ() * input.strafe;
    const wishLength = Math.hypot(wishX, wishZ);

    if (wishLength > 0.001) {
      state.velocityX = damp(state.velocityX, (wishX / wishLength) * speed, limits.acceleration, delta);
      state.velocityZ = damp(state.velocityZ, (wishZ / wishLength) * speed, limits.acceleration, delta);
    } else {
      state.velocityX = damp(state.velocityX, 0, limits.damping, delta);
      state.velocityZ = damp(state.velocityZ, 0, limits.damping, delta);
    }
  }

  function steerFromPointer(pointerDeltaX, delta) {
    if (state.gliding) return 0;
    if (!Number.isFinite(pointerDeltaX)) return 0;
    if (Math.abs(pointerDeltaX) < limits.steeringDeadzone) return 0;
    const strength = (Math.abs(pointerDeltaX) - limits.steeringDeadzone) / (1 - limits.steeringDeadzone);
    return Math.sign(pointerDeltaX) * strength * limits.steeringGain * delta;
  }

  function look(dYaw, dPitch) {
    releaseGlide();
    state.yaw = wrapAngle(state.yaw + dYaw);
    state.pitch = clamp(state.pitch + dPitch, limits.minPitch, limits.maxPitch);
  }

  function dragTravel(deltaX, deltaY) {
    releaseGlide();
    const distance = Math.hypot(deltaX, deltaY) * limits.dragTravelScale * 60;
    if (distance < 0.0001) return;
    const forward = -deltaY / Math.max(1, Math.hypot(deltaX, deltaY));
    const strafe = deltaX / Math.max(1, Math.hypot(deltaX, deltaY));
    state.velocityX += (forwardX() * forward + rightX() * strafe) * distance * 0.06;
    state.velocityZ += (forwardZ() * forward + rightZ() * strafe) * distance * 0.06;
  }

  function glideTo(x, z, arriveRadius = 1.4) {
    state.gliding = { x, z, arriveRadius };
    state.velocityX = 0;
    state.velocityZ = 0;
  }

  function moveTo(x, z, yaw) {
    releaseGlide();
    state.x = x;
    state.z = z;
    if (Number.isFinite(yaw)) state.yaw = wrapAngle(yaw);
    state.velocityX = 0;
    state.velocityZ = 0;
  }

  function update(delta, input = {}) {
    const steer = steerFromPointer(input.pointerDeltaX || 0, delta);
    if (steer !== 0) state.yaw = wrapAngle(state.yaw + steer);

    applyTravel({ forward: input.forward || 0, strafe: input.strafe || 0, boost: input.boost }, delta);

    state.x += state.velocityX * delta;
    state.z += state.velocityZ * delta;

    const distanceFromOrigin = Math.hypot(state.x, state.z);
    if (distanceFromOrigin > limits.playableRadius) {
      const scale = limits.playableRadius / distanceFromOrigin;
      state.x *= scale;
      state.z *= scale;
      state.velocityX *= 0.4;
      state.velocityZ *= 0.4;
    }

    state.bobPhase += delta * limits.bobRate * (1 + Math.hypot(state.velocityX, state.velocityZ) / limits.cruiseSpeed * 0.5);
    state.y = limits.hoverHeight + Math.sin(state.bobPhase) * limits.bobHeight;
  }

  function reset() {
    state.x = 0;
    state.z = 0;
    state.yaw = 0;
    state.pitch = -0.08;
    state.velocityX = 0;
    state.velocityZ = 0;
    state.bobPhase = 0;
    releaseGlide();
  }

  return {
    state,
    limits,
    update,
    look,
    dragTravel,
    glideTo,
    moveTo,
    reset,
    releaseGlide,
    isGliding: () => Boolean(state.gliding),
    get isMoving() {
      return Math.hypot(state.velocityX, state.velocityZ) > 0.05;
    }
  };
}