/**
 * Picks a smart cube and hands it to the driver that speaks its protocol.
 *
 * requestDevice may only be called once per user gesture, so every supported make
 * has to be offered by the same call.
 */
const connect = async () => {
  if (!window.navigator) {
    throw new Error('window.navigator is not accesible. Maybe you\'re running Node.js?');
  }

  if (!window.navigator.bluetooth) {
    throw new Error('Web Bluetooth API is not accesible');
  }

  const device = await window.navigator.bluetooth.requestDevice({
    filters: [
      {namePrefix: GIIKER_NAME_PREFIX},
      {namePrefix: MOYU32_NAME_PREFIX},
    ],
    optionalServices: GIIKER_SERVICE_UUIDS.concat([MOYU32_SERVICE_UUID]),
    optionalManufacturerData: moyu32CompanyIds(),
  });

  if (device.name.startsWith(MOYU32_NAME_PREFIX)) {
    return connectMoyu32(device);
  }
  return connectGiikerCube(device);
};
