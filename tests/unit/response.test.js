const { success, error } = require('../../src/utils/response');

// Express res 객체 모킹
function createMockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe('응답 헬퍼', () => {
  describe('success()', () => {
    test('기본 성공 응답 (200)', () => {
      const res = createMockRes();
      success(res, { id: 1 }, '조회 성공');

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: '조회 성공',
        data: { id: 1 },
      });
    });

    test('커스텀 상태 코드 (201)', () => {
      const res = createMockRes();
      success(res, { id: 1 }, '생성 성공', 201);

      expect(res.status).toHaveBeenCalledWith(201);
    });

    test('데이터 없이 메시지만', () => {
      const res = createMockRes();
      success(res, null, '삭제 성공');

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: '삭제 성공',
        data: null,
      });
    });

    test('기본값 사용', () => {
      const res = createMockRes();
      success(res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: '성공',
        data: null,
      });
    });
  });

  describe('error()', () => {
    test('기본 에러 응답 (500)', () => {
      const res = createMockRes();
      error(res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: '서버 오류',
      });
    });

    test('커스텀 에러 (400)', () => {
      const res = createMockRes();
      error(res, '잘못된 요청입니다.', 400);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: '잘못된 요청입니다.',
      });
    });

    test('에러 배열 포함', () => {
      const res = createMockRes();
      const errors = [{ field: 'email', message: '유효한 이메일을 입력하세요.' }];
      error(res, '유효성 검사 실패', 422, errors);

      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: '유효성 검사 실패',
        errors,
      });
    });
  });
});
