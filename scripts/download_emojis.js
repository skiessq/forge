const https = require('https');
const fs = require('fs');
const path = require('path');

const emojisDir = path.join(__dirname, '..', 'assets', 'emojis');
if (!fs.existsSync(emojisDir)) fs.mkdirSync(emojisDir, { recursive: true });

// Common viral video emojis
const emojiHexes = [
  '1f62e', // 😮
  '1f631', // 😱
  '1f480', // 💀
  '1f525', // 🔥
  '1f602', // 😂
  '1f923', // 🤣
  '1f62d', // 😭
  '1f60d', // 😍
  '1f92f', // 🤯
  '1f633', // 😳
  '1f92b', // 🤫
  '1f440', // 👀
  '1f4af', // 💯
  '2728',  // ✨
  '1f6a8', // 🚨
  '26a0',  // ⚠️
  '26a1',  // ⚡
  '1f4a5', // 💥
  '1f451', // 👑
  '1f3c6', // 🏆
  '1f947', // 🥇
  '1f4b0', // 💰
  '1f4b8', // 💸
  '1f680', // 🚀
  '1f3af', // 🎯
  '1f987', // 🦇
  '1f410', // 🐐
  '1f976', // 🥶
  '1f975', // 🥵
  '1f608', // 😈
  '1f921', // 🤡
  '1f922', // 🤢
  '1f92e', // 🤮
  '1f971', // 🥱
  '1f634', // 😴
  '1f914', // 🤔
  '1f928', // 🤨
  '1f610', // 😐
  '1f611', // 😑
  '1f644', // 🙄
  '1f60f', // 😏
  '1f924', // 🤤
  '1f973', // 🥳
  '1f60e', // 😎
  '1f913', // 🤓
  '1f9d0', // 🧐
  '1f97a', // 🥺
  '1f621', // 😡
  '1f62c', // 🤬
  '2764',  // ❤️
  '1f494', // 💔
  '1f44f', // 👏
  '1f64c', // 🙌
  '1f44d', // 👍
  '1f44e', // 👎
  '1f44a', // 👊
  '1f91d', // 🤝
  '1f64f', // 🙏
  '1f4aa', // 💪
  '1f9e0', // 🧠
  '1f4a3', // 💣
  '2b50',  // ⭐
  '1f31f', // 🌟
  '1f37f', // 🍿
  '1f3ae', // 🎮
  '1f3b2', // 🎲
  '1f48e', // 💎
  '1fa84', // 🪄
  '2694',  // ⚔️
  '1f6e1', // 🛡️
  '1f9e8', // 🧨
  '1f514', // 🔔
  '1f4e2', // 📢
  '1f3b5', // 🎵
  '1f3b6', // 🎶
  '1f4f8', // 📸
  '1f4bb', // 💻
  '1f4f1', // 📱
  '1f4a1', // 💡
  '1f389', // 🎉
];

function downloadEmoji(hex) {
  return new Promise((resolve) => {
    const dest = path.join(emojisDir, `${hex}.png`);
    if (fs.existsSync(dest) && fs.statSync(dest).size > 100) {
      return resolve(hex);
    }

    const url = `https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/72x72/${hex}.png`;
    const fallbackUrl = `https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/${hex}.png`;

    const tryDownload = (targetUrl, useFallbackOnFail) => {
      const file = fs.createWriteStream(dest);
      https.get(targetUrl, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          tryDownload(res.headers.location, useFallbackOnFail);
        } else if (res.statusCode === 200) {
          res.pipe(file);
          file.on('finish', () => {
            file.close();
            resolve(hex);
          });
        } else {
          file.close();
          if (fs.existsSync(dest)) fs.unlinkSync(dest);
          if (useFallbackOnFail) {
            tryDownload(fallbackUrl, false);
          } else {
            resolve(null);
          }
        }
      }).on('error', () => {
        file.close();
        if (fs.existsSync(dest)) fs.unlinkSync(dest);
        if (useFallbackOnFail) {
          tryDownload(fallbackUrl, false);
        } else {
          resolve(null);
        }
      });
    };

    tryDownload(url, true);
  });
}

async function run() {
  console.log(`Starting download for ${emojiHexes.length} viral emojis...`);
  let count = 0;
  for (const hex of emojiHexes) {
    const res = await downloadEmoji(hex);
    if (res) count++;
  }
  console.log(`Done! ${count}/${emojiHexes.length} emojis ready in assets/emojis.`);
}

run();
