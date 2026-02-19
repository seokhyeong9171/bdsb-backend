const adjectives = [
  '배고픈', '든든한', '행복한', '즐거운', '맛있는',
  '따뜻한', '시원한', '달콤한', '고소한', '바삭한',
  '푸짐한', '상큼한', '매콤한', '새콤한', '담백한',
];

const nouns = [
  '치킨', '피자', '떡볶이', '김밥', '라면',
  '족발', '냉면', '짜장면', '초밥', '햄버거',
  '타코야키', '붕어빵', '만두', '곱창', '삼겹살',
];

function generateNickname() {
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  const num = Math.floor(Math.random() * 10000);
  return `${adj}${noun}${num}`;
}

module.exports = { generateNickname };
