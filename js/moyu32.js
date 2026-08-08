/**
 * Driver for MoYu "WCU_MY32" smart cubes (e.g. the Weilong V10 AI).
 *
 * Packets are AES-128 encrypted with a key and IV salted by the cube's bluetooth
 * MAC address, so the MAC has to be discovered (from the advertisement) or asked
 * for before anything can be decoded.
 *
 * Exposes window.connectMoyu32(device), which resolves to an object with the same
 * `on('move')` / `on('disconnected')` interface as the Giiker driver.
 *
 * Protocol details were derived from csTimer's cube support. Reuses EventEmitter
 * from giiker.js, which must be loaded first.
 */
(function () {

const MOYU32_SERVICE_UUID = '0783b03e-7735-b5a0-1760-a305d2795cb0';
const MOYU32_READ_UUID = '0783b03e-7735-b5a0-1760-a305d2795cb1';
const MOYU32_WRITE_UUID = '0783b03e-7735-b5a0-1760-a305d2795cb2';

const MOYU32_NAME_PREFIX = 'WCU_MY3';

// Opcodes, used both as request byte and as the type of the reply.
const MSG_HARDWARE_INFO = 161;
const MSG_STATE = 163;
const MSG_BATTERY = 164;
const MSG_MOVES = 165;
const MSG_GYRO = 171;

// Base key and IV. The first six bytes of each get the cube's MAC mixed in.
const MOYU32_BASE_KEY = [21, 119, 58, 92, 103, 14, 45, 31, 23, 103, 42, 19, 155, 103, 82, 87];
const MOYU32_BASE_IV = [17, 35, 38, 37, 134, 42, 44, 59, 85, 6, 127, 49, 126, 103, 33, 87];

// Faces in the order the cube reports them, which is not the URFDLB order the
// rest of the app uses.
const MOYU32_FACES = 'FBUDLR';
const MOYU32_SOLVED_FACELETS = 'UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB';

const MOYU32_MAC_REGEXP = /^([0-9a-f]{2}[:-]){5}[0-9a-f]{2}$/i;
const MOYU32_MAC_STORAGE_KEY = 'moyu32MacMap';

// The cube advertises its MAC under a company identifier that depends on which
// account it is bound to, so every plausible one has to be requested up front.
// See https://crbug.com/356891475 - on Chromium before 130 an advertisement with
// company id 0x0000 (an unbound cube) breaks gatt.connect() outright.
function moyu32CompanyIds() {
  const ids = [];
  for (let i = 1; i <= 255; i++) {
    ids.push(i << 8);
  }
  const brands = navigator.userAgentData && navigator.userAgentData.brands;
  let buggyChromium = false;
  if (brands) {
    for (const brand of brands) {
      if ((brand.brand === 'Google Chrome' || brand.brand === 'Chromium')
          && parseInt(brand.version, 10) < 130) {
        buggyChromium = true;
      }
    }
  }
  if (!buggyChromium) {
    ids.unshift(0x0000);
  }
  return ids;
}

function macToBytes(mac) {
  const bytes = [];
  for (let i = 0; i < 6; i++) {
    bytes.push(parseInt(mac.slice(i * 3, i * 3 + 2), 16));
  }
  return bytes;
}

function readSavedMacs() {
  try {
    return JSON.parse(localStorage.getItem(MOYU32_MAC_STORAGE_KEY) || '{}');
  } catch (e) {
    return {};
  }
}

function saveMac(deviceName, mac) {
  const macs = readSavedMacs();
  macs[deviceName] = mac;
  localStorage.setItem(MOYU32_MAC_STORAGE_KEY, JSON.stringify(macs));
}

/**
 * The last four characters of the name are the last two bytes of the MAC, which
 * gives a decent starting point for the prompt. The remaining byte is not always
 * 00, so this is only a guess.
 */
function guessMac(deviceName) {
  if (!/^WCU_MY3\d_[0-9A-F]{4}$/.test(deviceName)) {
    return 'xx:xx:xx:xx:xx:xx';
  }
  return 'CF:30:16:00:' + deviceName.slice(9, 11) + ':' + deviceName.slice(11, 13);
}

function promptForMac(deviceName, wrongKey) {
  const saved = readSavedMacs()[deviceName];
  let message = 'Enter the bluetooth MAC address of ' + deviceName + '.\n'
    + 'You can find it in the WCU Cube app, or in your phone\'s bluetooth settings.';
  if (wrongKey) {
    message = 'Could not read anything from ' + deviceName + ' - the MAC address is probably wrong.\n\n' + message;
  }
  const mac = prompt(message, saved || guessMac(deviceName));
  if (!mac || !MOYU32_MAC_REGEXP.test(mac)) {
    return null;
  }
  const normalised = mac.replace(/-/g, ':').toUpperCase();
  // Remembered even before it is known to be right, so that a second prompt can
  // start from what was typed rather than from the guess again.
  saveMac(deviceName, normalised);
  return normalised;
}

/**
 * Reads the MAC out of the manufacturer specific data of an advertisement, where
 * it sits as the last six bytes in reverse order.
 */
function macFromAdvertisement(event, companyIds) {
  const data = event.manufacturerData;
  let view = null;
  if (data instanceof DataView) { // Bluefy hands over a DataView directly
    view = new DataView(data.buffer.slice(2));
  } else {
    for (const id of companyIds) {
      if (data.has(id)) {
        view = data.get(id);
        break;
      }
    }
  }
  if (!view || view.byteLength < 6) {
    return null;
  }
  const bytes = [];
  for (let i = 0; i < 6; i++) {
    bytes.push((view.getUint8(view.byteLength - i - 1) + 0x100).toString(16).slice(1));
  }
  return bytes.join(':').toUpperCase();
}

function watchForMac(device, companyIds, timeout) {
  if (!device.watchAdvertisements) {
    return Promise.resolve(null);
  }
  const abortController = new AbortController();
  return new Promise((resolve) => {
    const done = (mac) => {
      device.removeEventListener('advertisementreceived', onAdvertisement);
      abortController.abort();
      resolve(mac);
    };
    const onAdvertisement = (event) => {
      const mac = macFromAdvertisement(event, companyIds);
      if (mac) {
        done(mac);
      }
    };
    device.addEventListener('advertisementreceived', onAdvertisement);
    device.watchAdvertisements({signal: abortController.signal}).catch(() => done(null));
    setTimeout(() => done(null), timeout);
  });
}

class Moyu32 extends EventEmitter {
  constructor() {
    super();
    this._onValueChanged = this._onValueChanged.bind(this);
    this._onDisconnected = this._onDisconnected.bind(this);
    this._aes = null;
    this._iv = null;
    this._moveCount = -1;
    this._syncedState = false;
    this._batteryLevel = null;
  }

  async connect(device) {
    this._device = device;
    this._deviceName = device.name.trim();

    // Listening for advertisements has to happen before connecting, and takes a
    // few seconds, so it is only worth doing when there is nothing remembered.
    let knownMac = readSavedMacs()[this._deviceName];
    if (!knownMac) {
      knownMac = await watchForMac(device, moyu32CompanyIds(), 5000);
      if (knownMac) {
        console.log('[moyu32] detected MAC address ' + knownMac);
        saveMac(this._deviceName, knownMac);
      }
    }

    const server = await device.gatt.connect();
    const service = await server.getPrimaryService(MOYU32_SERVICE_UUID);
    const characteristics = await service.getCharacteristics();
    this._readCharacteristic = characteristics.find((c) => c.uuid === MOYU32_READ_UUID);
    this._writeCharacteristic = characteristics.find((c) => c.uuid === MOYU32_WRITE_UUID);
    if (!this._readCharacteristic || !this._writeCharacteristic) {
      throw new Error('Could not find the expected characteristics on ' + this._deviceName);
    }

    this._readCharacteristic.addEventListener('characteristicvaluechanged', this._onValueChanged);
    await this._readCharacteristic.startNotifications();

    device.addEventListener('gattserverdisconnected', this._onDisconnected);

    const mac = knownMac || promptForMac(this._deviceName, false);
    if (!mac) {
      this.disconnect();
      throw new Error('A MAC address is needed to talk to ' + this._deviceName);
    }
    await this._useMac(mac);
  }

  disconnect() {
    if (!this._device) {
      return;
    }
    this._device.gatt.disconnect();
  }

  _onDisconnected() {
    clearTimeout(this._keyCheckTimeout);
    this._device = null;
    this.emit('disconnected');
  }

  /**
   * Returns a promise that will resolve to the battery level
   */
  getBatteryLevel() {
    return this._request(MSG_BATTERY).then(() => new Promise((resolve) => {
      const listener = (level) => {
        this.off('battery', listener);
        resolve(level);
      };
      this.on('battery', listener);
    }));
  }

  async _useMac(mac) {
    const macBytes = macToBytes(mac);
    const key = MOYU32_BASE_KEY.slice();
    const iv = MOYU32_BASE_IV.slice();
    for (let i = 0; i < 6; i++) {
      key[i] = (key[i] + macBytes[5 - i]) % 255;
      iv[i] = (iv[i] + macBytes[5 - i]) % 255;
    }
    this._mac = mac;
    this._aes = new aesjs.AES(key);
    this._iv = iv;
    this._sawValidMessage = false;
    this._syncedState = false;
    this._moveCount = -1;

    await this._request(MSG_HARDWARE_INFO);
    await this._request(MSG_STATE);
    await this._request(MSG_BATTERY);

    // Nothing decodable coming back means the key is built from the wrong MAC.
    clearTimeout(this._keyCheckTimeout);
    this._keyCheckTimeout = setTimeout(() => {
      if (!this._sawValidMessage) {
        this._retryWithNewMac();
      }
    }, 2500);
  }

  _retryWithNewMac() {
    clearTimeout(this._keyCheckTimeout);
    if (!this._device) {
      return;
    }
    const mac = promptForMac(this._deviceName, true);
    if (!mac) {
      this.disconnect();
      return;
    }
    this._useMac(mac).catch((e) => console.error(e));
  }

  _request(opcode) {
    const request = new Array(20).fill(0);
    request[0] = opcode;
    return this._writeCharacteristic.writeValue(new Uint8Array(this._encode(request)).buffer);
  }

  /**
   * The first and last sixteen bytes are each xored with the IV and put through a
   * single AES block operation. For a twenty byte packet the two windows overlap,
   * so the order they are applied in matters and is the reverse of _decode.
   */
  _encode(bytes) {
    const result = bytes.slice();
    for (let i = 0; i < 16; i++) {
      result[i] ^= this._iv[i];
    }
    const head = this._aes.encrypt(result.slice(0, 16));
    for (let i = 0; i < 16; i++) {
      result[i] = head[i];
    }
    if (result.length > 16) {
      const offset = result.length - 16;
      const tail = result.slice(offset);
      for (let i = 0; i < 16; i++) {
        tail[i] ^= this._iv[i];
      }
      const encrypted = this._aes.encrypt(tail);
      for (let i = 0; i < 16; i++) {
        result[offset + i] = encrypted[i];
      }
    }
    return result;
  }

  _decode(value) {
    const result = [];
    for (let i = 0; i < value.byteLength; i++) {
      result.push(value.getUint8(i));
    }
    if (result.length > 16) {
      const offset = result.length - 16;
      const tail = this._aes.decrypt(result.slice(offset));
      for (let i = 0; i < 16; i++) {
        result[offset + i] = tail[i] ^ this._iv[i];
      }
    }
    const head = this._aes.decrypt(result.slice(0, 16));
    for (let i = 0; i < 16; i++) {
      result[i] = head[i] ^ this._iv[i];
    }
    return result;
  }

  _onValueChanged(event) {
    if (!this._aes) {
      return;
    }
    const bytes = this._decode(event.target.value);
    const bits = bytes.map((byte) => (byte + 256).toString(2).slice(1)).join('');
    const readBits = (from, to) => parseInt(bits.slice(from, to), 2);

    switch (readBits(0, 8)) {
      case MSG_HARDWARE_INFO:
        this._sawValidMessage = true;
        this._onHardwareInfo(bits, readBits);
        break;
      case MSG_STATE:
        this._sawValidMessage = true;
        this._onState(bits, readBits);
        break;
      case MSG_BATTERY:
        this._batteryLevel = readBits(8, 16);
        if (this._batteryLevel > 100) { // no sensible cube reports this
          console.warn('[moyu32] nonsensical battery level ' + this._batteryLevel);
          this._retryWithNewMac();
          return;
        }
        this._sawValidMessage = true;
        this.emit('battery', this._batteryLevel);
        break;
      case MSG_MOVES:
        this._sawValidMessage = true;
        this._onMoves(bits, readBits);
        break;
      case MSG_GYRO:
        break;
    }
  }

  _onHardwareInfo(bits, readBits) {
    let name = '';
    for (let i = 0; i < 8; i++) {
      name += String.fromCharCode(readBits(8 + i * 8, 16 + i * 8));
    }
    console.log('[moyu32] connected to ' + name
      + ', hardware version ' + readBits(72, 80) + '.' + readBits(80, 88)
      + ', software version ' + readBits(88, 96) + '.' + readBits(96, 104));
  }

  _onState(bits, readBits) {
    // Only the state at connection time is of interest - the app tracks the cube
    // from the moves after that.
    if (this._syncedState) {
      return;
    }
    this._syncedState = true;
    this._moveCount = readBits(152, 160);
    const facelets = this._parseFacelets(bits.slice(8, 152));
    if (facelets !== MOYU32_SOLVED_FACELETS) {
      alert('Your cube is not solved. The virtual cube always starts solved, so solve your cube '
        + 'and reconnect, otherwise the two will not match.');
    }
  }

  _onMoves(bits, readBits) {
    const moveCount = readBits(88, 96);
    // Without a starting move count there is no way to tell which of the five
    // moves in the packet have already been seen.
    if (this._moveCount === -1 || moveCount === this._moveCount) {
      return;
    }

    const moves = [];
    for (let i = 0; i < 5; i++) {
      const move = readBits(96 + i * 5, 101 + i * 5);
      if (move >= 12) { // not a real move, the whole packet is untrustworthy
        return;
      }
      moves.push(this._parseMove(move));
    }

    // The packet holds the five most recent moves, newest first. Anything beyond
    // that is lost for good.
    let newMoves = (moveCount - this._moveCount) & 0xff;
    this._moveCount = moveCount;
    if (newMoves > moves.length) {
      console.warn('[moyu32] missed ' + (newMoves - moves.length) + ' moves');
      newMoves = moves.length;
    }
    for (let i = newMoves - 1; i >= 0; i--) {
      this.emit('move', moves[i]);
    }
  }

  _parseMove(move) {
    const face = MOYU32_FACES.charAt(move >> 1);
    const amount = (move & 1) ? -1 : 1;
    return {face, amount, notation: amount === -1 ? face + "'" : face};
  }

  /**
   * The 144 state bits are eight three bit colours per face, in FBUDLR order and
   * missing the centres. Returns the 54 character facelet string in URFDLB order
   * that the rest of the cubing world uses.
   */
  _parseFacelets(bits) {
    const facelets = [];
    const faceOrder = [2, 5, 0, 3, 4, 1]; // URFDLB expressed in FBUDLR indices
    for (const face of faceOrder) {
      const faceBits = bits.slice(face * 24, face * 24 + 24);
      for (let i = 0; i < 8; i++) {
        facelets.push(MOYU32_FACES.charAt(parseInt(faceBits.slice(i * 3, i * 3 + 3), 2)));
        if (i === 3) {
          facelets.push(MOYU32_FACES.charAt(face));
        }
      }
    }
    return facelets.join('');
  }
}

window.MOYU32_SERVICE_UUID = MOYU32_SERVICE_UUID;
window.MOYU32_NAME_PREFIX = MOYU32_NAME_PREFIX;
window.moyu32CompanyIds = moyu32CompanyIds;

// The colours this cube has in front and on top when it reports a solved state, i.e. the frame
// its face names are relative to. Standard stickering: green front puts white up.
const MOYU32_NATIVE_ORIENTATION = 'green|white';

window.connectMoyu32 = async (device) => {
  const moyu32 = new Moyu32();
  await moyu32.connect(device);
  moyu32.nativeOrientation = MOYU32_NATIVE_ORIENTATION;
  return moyu32;
};

})();
