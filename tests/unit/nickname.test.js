const { generateNickname } = require('../../src/utils/nickname');

describe('닉네임 생성기', () => {
  test('닉네임이 문자열로 생성된다', () => {
    const nickname = generateNickname();
    expect(typeof nickname).toBe('string');
    expect(nickname.length).toBeGreaterThan(0);
  });

  test('닉네임에 숫자가 포함된다', () => {
    const nickname = generateNickname();
    expect(/\d+$/.test(nickname)).toBe(true);
  });

  test('매번 다른 닉네임이 생성될 수 있다 (100회)', () => {
    const nicknames = new Set();
    for (let i = 0; i < 100; i++) {
      nicknames.add(generateNickname());
    }
    // 100회 중 최소 2개 이상 다른 닉네임이 나와야 함
    expect(nicknames.size).toBeGreaterThan(1);
  });
});
