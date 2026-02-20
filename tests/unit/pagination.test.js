const {
  buildCursorQuery,
  buildCursorResponse,
  buildOffsetQuery,
  buildOffsetResponse,
} = require('../../src/utils/pagination');

describe('페이지네이션 유틸리티', () => {
  describe('buildCursorQuery()', () => {
    test('커서 없이 기본 쿼리', () => {
      const result = buildCursorQuery({ limit: 10 });
      expect(result.whereClause).toBe('');
      expect(result.params).toEqual([]);
      expect(result.limitClause).toBe('LIMIT 11'); // limit + 1
      expect(result.parsedLimit).toBe(10);
    });

    test('커서가 있으면 WHERE 조건 생성 (desc)', () => {
      const result = buildCursorQuery({ cursor: '50', limit: 20, direction: 'desc' });
      expect(result.whereClause).toBe('AND id < ?');
      expect(result.params).toEqual(['50']);
    });

    test('커서가 있으면 WHERE 조건 생성 (asc)', () => {
      const result = buildCursorQuery({ cursor: '50', limit: 20, direction: 'asc' });
      expect(result.whereClause).toBe('AND id > ?');
    });

    test('커스텀 cursorColumn', () => {
      const result = buildCursorQuery({ cursor: '2024-01-01', cursorColumn: 'created_at' });
      expect(result.whereClause).toBe('AND created_at < ?');
    });

    test('limit 최대값 제한 (100)', () => {
      const result = buildCursorQuery({ limit: 999 });
      expect(result.parsedLimit).toBe(100);
    });

    test('limit 최소값 (1)', () => {
      const result = buildCursorQuery({ limit: -5 });
      expect(result.parsedLimit).toBe(1);
    });

    test('limit 기본값 (20)', () => {
      const result = buildCursorQuery({});
      expect(result.parsedLimit).toBe(20);
    });
  });

  describe('buildCursorResponse()', () => {
    test('다음 페이지가 있는 경우', () => {
      const rows = Array.from({ length: 21 }, (_, i) => ({ id: 100 - i, name: `item${i}` }));
      const result = buildCursorResponse(rows, { limit: 20 });

      expect(result.items).toHaveLength(20);
      expect(result.hasMore).toBe(true);
      expect(result.nextCursor).toBe('81'); // 마지막 아이템의 id
    });

    test('다음 페이지가 없는 경우', () => {
      const rows = Array.from({ length: 15 }, (_, i) => ({ id: 100 - i, name: `item${i}` }));
      const result = buildCursorResponse(rows, { limit: 20 });

      expect(result.items).toHaveLength(15);
      expect(result.hasMore).toBe(false);
      expect(result.nextCursor).toBeNull();
    });

    test('빈 결과', () => {
      const result = buildCursorResponse([], { limit: 20 });
      expect(result.items).toHaveLength(0);
      expect(result.hasMore).toBe(false);
      expect(result.nextCursor).toBeNull();
    });
  });

  describe('buildOffsetQuery()', () => {
    test('기본값', () => {
      const result = buildOffsetQuery({});
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
      expect(result.offset).toBe(0);
    });

    test('2페이지, 10개씩', () => {
      const result = buildOffsetQuery({ page: '2', limit: '10' });
      expect(result.page).toBe(2);
      expect(result.limit).toBe(10);
      expect(result.offset).toBe(10);
    });

    test('음수 page는 1로', () => {
      const result = buildOffsetQuery({ page: '-1' });
      expect(result.page).toBe(1);
    });
  });

  describe('buildOffsetResponse()', () => {
    test('전체 3페이지 중 1페이지', () => {
      const rows = Array.from({ length: 10 }, (_, i) => ({ id: i + 1 }));
      const result = buildOffsetResponse(rows, 25, { page: 1, limit: 10 });

      expect(result.items).toHaveLength(10);
      expect(result.pagination.page).toBe(1);
      expect(result.pagination.totalCount).toBe(25);
      expect(result.pagination.totalPages).toBe(3);
      expect(result.pagination.hasMore).toBe(true);
    });

    test('마지막 페이지', () => {
      const rows = Array.from({ length: 5 }, (_, i) => ({ id: i + 21 }));
      const result = buildOffsetResponse(rows, 25, { page: 3, limit: 10 });

      expect(result.pagination.hasMore).toBe(false);
    });
  });
});
