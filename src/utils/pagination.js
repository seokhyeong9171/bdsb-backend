/**
 * 커서 기반 페이지네이션 유틸리티
 *
 * 사용법:
 *   const { buildCursorQuery, buildCursorResponse } = require('../utils/pagination');
 *
 *   // 1. 쿼리 빌드
 *   const { whereClause, params, limitClause } = buildCursorQuery({
 *     cursor: req.query.cursor,
 *     limit: req.query.limit,
 *     cursorColumn: 'id',        // 커서 기준 컬럼 (기본: id)
 *     direction: 'desc',         // 정렬 방향 (기본: desc)
 *   });
 *
 *   // 2. 쿼리 실행
 *   const rows = await conn.query(
 *     `SELECT * FROM meetings WHERE status = 'recruiting' ${whereClause}
 *      ORDER BY id DESC ${limitClause}`,
 *     [...otherParams, ...params]
 *   );
 *
 *   // 3. 응답 빌드
 *   const result = buildCursorResponse(rows, { limit, cursorColumn: 'id' });
 *   // → { items: [...], nextCursor: "123", hasMore: true }
 */

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

/**
 * 커서 기반 페이지네이션을 위한 쿼리 조건 생성
 * @param {Object} options
 * @param {string|number} [options.cursor] - 커서 값 (이전 응답의 nextCursor)
 * @param {number} [options.limit=20] - 페이지당 항목 수
 * @param {string} [options.cursorColumn='id'] - 커서 기준 컬럼
 * @param {string} [options.direction='desc'] - 정렬 방향 (asc | desc)
 * @returns {{ whereClause: string, params: Array, limitClause: string, parsedLimit: number }}
 */
function buildCursorQuery(options = {}) {
  const {
    cursor,
    limit: rawLimit,
    cursorColumn = 'id',
    direction = 'desc',
  } = options;

  const parsedLimit = Math.min(Math.max(parseInt(rawLimit) || DEFAULT_LIMIT, 1), MAX_LIMIT);
  const operator = direction === 'desc' ? '<' : '>';

  let whereClause = '';
  const params = [];

  if (cursor) {
    whereClause = `AND ${cursorColumn} ${operator} ?`;
    params.push(cursor);
  }

  // limit + 1로 가져와서 다음 페이지 존재 여부 판단
  const limitClause = `LIMIT ${parsedLimit + 1}`;

  return { whereClause, params, limitClause, parsedLimit };
}

/**
 * 커서 기반 페이지네이션 응답 생성
 * @param {Array} rows - 쿼리 결과 (limit + 1 개 가져온 상태)
 * @param {Object} options
 * @param {number} options.limit - 요청한 limit (parsedLimit)
 * @param {string} [options.cursorColumn='id'] - 커서 기준 컬럼
 * @returns {{ items: Array, nextCursor: string|null, hasMore: boolean }}
 */
function buildCursorResponse(rows, options = {}) {
  const { limit = DEFAULT_LIMIT, cursorColumn = 'id' } = options;
  const hasMore = rows.length > limit;

  // limit + 1로 가져왔으므로 초과분 제거
  const items = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore ? String(items[items.length - 1][cursorColumn]) : null;

  return { items, nextCursor, hasMore };
}

/**
 * 오프셋 기반 페이지네이션 (하위호환)
 * 기존 offset 방식 호출도 유지하되, 표준 응답 형식 적용
 * @param {Object} query - req.query
 * @returns {{ page: number, limit: number, offset: number }}
 */
function buildOffsetQuery(query = {}) {
  const page = Math.max(parseInt(query.page) || 1, 1);
  const limit = Math.min(Math.max(parseInt(query.limit) || DEFAULT_LIMIT, 1), MAX_LIMIT);
  const offset = (page - 1) * limit;

  return { page, limit, offset };
}

/**
 * 오프셋 기반 페이지네이션 응답 생성
 * @param {Array} rows - 쿼리 결과
 * @param {number} totalCount - 전체 레코드 수
 * @param {Object} pagination - { page, limit }
 * @returns {{ items: Array, pagination: Object }}
 */
function buildOffsetResponse(rows, totalCount, pagination) {
  const { page, limit } = pagination;
  const totalPages = Math.ceil(totalCount / limit);

  return {
    items: rows,
    pagination: {
      page,
      limit,
      totalCount,
      totalPages,
      hasMore: page < totalPages,
    },
  };
}

module.exports = {
  buildCursorQuery,
  buildCursorResponse,
  buildOffsetQuery,
  buildOffsetResponse,
  DEFAULT_LIMIT,
  MAX_LIMIT,
};
