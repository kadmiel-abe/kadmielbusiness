const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// CRC32 implementation for PNG chunks
function crc32(buf) {
  let table = new Int32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (-306674912 ^ (c >>> 1)) : (c >>> 1);
    table[i] = c;
  }
  let crc = -1;
  for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ -1) >>> 0;
}

function chunk(type, data) {
  const t = Buffer.from(type, 'ascii');
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
  return Buffer.concat([len, t, data, crc]);
}

/**
 * Génère une icône PNG professionnelle aux dimensions exactes avec le thème Business Pay
 * (Fond noir #000000, bordure dégradée et symbole géométrique néon vert #00F06C)
 */
function createBusinessPayIcon(size) {
  const width = size;
  const height = size;
  const raw = Buffer.alloc((width * 4 + 1) * height);

  const cx = width / 2;
  const cy = height / 2;
  const radius = width * 0.44; // Rayon du badge central
  const innerRadius = width * 0.38;

  // Couleurs
  // Neon Green #00F06C -> R: 0, G: 240, B: 108
  // Emerald Dark #08481B -> R: 8, G: 72, B: 27
  // Black #000000

  for (let y = 0; y < height; y++) {
    const rowOffset = y * (width * 4 + 1);
    raw[rowOffset] = 0; // Filter: None

    for (let x = 0; x < width; x++) {
      const px = rowOffset + 1 + x * 4;
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Fond extérieur : Noir pur
      let r = 0, g = 0, b = 0, a = 255;

      // Squircle / Carte arrondie pour maskable icon
      const cornerR = width * 0.22;
      const qx = Math.max(Math.abs(x - cx) - (width * 0.44 - cornerR), 0);
      const qy = Math.max(Math.abs(y - cy) - (height * 0.44 - cornerR), 0);
      const squircleDist = Math.sqrt(qx * qx + qy * qy);

      if (squircleDist <= cornerR) {
        // Dans le squircle : Fond sombre avec bordure émeraude néon
        const isBorder = squircleDist >= cornerR - (width * 0.035);
        if (isBorder) {
          // Bordure lumineuse néon vert #00F06C
          r = 0;
          g = 240;
          b = 108;
        } else {
          // Dégradé intérieur du badge noir/émeraude profond
          const grad = (y / height) * 0.15;
          r = Math.round(5 + grad * 10);
          g = Math.round(15 + grad * 35);
          b = Math.round(10 + grad * 20);
        }

        // Dessin du monogramme "B" & "P" stylisé (Business Pay)
        // Tige verticale gauche
        const barLeft = cx - width * 0.22;
        const barRight = cx - width * 0.10;
        const barTop = cy - height * 0.26;
        const barBottom = cy + height * 0.26;

        const inStem = (x >= barLeft && x <= barRight && y >= barTop && y <= barBottom);

        // Boucle supérieure du "B"
        const topLoopCx = cx;
        const topLoopCy = cy - height * 0.13;
        const topLoopR = height * 0.13;
        const distTopLoop = Math.sqrt((x - topLoopCx) ** 2 + (y - topLoopCy) ** 2);
        const inTopLoop = distTopLoop <= topLoopR && x >= barRight - 2;
        const inTopLoopHole = distTopLoop <= (topLoopR * 0.48);

        // Boucle inférieure du "B"
        const botLoopCx = cx + width * 0.02;
        const botLoopCy = cy + height * 0.12;
        const botLoopR = height * 0.14;
        const distBotLoop = Math.sqrt((x - botLoopCx) ** 2 + (y - botLoopCy) ** 2);
        const inBotLoop = distBotLoop <= botLoopR && x >= barRight - 2;
        const inBotLoopHole = distBotLoop <= (botLoopR * 0.48);

        // Éclair / Vague Mobile Money stylisée au centre
        const waveX = cx + width * 0.12;
        const waveY = cy;
        const distWave = Math.sqrt((x - waveX) ** 2 + (y - waveY) ** 2);

        if (inStem || (inTopLoop && !inTopLoopHole) || (inBotLoop && !inBotLoopHole)) {
          // Couleur Néon Green ultra vive #00F06C
          r = 0;
          g = 240;
          b = 108;
        } else if (distWave <= width * 0.04) {
          // Point lumineux / accent
          r = 255;
          g = 255;
          b = 255;
        }
      }

      raw[px] = r;
      raw[px + 1] = g;
      raw[px + 2] = b;
      raw[px + 3] = a;
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type: RGBA
  ihdr[10] = 0; // compression method
  ihdr[11] = 0; // filter method
  ihdr[12] = 0; // interlace method

  const idat = zlib.deflateSync(raw, { level: 9 });

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// Création des dossiers
const publicDir = path.join(__dirname, '..', 'public');
const iconsDir = path.join(publicDir, 'icons');
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

console.log('Génération des icônes PWA...');
const sizes = [192, 512];

sizes.forEach((s) => {
  const pngBuf = createBusinessPayIcon(s);
  // Sauvegarde dans public/icons/icon-SxS.png
  const destPath = path.join(iconsDir, `icon-${s}x${s}.png`);
  fs.writeFileSync(destPath, pngBuf);
  console.log(`✓ Créé : ${destPath} (${pngBuf.length} octets)`);

  // Sauvegarde également à la racine de public/ pour accès direct
  const rootPublicPath = path.join(publicDir, `icon-${s}x${s}.png`);
  fs.writeFileSync(rootPublicPath, pngBuf);
  console.log(`✓ Créé : ${rootPublicPath} (${pngBuf.length} octets)`);
});

// Icône Apple Touch Icon 180x180
const appleIconBuf = createBusinessPayIcon(180);
fs.writeFileSync(path.join(publicDir, 'apple-touch-icon.png'), appleIconBuf);
console.log('✓ Créé : public/apple-touch-icon.png');

console.log('Toutes les icônes PWA ont été générées avec succès !');
