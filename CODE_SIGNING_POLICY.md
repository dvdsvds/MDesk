# 코드 서명 정책

Windows 설치 파일은 [SignPath Foundation](https://signpath.org)의 인증서로 서명합니다.

Free code signing provided by [SignPath.io](https://about.signpath.io), certificate by [SignPath Foundation](https://signpath.org).

## 서명 대상

- 이 저장소의 공개 소스 코드로 GitHub Actions에서 빌드한 Windows 설치 파일(`mdesk-x.y.z-setup.exe`)만 서명합니다.
- 개인 컴퓨터에서 빌드한 파일은 서명하지 않습니다.

## 역할

| 역할 | 담당 |
|---|---|
| 커밋 및 리뷰 | [dvdsvds](https://github.com/dvdsvds) |
| 서명 승인 | [dvdsvds](https://github.com/dvdsvds) |

## 개인정보

Mdesk는 업데이트 확인을 위해 GitHub Releases에 접속하며, 사용자가 Google Drive를 연결한 경우 Google Drive와 통신합니다. 그 밖에는 외부로 정보를 보내지 않습니다. 자세한 내용은 [개인정보처리방침](PRIVACY.md)을 참고하십시오.
