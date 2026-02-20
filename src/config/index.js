require('dotenv').config();
const { z } = require('zod');

const envSchema = z.object({
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  DB_HOST: z.string().default('localhost'),
  DB_PORT: z.coerce.number().default(3306),
  DB_USER: z.string().default('root'),
  DB_PASSWORD: z.string().default('root'),
  DB_NAME: z.string().default('BDSB'),
  JWT_SECRET: z.string().min(1, 'JWT_SECRET 환경변수가 설정되어야 합니다.').default('default_secret'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('30d'),
  UPLOAD_DIR: z.string().default('uploads'),
  MAX_FILE_SIZE: z.coerce.number().default(5 * 1024 * 1024),
  DB_SSL: z.enum(['true', 'false']).default('false'),
});

const env = envSchema.parse(process.env);

// 프로덕션에서 기본 JWT 시크릿 사용 차단
if (env.NODE_ENV === 'production' && env.JWT_SECRET === 'default_secret') {
  console.error('치명적 오류: 프로덕션 환경에서 JWT_SECRET을 반드시 설정하세요.');
  process.exit(1);
}

module.exports = {
  port: env.PORT,
  nodeEnv: env.NODE_ENV,
  db: {
    host: env.DB_HOST,
    port: env.DB_PORT,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    database: env.DB_NAME,
    ssl: env.DB_SSL === 'true',
  },
  jwt: {
    secret: env.JWT_SECRET,
    expiresIn: env.JWT_EXPIRES_IN,
    refreshExpiresIn: env.JWT_REFRESH_EXPIRES_IN,
  },
  upload: {
    dir: env.UPLOAD_DIR,
    maxFileSize: env.MAX_FILE_SIZE,
  },
};
