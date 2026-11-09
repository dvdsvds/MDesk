<p align="center">
  <img src="build/icon.png" width="128" alt="Mdesk 아이콘">
</p>

<h1 align="center">Mdesk</h1>

<p align="center">
  마크다운(<code>.md</code>) 파일 기반의 데스크톱 편집기<br>
  열자마자 쓰고, 파일은 앱에 갇히지 않고 그대로 남습니다.
</p>

<p align="center">
  <a href="https://github.com/dvdsvds/MDesk/releases/latest"><img alt="최신 버전" src="https://img.shields.io/github/v/release/dvdsvds/MDesk?color=fabd2f&label=release"></a>
  <img alt="플랫폼" src="https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-8ec07c">
  <a href="LICENSE"><img alt="라이선스" src="https://img.shields.io/badge/license-MIT-83a598"></a>
</p>

<p align="center">
  <img src="docs/screenshot-dark.png" width="860" alt="Mdesk 다크 테마: 왼쪽 원문, 오른쪽 미리보기">
</p>

---

## 소개

Mdesk는 평범한 `.md` 파일을 폴더 그대로 열어 쓰는 편집기입니다. 왼쪽에 쓰면 오른쪽에 바로 미리보기가 나오고, 노트 사이의 링크, 표가 들어간 양식, 실행되는 코드까지 한곳에서 다룹니다.

- **파일이 곧 데이터입니다.** 별도의 데이터베이스나 가져오기 과정이 없습니다. 앱을 지워도 파일은 그대로 남고, 다른 편집기로 고쳐도 바로 반영됩니다.
- **원문과 미리보기를 나란히 봅니다.** 스크롤이 동기화되어 어느 쪽을 보든 같은 위치가 보입니다.
- **쓰는 도구가 하나입니다.** 노트 정리, A4 양식, 코드 실행, 문서 파일 보기를 앱을 바꾸지 않고 처리합니다.

---

## 목차

- [주요 기능](#주요-기능)
- [설치](#설치)
- [시작하기](#시작하기)
- [서식(양식) 만들기](#서식양식-만들기)
- [코드 실행](#코드-실행)
- [단축키](#단축키)
- [기술 스택](#기술-스택)
- [프로젝트 구조](#프로젝트-구조)
- [소스에서 빌드](#소스에서-빌드)
- [자주 묻는 질문](#자주-묻는-질문)
- [피드백](#피드백)
- [라이선스](#라이선스)

---

## 주요 기능

### 글쓰기

- 왼쪽 원문, 오른쪽 실시간 미리보기, 스크롤 동기화
- Vim 키 바인딩 (설정에서 켜기)
- 서식 툴바, `/` 메뉴로 블록 삽입
- 괄호·강조 기호·백틱 자동 닫기, 목록 번호 자동 정리
- `->`를 입력하면 `→`로 자동 변환 (코드 안은 제외)
- 제목과 문단 접기, 마지막 저장 상태와 달라진 줄 표시
- 자동 저장, 비정상 종료 후 저장하지 못한 내용 복구
- 파일별 버전 기록 비교와 되돌리기

### 마크다운

- CommonMark + GFM: 표, 체크리스트, 취소선, 각주
- 수식: `$a^2 + b^2 = c^2$`, `$$ ... $$` (KaTeX)
- 도표: ` ```mermaid ` 코드 블록
- 콜아웃: `> [!tip] 제목`
- 글자색: `{red|빨간 글자}`, `{#980000|진한 빨강}`

### 노트 정리

- 실제 폴더 구조 그대로 쓰는 작업 폴더, 하위 폴더 제한 없음
- 여러 파일을 탭으로 열기, 앱을 다시 켜면 탭 복원
- 빠른 검색(`Ctrl+P`)과 본문 전체 검색
- 위키링크 `[[노트]]`, `[[노트#제목]]`, `[[노트|별칭]]` 과 이름 입력 자동완성
- 파일 이름이나 위치가 바뀌면 링크도 자동으로 갱신
- 백링크 패널, 노트 사이의 연결을 보여 주는 그래프 보기
- 노트와 이미지 임베드 `![[...]]`
- 노트별 상태(대기·진행·보류·완료) 지정과 사이드바의 상태별 모아 보기
- 데일리 노트, 템플릿, 날짜별 모아 보기
- 삭제하면 작업 폴더의 `.mdesk/trash`로 이동하고 30일 뒤 지워집니다. 사이드바에서 `Ctrl+Z`로 되돌릴 수 있습니다

### 이미지와 첨부 파일

- 이미지를 붙여넣거나 끌어다 놓으면 같은 폴더의 `img/`에 저장되고 링크가 들어갑니다
- PDF, 엑셀 같은 파일은 `files/`에 저장됩니다
- 이미지와 PDF는 앱 안에서 바로 볼 수 있습니다

### 생산성

- **할일 대시보드** (`Ctrl+Shift+T`): 모든 파일의 `- [ ]`를 한곳에서 보고 체크
- **퀵 캡처** (`Ctrl+Alt+N`, 앱 밖에서도 동작): 떠오른 생각을 `Inbox.md`에 한 줄로 바로 추가
- **목차 패널** (`Ctrl+Shift+O`)

### 마크다운이 아닌 파일

- 모든 텍스트·코드 파일을 열고 언어별 문법 색을 적용
- csv는 열마다 다른 색으로 표시하고 구분자를 자동 감지
- docx·xlsx 읽기 전용 미리보기
- 파일 종류별 아이콘

### 화면과 설정

- gruvbox 계열의 라이트·다크·시스템 테마
- 에디터와 미리보기의 글꼴·크기·줄 간격을 따로 설정
- 모든 단축키 변경, CSS 스니펫
- 화면 확대·축소 (`Ctrl + =`, `Ctrl + -`, `Ctrl + 0`)

<p align="center">
  <img src="docs/screenshot-light.png" width="860" alt="Mdesk 라이트 테마">
</p>

---

## 설치

- 지원: **Windows / macOS (Apple Silicon) / Linux**
- 웹에서 바로 열리는 서비스가 아니라, 설치해서 쓰는 프로그램입니다

[Releases](https://github.com/dvdsvds/MDesk/releases)의 최신 버전에서 **운영체제에 맞는 파일 하나만** 받으면 됩니다.

### Windows

1. `mdesk-x.y.z-setup.exe`를 받습니다
2. 실행해서 설치합니다
3. "Windows의 PC 보호" 창이 표시되면 **추가 정보 → 실행**을 누릅니다

### macOS (Apple Silicon)

1. `mdesk-x.y.z.dmg`를 받습니다
2. 열어서 Mdesk를 **응용 프로그램** 폴더로 끌어 놓습니다
3. 처음 실행할 때 "확인되지 않은 개발자" 경고가 표시되면, 터미널에서 아래를 실행한 뒤 다시 엽니다

```bash
xattr -cr /Applications/Mdesk.app
```

### Linux (x86_64)

**AppImage**

```bash
chmod u+x mdesk-x.y.z.AppImage
./mdesk-x.y.z.AppImage
```

**deb (Ubuntu, Debian)**

```bash
sudo apt install ./mdesk_x.y.z_amd64.deb
```

### 그 외 파일

`latest*.yml`, `*.blockmap`, `*.zip`은 자동 업데이트용이므로 받지 않아도 됩니다.

### 업데이트

| 운영체제 | 업데이트 방법 |
|---|---|
| Windows | 새 버전이 나오면 앱이 알아서 받아서 적용합니다 |
| Linux (AppImage) | 새 버전이 나오면 앱이 알아서 받아서 적용합니다 |
| Linux (deb) | Releases에서 새 버전을 받아 다시 설치합니다 |
| macOS | Releases에서 새 버전을 받아 다시 설치합니다 (서명이 없어서 자동 업데이트가 되지 않습니다) |

---

## 시작하기

1. 처음 실행하면 앱 데이터 폴더 아래에 Mdesk 전용 폴더가 만들어지고, 그 폴더가 작업 폴더가 됩니다. 위치는 설정에서 바꿀 수 있습니다
2. 왼쪽 사이드바에서 **새 파일**(또는 `Ctrl+N`)을 누르고 이름을 입력하면 파일이 생깁니다
3. 왼쪽에 쓰면 오른쪽에 바로 미리보기가 나옵니다
4. 입력을 멈추면 자동으로 저장됩니다. `Ctrl+S`로 바로 저장할 수도 있습니다

작업 폴더는 평범한 폴더라서, 탐색기나 다른 편집기로 파일을 고쳐도 Mdesk에 바로 반영됩니다.

---

## 서식(양식) 만들기

`template [ ... ]` 블록으로 영수증, 보고서 같은 A4 양식을 만들 수 있습니다. 미리보기에서 **편집**을 누르면 표를 직접 클릭해서 편집할 수 있고, PDF로 내보낼 수 있습니다.

```
value [
  상호: 가나다상회
  날짜: 2026-10-14
]

template [
  page A4
  title : 영수증
  table col=2 row=2 widths=40,- frame=double [
    col=1 row=1 bold [
      text center : 상호
    ]
    col=2 row=1 [
      text : {{상호}}
    ]
    col=1 row=2 bold [
      text center : 날짜
    ]
    col=2 row=2 [
      text : {{날짜}}
    ]
  ]
  text right : 위 금액을 정히 영수합니다.
]
```

| 문법 | 뜻 |
|---|---|
| `value [ 이름: 값 ]` | 서식 안의 `{{이름}}`에 들어갈 값 |
| `page A4` | 종이 크기 |
| `title : 글자` | 제목 (기본: 가운데, 굵게, 16pt) |
| `text 옵션 : 글자` | 글 한 줄. `text :`는 빈 줄 |
| `table col=열 row=행 [ ]` | 표. `widths=`(mm, `-`는 남은 폭), `frame=`(none, solid, thick, double, dashed) |
| `col=1-2 row=3 [ ]` | 표의 칸. 칸 안은 `text` 줄로 쓰고, 줄마다 정렬을 따로 줄 수 있습니다 |
| `line`, `space`, `box [ ]`, `chart [ ]` | 구분선, 빈 공간, 테두리 상자, 차트 |

자주 쓰는 옵션: `left` `center` `right` (가로 정렬), `top` `middle` `bottom` (세로 정렬), `bold` `italic` `underline` `strike`, `fs=12` (글자 크기), `fc=red` (글자색), `bg=yellow` (배경색)

편집 모드에서 할 수 있는 것:

- 칸 클릭으로 글자 편집, 입력하는 즉시 소스에 반영
- 칸 여러 개 선택해서 합치기·나누기, 열·행 추가·삭제
- 열 경계를 끌어서 폭 조절
- 툴바로 글꼴, 크기, 굵게, 색, 정렬, 위·아래 첨자

---

## 코드 실행

JS와 Python 코드 블록 아래에 **▶ 실행** 버튼이 생깁니다. 결과는 블록 아래에 표시되고, **저장**을 누르면 문서에 남습니다.

```js
const rows = readCSV("data.csv")
table(rows)
chart({ type: 'bar', labels: ['사과', '배'], values: [3, 2] })
```

```py
print(sum(range(10)))
```

- `table(rows)`: 표 출력
- `chart({ type, labels, values })`: 막대(`bar`), 선(`line`), 파이(`pie`) 차트 출력
- `readFile`, `readJSON`, `readCSV`: 작업 폴더 안의 파일 읽기 (csv, tsv, json, txt, md / 2MB 이하)

코드는 격리된 환경에서 실행되며, 파일을 쓰거나 인터넷에 접속할 수 없습니다.

---

## 단축키

맥에서는 `Ctrl` 대신 `Cmd`입니다. 설정에서 모두 바꿀 수 있습니다.

| 기능 | 단축키 |
|---|---|
| 새 파일 | `Ctrl+N` |
| 저장 | `Ctrl+S` |
| 빠른 검색 | `Ctrl+P` |
| 설정 | `Ctrl+,` |
| 목차 패널 | `Ctrl+Shift+O` |
| 할일 대시보드 | `Ctrl+Shift+T` |
| 백링크 패널 | `Ctrl+Shift+B` |
| 퀵 캡처 | `Ctrl+Alt+N` |
| 절대 경로 복사 | `Ctrl+Shift+C` |
| 상대 경로 복사 | `Ctrl+Alt+C` |
| 화면 확대 / 축소 / 초기화 | `Ctrl+=` / `Ctrl+-` / `Ctrl+0` |

---

## 기술 스택

| 영역 | 사용 기술 |
|---|---|
| 앱 틀 | Electron 39, electron-vite, electron-builder, electron-updater |
| 화면 | React 19, TypeScript 5, Tailwind CSS 4, Zustand, Motion |
| 에디터 | CodeMirror 6, `@replit/codemirror-vim` (Vim 키 바인딩), `@codemirror/lang-markdown` |
| 마크다운 변환 | markdown-it (각주, 체크리스트), KaTeX (수식), Mermaid (도표), DOMPurify |
| 파일 보기 | pdf.js (PDF), docx-preview (docx), ExcelJS (xlsx) |
| 코드 실행 | JavaScript 격리 실행, Pyodide (Python) |
| 글꼴 | Pretendard, Roboto Mono |
| 빌드·검사 | Vite 7, ESLint, Prettier, GitHub Actions (세 운영체제 빌드와 릴리스) |

앱 아이콘 원본은 [`build/icon.svg`](build/icon.svg)이고, `npx electron scripts/make-icons.mjs`로 png·ico·icns를 다시 만듭니다.

---

## 프로젝트 구조

```
src/
├─ main/            Electron 메인 프로세스: 파일 입출력, 작업 폴더 감시, 휴지통, 퀵 캡처, 코드 실행, 업데이트
├─ preload/         렌더러에 안전하게 노출하는 API
└─ renderer/src/
   ├─ editor/       CodeMirror 에디터 확장: Vim, 자동 닫기, 접기, 선택·커서, 문법 색
   ├─ markdown/     markdown-it 규칙: 위키링크, 콜아웃, 임베드, 글자색
   ├─ features/     사이드바, 미리보기, 설정, 서식(템플릿), 내보내기
   ├─ components/   공용 화면 요소
   ├─ stores/       Zustand 상태 (설정, 탭 등)
   ├─ js/, python/  코드 실행 환경
   └─ assets/       테마 색(theme.css)과 스타일
build/              앱 아이콘과 빌드 리소스
docs/               README 화면 캡처
patches/            의존성 패치 (patch-package)
```

---

## 소스에서 빌드

필요한 것: Node.js 20 이상, npm

```bash
git clone https://github.com/dvdsvds/MDesk.git
cd MDesk
npm install          # 의존성 설치, 패치 적용, Pyodide 복사
npm run dev          # 개발 모드 실행
```

설치 파일 만들기:

```bash
npm run build:win    # Windows
npm run build:mac    # macOS (macOS에서만)
npm run build:linux  # Linux
```

결과물은 `dist/`에 생깁니다. `v*` 태그를 푸시하면 GitHub Actions가 세 운영체제 설치 파일을 만들어 릴리스에 올립니다.

---

## 자주 묻는 질문

**설치할 때 보안 경고가 표시됩니다**

코드 서명 인증서가 없어서 표시되는 경고입니다. Windows는 **추가 정보 → 실행**, macOS는 위의 `xattr -cr` 명령으로 열 수 있습니다.

**내 파일은 어디에 있습니까**

작업 폴더에 평범한 `.md` 파일로 있습니다. 작업 폴더는 설정에서 확인하고 바꿀 수 있으며, 앱을 지워도 파일은 그대로 남습니다.

**다른 편집기와 같이 써도 됩니까**

됩니다. 밖에서 고친 내용은 자동으로 반영되고, Mdesk에서 저장하지 않은 내용이 있을 때는 차이를 보여 주고 고르게 합니다.

**macOS에서 업데이트 알림이 오지 않습니다**

서명이 없는 macOS 앱은 자동 업데이트가 되지 않습니다. Releases에서 새 버전을 직접 받아 주십시오.

---

## 피드백

혼자 쓰려고 만들다가 공개한 프로그램이라, 디자인이나 사용성에 대한 의견이 큰 도움이 됩니다. 버그나 의견은 [Issues](https://github.com/dvdsvds/MDesk/issues)에 남겨 주십시오.

---

## 라이선스

[MIT](LICENSE)
