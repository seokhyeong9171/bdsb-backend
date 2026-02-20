const sanitize = require('../../src/middleware/sanitize');

// Express req/res/next 모킹
function createMockReq(body = {}, query = {}, params = {}) {
  return { body, query, params };
}

describe('XSS Sanitize 미들웨어', () => {
  const next = jest.fn();

  beforeEach(() => {
    next.mockClear();
  });

  test('일반 문자열은 변경하지 않음', () => {
    const req = createMockReq({ name: '홍길동', email: 'test@test.com' });
    sanitize(req, {}, next);

    expect(req.body.name).toBe('홍길동');
    expect(req.body.email).toBe('test@test.com');
    expect(next).toHaveBeenCalled();
  });

  test('script 태그 제거', () => {
    const req = createMockReq({ title: '<script>alert("xss")</script>안녕하세요' });
    sanitize(req, {}, next);

    expect(req.body.title).toBe('안녕하세요');
    expect(req.body.title).not.toContain('script');
  });

  test('img 태그 onerror 제거', () => {
    const req = createMockReq({ content: '<img src=x onerror=alert(1)>' });
    sanitize(req, {}, next);

    expect(req.body.content).not.toContain('onerror');
  });

  test('숫자, boolean은 그대로 유지', () => {
    const req = createMockReq({ price: 10000, isAvailable: true });
    sanitize(req, {}, next);

    expect(req.body.price).toBe(10000);
    expect(req.body.isAvailable).toBe(true);
  });

  test('중첩 객체도 sanitize', () => {
    const req = createMockReq({
      store: { name: '<b>가게</b>', desc: '<script>hack</script>설명' },
    });
    sanitize(req, {}, next);

    expect(req.body.store.name).toBe('가게');
    expect(req.body.store.desc).toBe('설명');
  });

  test('배열 내부도 sanitize', () => {
    const req = createMockReq({
      items: ['<script>1</script>안녕', '<b>굵게</b>'],
    });
    sanitize(req, {}, next);

    expect(req.body.items[0]).toBe('안녕');
    expect(req.body.items[1]).toBe('굵게');
  });

  test('query 파라미터도 sanitize', () => {
    const req = createMockReq({}, { search: '<script>xss</script>검색어' });
    sanitize(req, {}, next);

    expect(req.query.search).toBe('검색어');
  });

  test('next()가 항상 호출됨', () => {
    const req = createMockReq();
    sanitize(req, {}, next);

    expect(next).toHaveBeenCalledTimes(1);
  });
});
