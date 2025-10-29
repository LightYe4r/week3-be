# Backend - MyApp

Node.js + Express + MySQL 기반 백엔드 API

## 환경변수 설정

`.env` 파일을 생성하고 다음 값들을 설정하세요:

```bash
# Server Configuration
PORT=3000
NODE_ENV=production

# Database Configuration
DB_HOST=your-rds-endpoint.rds.amazonaws.com
DB_PORT=3306
DB_NAME=myappdb
DB_USER=admin
DB_PASSWORD=your-password

# JWT Secret (반드시 변경!)
JWT_SECRET=your-jwt-secret

# CORS (프론트엔드 URL)
CORS_ORIGIN=http://your-domain.com
```

## 로컬 실행

```bash
# 의존성 설치
npm install

# 개발 모드
npm run dev

# 프로덕션 모드
npm start
```

## Docker 빌드 & 실행

```bash
# 이미지 빌드
docker build -t myapp-backend .

# 컨테이너 실행 (환경변수 파일 사용)
docker run -d -p 3000:3000 --env-file .env myapp-backend

# 또는 직접 환경변수 지정
docker run -d -p 3000:3000 \
  -e DB_HOST=your-rds-endpoint.ap-northeast-2.rds.amazonaws.com \
  -e DB_USER=admin \
  -e DB_PASSWORD=smileshark \
  -e DB_NAME=myappdb \
  -e JWT_SECRET=your-secret \
  -e CORS_ORIGIN=http://your-domain.com \
  myapp-backend
```

## API 엔드포인트

### Public
- `POST /api/signup` - 회원가입
- `POST /api/login` - 로그인
- `GET /api/health` - 헬스체크

### Protected (JWT 필요)
- `GET /api/logs/me` - 내 로그인 기록

### Admin Only
- `GET /api/logs/all` - 전체 로그인 기록

## 기본 계정

- Username: `admin`
- Password: `admin123`
- Role: Admin

## ECS Task Definition 환경변수 설정

```json
{
  "containerDefinitions": [{
    "name": "backend",
    "image": "YOUR_ACCOUNT_ID.dkr.ecr.ap-northeast-2.amazonaws.com/myapp-backend:latest",
    "portMappings": [{
      "containerPort": 3000,
      "protocol": "tcp"
    }],
    "environment": [
      {
        "name": "NODE_ENV",
        "value": "production"
      },
      {
        "name": "PORT",
        "value": "3000"
      },
      {
        "name": "DB_HOST",
        "value": "your-rds-endpoint.ap-northeast-2.rds.amazonaws.com"
      },
      {
        "name": "DB_PORT",
        "value": "3306"
      },
      {
        "name": "DB_NAME",
        "value": "myappdb"
      },
      {
        "name": "DB_USER",
        "value": "admin"
      },
      {
        "name": "DB_PASSWORD",
        "value": "smileshark"
      },
      {
        "name": "JWT_SECRET",
        "value": "your-super-secret-jwt-key"
      },
      {
        "name": "CORS_ORIGIN",
        "value": "http://your-domain.com"
      }
    ]
  }]
}
```

## ECR 푸시

```bash
# ECR 로그인
aws ecr get-login-password --region ap-northeast-2 | \
  docker login --username AWS --password-stdin \
  YOUR_ACCOUNT_ID.dkr.ecr.ap-northeast-2.amazonaws.com

# 레포지토리 생성
aws ecr create-repository --repository-name myapp-backend --region ap-northeast-2

# 태그
docker tag myapp-backend:latest \
  YOUR_ACCOUNT_ID.dkr.ecr.ap-northeast-2.amazonaws.com/myapp-backend:latest

# 푸시
docker push YOUR_ACCOUNT_ID.dkr.ecr.ap-northeast-2.amazonaws.com/myapp-backend:latest
```

## 데이터베이스 스키마

### users 테이블
```sql
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    email VARCHAR(100),
    is_admin BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### login_logs 테이블
```sql
CREATE TABLE login_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    username VARCHAR(50) NOT NULL,
    login_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ip_address VARCHAR(45),
    user_agent TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

## 주의사항

1. **JWT_SECRET**: 프로덕션에서는 반드시 강력한 비밀키로 변경
2. **DB_PASSWORD**: RDS 생성 시 설정한 비밀번호 사용
3. **CORS_ORIGIN**: 프론트엔드 ALB 주소로 설정
4. 데이터베이스 테이블은 서버 시작 시 자동 생성됨
