# BLITZPIT -- 사업부서장 직속 프로젝트

## 프로젝트 정의

**BLITZPIT** -- 복셀 무한 생존 배틀로얄 웹게임
브라우저 즉시 플레이, 설치 불필요, 모바일/PC 양대응.
URL: https://github.com/meshedwell-x/blitzpit (public)

### 핵심 게임 컨셉
- PUBG 스타일 배틀로얄 + **무한 웨이브 서바이벌**
- 단일 세션이 아닌 **상시 세션**: 웨이브 클리어 -> 존 리셋 -> 새 봇 스폰 -> 무한 반복
- 가장 오래 살아남고 많이 죽인 자가 전설이 되는 구조
- 킬스트릭, 랭크(Rookie -> God of War), 리더보드로 **자랑질** 가능

### 스택
- Next.js 14 + Three.js + Tailwind CSS
- TypeScript strict
- Cloudflare Pages 배포 (예정)

## 코드 구조

```
battleground/
├── src/
│   ├── app/
│   │   ├── page.tsx              # 엔트리 (dynamic import GameUI)
│   │   └── layout.tsx
│   ├── components/
│   │   └── GameUI.tsx            # 전체 UI (HUD, 스코어보드, 모바일 컨트롤, 미니맵)
│   └── game/
│       ├── core/
│       │   ├── GameEngine.ts     # 게임 루프, 페이즈 관리, 시스템 통합
│       │   ├── WaveManager.ts    # 무한 웨이브 설정, 난이도 스케일링
│       │   ├── constants.ts      # 게임 상수, 무기/존/웨이브 설정
│       │   └── noise.ts          # Simplex noise (지형 생성)
│       ├── player/
│       │   └── PlayerController.ts  # 3인칭 플레이어, 이동, 카메라
│       ├── world/
│       │   └── WorldGenerator.ts    # 지형, 건물, 나무, 아이템 스폰
│       ├── weapons/
│       │   ├── WeaponSystem.ts      # 5종 무기, 총알, 아이템 드롭
│       │   └── GrenadeSystem.ts     # 3종 수류탄 (파편/연막/섬광)
│       ├── bots/
│       │   └── BotSystem.ts         # AI 봇, 5상태 FSM, 웨이브 리스폰
│       ├── zone/
│       │   └── ZoneSystem.ts        # 6페이즈 블루존, 수축/리셋
│       ├── vehicles/
│       │   └── VehicleSystem.ts     # 3종 차량 (지프/버기/트럭)
│       ├── score/
│       │   └── ScoreboardSystem.ts  # 킬스트릭, 랭크, localStorage 리더보드
│       ├── audio/
│       │   └── SoundManager.ts      # Web Audio API 절차적 사운드
│       └── effects/
│           └── ParticleSystem.ts    # Three.js 파티클 (폭발, 히트스파크)
├── package.json
├── tsconfig.json
├── tailwind.config.ts
└── CLAUDE.md
```

## 게임 플로우

```
LOBBY -> START -> PLANE -> DROP -> WAVE 1 (PLAYING) ->
  [모든 봇 사망] -> WAVE TRANSITION (8초) ->
  [존 리셋, 새 봇 스폰, 플레이어 +25hp] -> WAVE 2 (PLAYING) ->
  [계속...] -> PLAYER DIES -> GAME OVER (최종 스탯 + 리더보드)
```

### GamePhase
`lobby` | `plane` | `dropping` | `playing` | `wave_transition` | `dead`

### 웨이브 스케일링
- Wave 1: 39봇, 기본 난이도
- Wave N: min(39 + N*5, 80)봇, 스킬/아머/무기 확률 점진 증가
- 존 수축 속도: 1 + N*0.1 배율

## 키바인딩
| 키 | 기능 |
|---|------|
| WASD | 이동 |
| SHIFT | 달리기 |
| C | 웅크리기 |
| SPACE | 점프 / 비행기 점프 / 낙하산 |
| 마우스 | 조준 |
| 좌클릭 | 사격 |
| R | 재장전 |
| F | 아이템 줍기 |
| 1/2 | 무기 슬롯 |
| T | 수류탄 타입 전환 |
| Q | 무기 드롭 |
| E | 차량 탑승/하차 |
| TAB | 인벤토리 |
| M | 음소거 |

## 조직 구조

```
SNAKE GAMES 사업부서장 (Opus)
└── BLITZPIT 팀장 (Opus) -- 프로젝트 총괄
     │
     ├── [기획 조직]
     │   ├── PM (Opus) -- 게임 기획, 웨이브 밸런스, 로드맵
     │   ├── 밸런스 기획자 (Opus) -- 무기/봇/존 밸런스 수치
     │   └── 비판적 기획자 (Opus) -- Devil's Advocate
     │
     ├── [엔진/코어팀] 5명
     │   ├── 엔진 리드 (Opus) -- GameEngine, 렌더링, 성능 총괄
     │   ├── 렌더러 개발자 (Sonnet) -- Three.js, 셰이더, LOD
     │   ├── 물리/충돌 개발자 (Sonnet) -- 물리, 충돌, 탄도
     │   ├── 월드젠 개발자 (Sonnet) -- WorldGenerator, 지형
     │   └── 코어 유틸 (Haiku) -- 상수, 타입, 설정
     │
     ├── [게임플레이팀] 5명
     │   ├── 게임플레이 리드 (Opus) -- 전투/밸런스 품질
     │   ├── 무기 개발자 (Sonnet) -- WeaponSystem, GrenadeSystem
     │   ├── 플레이어 개발자 (Sonnet) -- PlayerController
     │   ├── 차량 개발자 (Sonnet) -- VehicleSystem
     │   └── 봇/AI 개발자 (Sonnet) -- BotSystem, AI FSM
     │
     ├── [멀티플레이어/인프라팀] 4명
     │   ├── 넷코드 리드 (Opus) -- 멀티플레이어 아키텍처
     │   ├── 서버 개발자 (Sonnet) -- Cloudflare Workers
     │   ├── 클라이언트 넷코드 (Sonnet) -- 예측/보간
     │   └── 인프라 (Haiku) -- 배포, CI/CD
     │
     ├── [UI/UX팀] 3명
     │   ├── UI 리드 (Sonnet) -- GameUI, HUD, 메뉴
     │   ├── 이펙트 개발자 (Sonnet) -- ParticleSystem
     │   └── 사운드 (Haiku) -- SoundManager
     │
     └── QA 리드 (Opus) -- 50라운드 검수, 밸런스 테스트
```

### 팀 규모: 20명
| 등급 | 인원 | 역할 |
|------|------|------|
| Opus | 6 | 팀장, 엔진리드, 게임플레이리드, 넷코드리드, PM, QA리드 |
| Sonnet | 11 | 핵심 개발 |
| Haiku | 3 | 유틸/인프라/사운드 |

## 개발 규칙

### 빌드 확인 필수
모든 코드 변경 후 `npx next build` 통과 필수.

### 커밋 컨벤션
```
BLITZPIT: {변경 요약}
```

### QA 프로세스
1. 코드 변경 완료
2. `npx next build` 통과
3. QA 리드 50라운드 전수 검사
4. 팀장 컨펌
5. 사업부서장 최종 승인

### 성능 기준
- 모바일 60fps 목표
- GameUI setState 최소화 (10fps ref 기반)
- Three.js InstancedMesh 사용
- 파티클 풀 최대 2000개
- 매 프레임 new Vector3 금지 (temp vector 재사용)

### 메모리 관리
- 모든 시스템에 destroy() 메서드 필수
- addEventListener는 반드시 removeEventListener 쌍
- Three.js geometry/material dispose 필수
- requestAnimationFrame cleanup 필수

## 미완성 항목 (로드맵)

### P0 -- 즉시
- [ ] 멀티플레이어 (Cloudflare Workers + WebSocket)
- [ ] 사운드/파티클 엔진 연동 완성 (playGunshot, emitMuzzleFlash 등 미호출)

### P1 -- 단기
- [ ] WorldGenerator destroy() 메서드 (InstancedMesh dispose)
- [ ] ParticleSystem 커스텀 셰이더 (per-particle size)
- [ ] SoundManager 볼륨 상태 보존 (toggleMute 시 이전 볼륨 복원)
- [ ] 미니맵에 건물 표시

### P2 -- 중기
- [ ] PWA 지원 (오프라인 플레이)
- [ ] Stripe 결제 (스킨, 아이템)
- [ ] Discord 연동 (리더보드 공유)
- [ ] 관전/리플레이 모드
- [ ] 블록 파괴 시스템

### P3 -- 장기
- [ ] 실시간 멀티 배틀로얄 (100인)
- [ ] 맵 에디터
- [ ] 시즌/랭크 시스템

## 의사결정 체인

```
PM (Opus) 기획 -> QA 검수 -> 팀장 판단 -> 사업부서장 컨펌 -> 개발자 실행
```

컨펌 없이 대규모 변경 금지.
