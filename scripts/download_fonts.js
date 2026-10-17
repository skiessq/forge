const https = require('https');
const fs = require('fs');
const path = require('path');

const fontsDir = path.join(__dirname, '..', 'assets', 'fonts');
if (!fs.existsSync(fontsDir)) fs.mkdirSync(fontsDir, { recursive: true });

const fonts = [
  { name: 'Montserrat-Bold.ttf', url: 'https://fonts.gstatic.com/s/montserrat/v31/JTUHjIg1_i6t8kCHKm4532VJOt5-QNFgpCuM70w-.ttf' },
  { name: 'Montserrat-Black.ttf', url: 'https://fonts.gstatic.com/s/montserrat/v31/JTUHjIg1_i6t8kCHKm4532VJOt5-QNFgpCvC70w-.ttf' },
  { name: 'Montserrat.ttf', url: 'https://fonts.gstatic.com/s/montserrat/v31/JTUHjIg1_i6t8kCHKm4532VJOt5-QNFgpCvC70w-.ttf' },
  { name: 'Anton-Regular.ttf', url: 'https://raw.githubusercontent.com/google/fonts/main/ofl/anton/Anton-Regular.ttf' },
  { name: 'BebasNeue-Regular.ttf', url: 'https://raw.githubusercontent.com/google/fonts/main/ofl/bebasneue/BebasNeue-Regular.ttf' },
  { name: 'Bangers.ttf', url: 'https://fonts.gstatic.com/s/bangers/v25/FeVQS0BTqb0h60ACL5k.ttf' },
  { name: 'LuckiestGuy.ttf', url: 'https://fonts.gstatic.com/s/luckiestguy/v25/_gP_1RrxsjcxVyin9l9n_j2RSg.ttf' },
  { name: 'RussoOne.ttf', url: 'https://fonts.gstatic.com/s/russoone/v18/Z9XUDmZRWg6M1LvRYsH-yA.ttf' },
  { name: 'TitanOne-Regular.ttf', url: 'https://raw.githubusercontent.com/google/fonts/main/ofl/titanone/TitanOne-Regular.ttf' },
  { name: 'RubikGlitch-Regular.ttf', url: 'https://raw.githubusercontent.com/google/fonts/main/ofl/rubikglitch/RubikGlitch-Regular.ttf' },
  { name: 'Oswald.ttf', url: 'https://raw.githubusercontent.com/google/fonts/main/ofl/oswald/Oswald%5Bwght%5D.ttf' },
  { name: 'Inter.ttf', url: 'https://raw.githubusercontent.com/google/fonts/main/ofl/inter/Inter%5Bopsz%2Cwght%5D.ttf' },
];

function downloadFont(font) {
  return new Promise((resolve, reject) => {
    const dest = path.join(fontsDir, font.name);
    if (fs.existsSync(dest) && fs.statSync(dest).size > 10000) {
      console.log(`Already exists: ${font.name} (${fs.statSync(dest).size} bytes)`);
      return resolve(font.name);
    }
    const file = fs.createWriteStream(dest);

    const get = (url) => {
      https.get(url, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          get(res.headers.location);
        } else if (res.statusCode === 200) {
          res.pipe(file);
          file.on('finish', () => {
            file.close();
            console.log(`Downloaded: ${font.name} (${fs.statSync(dest).size} bytes)`);
            resolve(font.name);
          });
        } else {
          file.close();
          if (fs.existsSync(dest)) fs.unlinkSync(dest);
          reject(new Error(`Failed ${font.name} with HTTP ${res.statusCode}`));
        }
      }).on('error', (err) => {
        file.close();
        if (fs.existsSync(dest)) fs.unlinkSync(dest);
        reject(err);
      });
    };

    get(font.url);
  });
}

Promise.all(fonts.map(downloadFont))
  .then(() => console.log('ALL VIRAL FONTS READY IN assets/fonts!'))
  .catch((e) => console.error('Font download error:', e));
